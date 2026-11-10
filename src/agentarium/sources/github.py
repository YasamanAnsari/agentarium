"""GitHub: repository search, single repositories and READMEs. Saves one raw file per repository."""

from __future__ import annotations

import os
import urllib.error
from collections.abc import Callable
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlencode

from agentarium.sources import get_json, request, save_raw

API = "https://api.github.com"
SEARCH_CAP = 1000  # GitHub returns at most this many results per search query
PAGE_SIZE = 100
MAX_STARS = 10_000_000  # above any repository's star count, so the top range is never cut off


def _headers(raw: bool = False) -> dict[str, str]:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not set; add it to .env")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.raw" if raw else "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _search(query: str, page: int = 1, per_page: int = PAGE_SIZE) -> dict[str, Any]:
    params = urlencode({"q": query, "per_page": per_page, "page": page})
    data = get_json(f"{API}/search/repositories?{params}", _headers())
    if data["incomplete_results"]:
        raise RuntimeError(f"GitHub search timed out and returned partial results: {query}")
    return data


def star_ranges(low: int, high: int, count: Callable[[int, int], int]) -> list[tuple[int, int]]:
    """Split [low, high] in half until each range holds at most SEARCH_CAP results; empty ranges are dropped."""
    found = count(low, high)
    if found == 0:
        return []
    if found <= SEARCH_CAP:
        return [(low, high)]
    if low == high:
        raise RuntimeError(f"{found} repositories have exactly {low} stars; narrow the query")
    middle = (low + high) // 2
    return star_ranges(low, middle, count) + star_ranges(middle + 1, high, count)


def search(query: str, min_stars: int) -> list[dict[str, Any]]:
    """Every repository matching the query with at least min_stars stars, past the 1,000-result cap."""
    if "stars:" in query:
        raise ValueError("put the star threshold in --min-stars, not in the query")

    def count(low: int, high: int) -> int:
        return _search(f"{query} stars:{low}..{high}", per_page=1)["total_count"]

    repos: dict[int, dict[str, Any]] = {}
    for low, high in star_ranges(min_stars, MAX_STARS, count):
        for page in range(1, SEARCH_CAP // PAGE_SIZE + 1):
            items = _search(f"{query} stars:{low}..{high}", page)["items"]
            repos.update((item["id"], item) for item in items)
            if len(items) < PAGE_SIZE:
                break
    return list(repos.values())


def repo(full_name: str) -> dict[str, Any]:
    return get_json(f"{API}/repos/{quote(full_name)}", _headers())


def readme(full_name: str) -> str:
    """The README text, or an empty string if the repository has none."""
    try:
        body, _, _ = request(f"{API}/repos/{quote(full_name)}/readme", _headers(raw=True))
    except urllib.error.HTTPError as err:
        if err.code == 404:
            return ""
        raise
    return body.decode("utf-8", errors="replace")


def fetch(record: dict[str, Any]) -> Path:
    """Save a repository record with its description and README as the text to classify."""
    text = "\n\n".join(part for part in (record.get("description") or "", readme(record["full_name"])) if part)
    payload = {"source_url": record["html_url"], "record": record, "text": text}
    return save_raw("github", str(record["id"]), payload)
