"""URL routing, link extraction and star-range splitting, checked with literal values."""

import json
from pathlib import Path

import pytest
from agentarium.sources import candidate, github_repo, is_product_link, web_key, write_manifests
from agentarium.sources.awesome_lists import extract_links
from agentarium.sources.aws_marketplace import listing_text
from agentarium.sources.github import SEARCH_CAP, star_ranges
from agentarium.sources.swe_bench import address


def test_submission_sites_compare_as_addresses() -> None:
    assert address("http://www.Kodu.ai/") == address("https://kodu.ai") == "https://kodu.ai"
    assert address("https://github.com/bytedance/trae-agent.git") == "https://github.com/bytedance/trae-agent"
    assert address("https://refact.ai/blog") != address("https://refact.ai")


def test_aws_listing_becomes_a_candidate() -> None:
    listing = {
        "listingId": "prodview-qizrc6sk6fb7a",
        "listingName": "AI Agent Starter Pack",
        "publisher": {"displayName": "Tech 42", "sellerProfileId": "seller-1"},
        "shortDescription": " Deploy agents. ",
        "longDescription": "It files tickets.",
        "highlights": ["Pre-built agent templates", " "],
        "useCases": [{"useCase": {"displayName": "Support", "description": "Answers customers.", "value": "x"}}],
        "pricingModels": [{"pricingModelType": "USAGE"}, {"pricingModelType": "CONTRACT"}],
    }
    url = "https://aws.amazon.com/marketplace/pp/prodview-qizrc6sk6fb7a"
    text = listing_text(listing)
    assert text == "Deploy agents.\n\nIt files tickets.\n\nPre-built agent templates\n\nSupport: Answers customers."
    found = candidate("aws", {"retrieved_at": "2026-11-12T06:20:00+00:00", "source_url": url,
                              "record": listing, "text": text})
    assert (found.key, found.organization, found.description) == ("aws:prodview-qizrc6sk6fb7a", "Tech 42", "Deploy agents.")
    assert (found.url, found.pricing_model, found.stars, found.license) == (url, "contract;usage", "", "")


def test_github_repo_urls() -> None:
    assert github_repo("https://github.com/OpenHands/OpenHands") == "openhands/openhands"
    assert github_repo("https://www.github.com/a/b.git") == "a/b"
    assert github_repo("https://github.com/a/b/tree/main/docs#x") == "a/b"
    assert github_repo("https://github.com/topics/ai-agents") is None
    assert github_repo("https://github.com/openai") is None
    assert github_repo("https://gitlab.com/a/b") is None


def test_product_links() -> None:
    assert is_product_link("https://manus.im/")
    assert not is_product_link("https://github.com/a/b")
    assert not is_product_link("https://img.shields.io/badge/x.svg")
    assert not is_product_link("https://www.youtube.com/watch?v=1")
    assert not is_product_link("https://example.com/logo.PNG")
    assert not is_product_link("mailto:hi@example.com")


def test_web_key() -> None:
    assert web_key("https://WWW.Example.com/Agent/?ref=hn#top") == "web:example.com/agent"
    assert web_key("http://example.com") == "web:example.com"


def test_extract_links() -> None:
    markdown = (
        "- [Agent](https://example.com/agent). Also https://example.com/agent\n"
        "- <https://b.io/x>, see ![logo](https://b.io/logo.png)\n"
    )
    assert extract_links(markdown) == [
        "https://example.com/agent",
        "https://b.io/x",
        "https://b.io/logo.png",
    ]


def test_star_ranges_split_until_each_fits() -> None:
    stars = [5] * 600 + [6] * 600 + [7] * 300 + [900] * 10
    calls: list[tuple[int, int]] = []

    def count(low: int, high: int) -> int:
        calls.append((low, high))
        return sum(low <= s <= high for s in stars)

    ranges = star_ranges(5, 1000, count)
    assert all(count(low, high) <= SEARCH_CAP for low, high in ranges)
    assert sum(count(low, high) for low, high in ranges) == len(stars)
    assert ranges[0] == (5, 5)


def test_manifest_keeps_entries_for_files_no_longer_on_disk(tmp_path: Path) -> None:
    folder = tmp_path / "web" / "2026-11-10"
    folder.mkdir(parents=True)
    record = {"retrieved_at": "2026-11-10T06:20:00+00:00", "source_url": "https://example.com"}
    (folder / "a-1.json").write_text(json.dumps(record), encoding="utf-8")
    write_manifests(tmp_path)

    (folder / "a-1.json").unlink()
    (folder / "b-2.json").write_text(json.dumps(record | {"source_url": "https://b.io"}), encoding="utf-8")
    write_manifests(tmp_path)

    manifest = json.loads((folder / "manifest.json").read_text(encoding="utf-8"))
    assert sorted(manifest) == ["a-1.json", "b-2.json"]
    assert manifest["b-2.json"]["url"] == "https://b.io"
    assert len(manifest["a-1.json"]["sha256"]) == 64


def test_star_ranges_refuse_a_single_value_over_the_cap() -> None:
    with pytest.raises(RuntimeError, match="exactly 5 stars"):
        star_ranges(5, 5, lambda low, high: SEARCH_CAP + 1)
