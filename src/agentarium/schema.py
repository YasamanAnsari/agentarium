"""Definition of the catalog tables, and the only module that writes data/core/*.csv."""

from __future__ import annotations

import csv
import hashlib
import io
import os
import re
import tempfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from urllib.parse import urlsplit

from agentarium import ROOT

CORE_DIR = ROOT / "data" / "core"

Row = dict[str, str]
Catalog = dict[str, list[Row]]


@dataclass(frozen=True)
class Table:
    """One CSV file: its columns, primary key and which columns may be empty."""

    name: str
    columns: tuple[str, ...]
    key: tuple[str, ...]
    optional: frozenset[str] = frozenset()

    @property
    def filename(self) -> str:
        return f"{self.name}.csv"


AGENTS = Table(
    "agents",
    (
        "agent_id", "name", "url", "description", "organization", "source_url",
        "first_seen", "created_on", "stars", "main_task",
    ),
    ("agent_id",),
    optional=frozenset({"organization", "created_on", "stars", "main_task"}),
)
TASKS = Table("tasks", ("task_id", "name", "definition"), ("task_id",))
AGENT_TASKS = Table(
    "agent_tasks",
    ("agent_id", "task_id", "source_url", "evidence_quote"),
    ("agent_id", "task_id"),
)
TABLES = (AGENTS, TASKS, AGENT_TASKS)


def _is_http_url(value: str) -> bool:
    parts = urlsplit(value)
    return parts.scheme in ("http", "https") and bool(parts.hostname)


def _is_iso_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return len(value) == 10


FORMATS = {
    "agent_id": re.compile(r"ag_[0-9a-f]{10}").fullmatch,
    "task_id": re.compile(r"[a-z][a-z0-9]*(_[a-z0-9]+)*").fullmatch,
    "main_task": re.compile(r"[a-z][a-z0-9]*(_[a-z0-9]+)*").fullmatch,
    "url": _is_http_url,
    "source_url": _is_http_url,
    "first_seen": _is_iso_date,
    "created_on": _is_iso_date,
    "stars": re.compile(r"0|[1-9][0-9]*").fullmatch,
}


class SchemaError(ValueError):
    """The catalog breaks one or more schema rules; `problems` lists each one."""

    def __init__(self, problems: list[str]) -> None:
        self.problems = problems
        super().__init__("\n".join(problems))


def new_agent_id(identity_key: str) -> str:
    """Stable ID for an agent, derived from the first key it was found under."""
    return "ag_" + hashlib.sha256(identity_key.encode()).hexdigest()[:10]


def load(core_dir: Path = CORE_DIR) -> Catalog:
    """Read the three tables. Raises SchemaError if a header is not exactly as defined."""
    catalog: Catalog = {}
    for table in TABLES:
        with (core_dir / table.filename).open(encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            if tuple(reader.fieldnames or ()) != table.columns:
                raise SchemaError(
                    [f"{table.filename}: header {reader.fieldnames} != {list(table.columns)}"]
                )
            catalog[table.name] = list(reader)
    return catalog


def validate(catalog: Catalog) -> None:
    """Check columns, values, unique keys and references. Raises SchemaError listing every problem."""
    problems: list[str] = []
    for table in TABLES:
        rows = catalog.get(table.name)
        if rows is None:
            problems.append(f"{table.filename}: table is missing")
            continue
        problems += _row_problems(table, rows)

    agent_ids = {row.get("agent_id") for row in catalog.get("agents", [])}
    task_ids = {row.get("task_id") for row in catalog.get("tasks", [])}
    for row in catalog.get("agent_tasks", []):
        if row.get("agent_id") not in agent_ids:
            problems.append(f"agent_tasks.csv: unknown agent_id {row.get('agent_id')!r}")
        if row.get("task_id") not in task_ids:
            problems.append(f"agent_tasks.csv: unknown task_id {row.get('task_id')!r}")

    linked: dict[str, set[str]] = {}
    for row in catalog.get("agent_tasks", []):
        linked.setdefault(row.get("agent_id", ""), set()).add(row.get("task_id", ""))
    for row in catalog.get("agents", []):
        tasks, main = linked.get(row.get("agent_id", ""), set()), row.get("main_task", "")
        if tasks and main not in tasks:
            problems.append(f"agents.csv: {row.get('agent_id')} main_task {main!r} is not one of its tasks")
        elif not tasks and main:
            problems.append(f"agents.csv: {row.get('agent_id')} has main_task {main!r} but no tasks")

    if problems:
        raise SchemaError(problems)


def _row_problems(table: Table, rows: list[Row]) -> list[str]:
    problems: list[str] = []
    seen: set[tuple[str, ...]] = set()
    for number, row in enumerate(rows, start=1):
        where = f"{table.filename} row {number}"
        if set(row) != set(table.columns):
            problems.append(f"{where}: columns {sorted(row)} != {sorted(table.columns)}")
            continue
        for column in table.columns:
            value = row[column]
            if not isinstance(value, str):
                problems.append(f"{where}: {column} is not text: {value!r}")
            elif not value.strip():
                if column not in table.optional:
                    problems.append(f"{where}: {column} is empty")
            elif column in FORMATS and not FORMATS[column](value):
                problems.append(f"{where}: {column} is not valid: {value!r}")
        key = tuple(row[column] for column in table.key)
        if key in seen:
            problems.append(f"{where}: duplicate key {key}")
        seen.add(key)
    return problems


def render(table: Table, rows: list[Row]) -> str:
    """The canonical CSV text: header, rows sorted by primary key, minimal quoting, LF endings."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(table.columns)
    for row in sorted(rows, key=lambda r: tuple(r[column] for column in table.key)):
        writer.writerow([row[column] for column in table.columns])
    return buffer.getvalue()


def write(catalog: Catalog, core_dir: Path = CORE_DIR) -> None:
    """Validate, then replace the three CSVs through temporary files in the same folder."""
    validate(catalog)
    staged: list[tuple[Path, Path]] = []
    try:
        for table in TABLES:
            fd, tmp = tempfile.mkstemp(dir=core_dir, prefix=f".{table.name}.", suffix=".tmp")
            staged.append((Path(tmp), core_dir / table.filename))
            with os.fdopen(fd, "w", encoding="utf-8", newline="") as f:
                f.write(render(table, catalog[table.name]))
                f.flush()
                os.fsync(f.fileno())
        # ponytail: three renames are not one atomic step; a crash between them can pair
        # tables from two writes. validate() on the next load reports any broken reference.
        for tmp, target in staged:
            os.replace(tmp, target)
    finally:
        for tmp, _ in staged:
            tmp.unlink(missing_ok=True)
