"""Occupation coverage, computed from hand-written activity links over the real O*NET 29.2 files."""

from agentarium import derived, schema


def test_an_activity_claims_tasks_through_onet() -> None:
    catalog = schema.load()
    links = [{"agent_id": agent["agent_id"], "dwa_id": "4.A.3.b.1.I01.D03", "source_url": "https://example.com",
              "evidence_quote": "It writes code."} for agent in catalog["agents"][:derived.MIN_AGENTS]]
    rows = {row["soc_code"]: row for row in derived.occupation_coverage(catalog | {"agent_activities": links})}
    programmers = rows["15-1251"]
    assert programmers["title"] == "Computer Programmers"
    assert 0 < int(programmers["tasks_claimed"]) < int(programmers["tasks"])
    assert programmers["agents"] == str(derived.MIN_AGENTS)
    assert rows["29-1141"]["tasks_claimed"] == "0", "registered nurses do not write code"
    assert all(int(row["tasks_claimed"]) <= int(row["tasks"]) for row in rows.values())
    too_few = derived.occupation_coverage(catalog | {"agent_activities": links[1:]})
    assert all(row["tasks_claimed"] == "0" for row in too_few), "an activity with too few agents claims no task"
