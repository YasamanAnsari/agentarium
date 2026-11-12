"""Occupation coverage, computed from one hand-written activity link over the real O*NET 29.2 files."""

from agentarium import derived, schema


def test_an_activity_claims_tasks_through_onet() -> None:
    catalog = schema.load()
    agent_id = catalog["agents"][0]["agent_id"]
    link = {"agent_id": agent_id, "dwa_id": "4.A.3.b.1.I01.D03", "source_url": "https://example.com",
            "evidence_quote": "It writes code."}
    rows = {row["soc_code"]: row for row in derived.occupation_coverage(catalog | {"agent_activities": [link]})}
    programmers = rows["15-1251"]
    assert programmers["title"] == "Computer Programmers"
    assert 0 < int(programmers["tasks_claimed"]) < int(programmers["tasks"]) and programmers["agents"] == "1"
    assert rows["29-1141"]["tasks_claimed"] == "0", "registered nurses do not write code"
    assert all(int(row["tasks_claimed"]) <= int(row["tasks"]) for row in rows.values())
