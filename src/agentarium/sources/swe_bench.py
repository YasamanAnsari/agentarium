"""SWE-bench submissions whose listed site is an agent's address, from the public SWE-bench/experiments repository.

Needs the optional `pulls` extra (PyYAML) and git.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
from collections import Counter
from pathlib import Path

from agentarium.sources import save_raw

REPO = "https://github.com/SWE-bench/experiments"
TREE_URL = REPO + "/tree/main/evaluation/{split}/{submission}"


def address(url: str) -> str:
    """A URL reduced for comparison: lowercased, https, without www., trailing slash or .git."""
    url = url.strip().lower().replace("http://", "https://", 1).replace("://www.", "://", 1)
    return url.rstrip("/").removesuffix(".git")


def checkout(folder: Path) -> Path:
    """Fetch only each submission's metadata.yaml and results.json into folder; returns the evaluation folder."""
    subprocess.run(["git", "clone", "--quiet", "--depth", "1", "--filter=blob:none", "--sparse", REPO, str(folder)],
                   check=True)
    subprocess.run(["git", "-C", str(folder), "sparse-checkout", "set", "--no-cone",
                    "/evaluation/*/*/metadata.yaml", "/evaluation/*/*/results/results.json"], check=True)
    return folder / "evaluation"


def results(agents: list[dict[str, str]]) -> tuple[list[dict[str, str]], Counter[str]]:
    """agent_results rows for submissions whose site equals an agent's url or source_url, and counts of the rest."""
    import yaml  # the optional `pulls` extra

    by_address: dict[str, str] = {}
    for agent in agents:
        for url in (agent["url"], agent["source_url"]):
            by_address.setdefault(address(url), agent["agent_id"])
    rows: list[dict[str, str]] = []
    counts: Counter[str] = Counter()
    with tempfile.TemporaryDirectory() as tmp:
        for meta_path in sorted(checkout(Path(tmp) / "experiments").glob("*/*/metadata.yaml")):
            submission, split = meta_path.parent.name, meta_path.parent.parent.name
            try:
                info = (yaml.safe_load(meta_path.read_text(encoding="utf-8")) or {}).get("info") or {}
            except yaml.YAMLError as err:
                raise ValueError(f"{split}/{submission}/metadata.yaml: {err}") from err
            if "mini-swe-agent_version" in info:
                counts["skipped: SWE-bench's own mini-SWE-agent run of a model"] += 1
                continue
            sites = info.get("site") if isinstance(info.get("site"), list) else [info.get("site")]
            agent_ids = {by_address[address(s)] for s in sites if isinstance(s, str) and address(s) in by_address}
            if not agent_ids:
                counts["unmatched"] += 1
                continue
            results_path = meta_path.parent / "results" / "results.json"
            if not results_path.exists():
                counts["matched, but no results.json"] += 1
                continue
            resolved = json.loads(results_path.read_text(encoding="utf-8"))["resolved"]
            source_url = TREE_URL.format(split=split, submission=submission)
            save_raw("swe-bench", f"{split}-{submission}", {"source_url": source_url, "record": info,
                                                            "resolved": resolved})
            for agent_id in sorted(agent_ids):
                rows.append({
                    "agent_id": agent_id,
                    "benchmark": f"swe-bench-{split}",
                    "resolved_instances": str(len(resolved)),
                    "date": f"{submission[:4]}-{submission[4:6]}-{submission[6:8]}",
                    "source_url": source_url,
                })
            counts["matched"] += 1
    return rows, counts
