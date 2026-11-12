"""O*NET 29.2 reference files, read as published (tab-separated, one header row)."""

from __future__ import annotations

import csv
from functools import cache

from agentarium import ROOT

ONET_VERSION = "29.2"
ONET_DIR = ROOT / "data" / "reference" / "onet" / ONET_VERSION


def read(name: str) -> list[dict[str, str]]:
    """Every row of one O*NET file, e.g. read("Tasks to DWAs")."""
    with (ONET_DIR / f"{name}.txt").open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f, delimiter="\t"))


@cache
def activities() -> dict[str, str]:
    """Detailed Work Activity titles by DWA ID."""
    return {row["DWA ID"]: row["DWA Title"] for row in read("DWA Reference")}
