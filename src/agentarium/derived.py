"""Tables computed from the catalog and the reference files; never edited by hand.

    uv run python -m agentarium.derived   # rewrites data/derived/occupation_coverage.csv
"""

from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

from agentarium import ROOT, onet, schema

DERIVED_DIR = ROOT / "data" / "derived"
BLS_PATH = ROOT / "data" / "reference" / "bls" / "oews_national_m2025.csv"
COLUMNS = ("soc_code", "title", "tasks", "tasks_claimed", "agents", "annual_mean_wage", "employment")


def _bls() -> dict[str, dict[str, str]]:
    """BLS rows by SOC code; '*' (not published) is read as empty, never estimated."""
    with BLS_PATH.open(encoding="utf-8", newline="") as f:
        return {row["OCC_CODE"]: {k: "" if v == "*" else v for k, v in row.items()} for row in csv.DictReader(f)}


def occupation_coverage(catalog: schema.Catalog) -> list[dict[str, str]]:
    """One row per 6-digit SOC occupation with O*NET tasks: how many of its tasks at least one agent claims.

    A task is claimed when one of its Detailed Work Activities (O*NET's own Tasks to DWAs file) is in
    agent_activities. O*NET occupations such as 15-1252.00 and 15-1252.01 are pooled under their SOC code
    so they join to BLS wages. Tasks with no activity link count in `tasks` and can never be claimed.
    """
    agents_by_dwa: dict[str, set[str]] = defaultdict(set)
    for row in catalog["agent_activities"]:
        agents_by_dwa[row["dwa_id"]].add(row["agent_id"])
    dwas_by_task: dict[str, set[str]] = defaultdict(set)
    for row in onet.read("Tasks to DWAs"):
        dwas_by_task[row["Task ID"]].add(row["DWA ID"])
    tasks_by_soc: dict[str, set[str]] = defaultdict(set)
    for row in onet.read("Task Statements"):
        tasks_by_soc[row["O*NET-SOC Code"][:7]].add(row["Task ID"])
    onet_titles = {row["O*NET-SOC Code"]: row["Title"] for row in onet.read("Occupation Data")}
    bls = _bls()

    rows = []
    for soc, tasks in sorted(tasks_by_soc.items()):
        claimed = {task for task in tasks if any(agents_by_dwa.get(dwa) for dwa in dwas_by_task[task])}
        agents = set().union(*(agents_by_dwa[dwa] for task in claimed for dwa in dwas_by_task[task]))
        wages = bls.get(soc, {})
        rows.append({
            "soc_code": soc,
            "title": onet_titles.get(f"{soc}.00") or wages.get("OCC_TITLE", ""),
            "tasks": str(len(tasks)),
            "tasks_claimed": str(len(claimed)),
            "agents": str(len(agents)),
            "annual_mean_wage": wages.get("A_MEAN", ""),
            "employment": wages.get("TOT_EMP", ""),
        })
    return rows


def write(catalog: schema.Catalog | None = None, folder: Path = DERIVED_DIR) -> None:
    catalog = catalog if catalog is not None else schema.load()
    schema.validate(catalog)
    folder.mkdir(parents=True, exist_ok=True)
    with (folder / "occupation_coverage.csv").open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(occupation_coverage(catalog))


if __name__ == "__main__":
    write()
