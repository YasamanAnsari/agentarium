"""Schema rules for the three core CSVs, checked on small hand-written rows and on the real files."""

import csv
from pathlib import Path

import pytest

from agentarium import ROOT, schema

AGENT_ID = schema.new_agent_id("github:1")


def small_catalog() -> schema.Catalog:
    return {
        "agents": [
            {
                "agent_id": AGENT_ID,
                "name": "Example",
                "url": "https://example.com",
                "description": 'Says "hello", then waits',
                "organization": "",
                "source_url": "https://github.com/example/example",
                "first_seen": "2026-11-10",
            }
        ],
        "tasks": [
            {"task_id": "write_code", "name": "Write code", "definition": "Write code."},
            {"task_id": "browse_web", "name": "Browse the web", "definition": "Browse."},
        ],
        "agent_tasks": [
            {
                "agent_id": AGENT_ID,
                "task_id": "write_code",
                "source_url": "https://github.com/example/example",
                "evidence_quote": "It writes code.",
            }
        ],
    }


def problems(catalog: schema.Catalog) -> str:
    with pytest.raises(schema.SchemaError) as err:
        schema.validate(catalog)
    return str(err.value)


def test_write_uses_csv_conventions(tmp_path: Path) -> None:
    schema.write(small_catalog(), tmp_path)
    raw = (tmp_path / "tasks.csv").read_bytes()
    assert b"\r" not in raw
    assert raw.decode("utf-8").splitlines()[1:] == [
        "browse_web,Browse the web,Browse.",
        "write_code,Write code,Write code.",
    ]
    agents = (tmp_path / "agents.csv").read_text(encoding="utf-8").splitlines()
    assert agents[1].endswith(',"Says ""hello"", then waits",,https://github.com/example/example,2026-11-10')
    assert schema.load(tmp_path) == small_catalog() | {
        "tasks": sorted(small_catalog()["tasks"], key=lambda r: r["task_id"])
    }


def test_load_rejects_a_changed_header(tmp_path: Path) -> None:
    schema.write(small_catalog(), tmp_path)
    (tmp_path / "tasks.csv").write_text("task_id,name\n", encoding="utf-8")
    with pytest.raises(schema.SchemaError, match="header"):
        schema.load(tmp_path)


def test_duplicate_keys_are_rejected() -> None:
    catalog = small_catalog()
    catalog["agent_tasks"].append(dict(catalog["agent_tasks"][0]))
    catalog["tasks"].append(dict(catalog["tasks"][0]))
    found = problems(catalog)
    assert "agent_tasks.csv row 2: duplicate key" in found
    assert "tasks.csv row 3: duplicate key" in found


def test_invalid_references_are_rejected() -> None:
    catalog = small_catalog()
    catalog["agent_tasks"][0] |= {"agent_id": "ag_0000000000", "task_id": "fly_plane"}
    found = problems(catalog)
    assert "unknown agent_id 'ag_0000000000'" in found
    assert "unknown task_id 'fly_plane'" in found


def test_missing_evidence_and_bad_values_are_rejected() -> None:
    catalog = small_catalog()
    catalog["agent_tasks"][0] |= {"evidence_quote": "  ", "source_url": ""}
    catalog["agents"][0] |= {"url": "example.com", "first_seen": "20261110", "organization": ""}
    found = problems(catalog)
    assert "evidence_quote is empty" in found
    assert "source_url is empty" in found
    assert "url is not valid" in found
    assert "first_seen is not valid" in found
    assert "organization" not in found


def test_failed_write_leaves_existing_files_intact(tmp_path: Path, monkeypatch) -> None:
    schema.write(small_catalog(), tmp_path)
    before = {p.name: p.read_bytes() for p in tmp_path.iterdir()}

    real_render = schema.render

    def render_then_fail(table: schema.Table, rows: list[schema.Row]) -> str:
        if table is schema.AGENT_TASKS:
            raise OSError("disk full")
        return real_render(table, rows)

    monkeypatch.setattr(schema, "render", render_then_fail)
    changed = small_catalog()
    changed["tasks"][0]["definition"] = "Changed."
    with pytest.raises(OSError, match="disk full"):
        schema.write(changed, tmp_path)
    assert {p.name: p.read_bytes() for p in tmp_path.iterdir()} == before


def test_invalid_catalog_is_never_written(tmp_path: Path) -> None:
    schema.write(small_catalog(), tmp_path)
    before = (tmp_path / "agent_tasks.csv").read_bytes()
    broken = small_catalog()
    broken["agent_tasks"][0]["evidence_quote"] = ""
    with pytest.raises(schema.SchemaError):
        schema.write(broken, tmp_path)
    assert (tmp_path / "agent_tasks.csv").read_bytes() == before


def test_real_catalog_is_valid_and_canonical() -> None:
    catalog = schema.load()
    schema.validate(catalog)
    for table in schema.TABLES:
        on_disk = (schema.CORE_DIR / table.filename).read_text(encoding="utf-8")
        assert on_disk == schema.render(table, catalog[table.name]), f"{table.filename} is not in canonical form"


def test_declined_counts_are_well_formed() -> None:
    with (ROOT / "data" / "agent_declined.csv").open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    assert reader.fieldnames == ["date", "reason", "count"]
    keys = [(row["date"], row["reason"]) for row in rows]
    assert keys == sorted(set(keys)), "rows must be unique and sorted by date, then reason"
    for row in rows:
        assert schema.FORMATS["first_seen"](row["date"]), row
        assert row["reason"] and row["count"].isdigit() and int(row["count"]) > 0, row
