"""Hacker News: links from Show HN stories, through the Algolia search API."""

from __future__ import annotations

import logging
from datetime import UTC, date, datetime, time
from urllib.parse import urlencode

from agentarium.sources import get_json

API = "https://hn.algolia.com/api/v1/search_by_date"
HITS_CAP = 1000  # Algolia returns at most this many hits per query

log = logging.getLogger(__name__)


def find(query: str, since: date, min_points: int) -> list[str]:
    """Links of Show HN stories matching the query, posted since the date with at least min_points."""
    start = int(datetime.combine(since, time.min, UTC).timestamp())
    params = {
        "query": query,
        "tags": "show_hn",
        "numericFilters": f"created_at_i>={start},points>={min_points}",
        "hitsPerPage": HITS_CAP,
    }
    data = get_json(f"{API}?{urlencode(params)}")
    if data["nbHits"] > HITS_CAP:
        raise RuntimeError(f"{data['nbHits']} stories match; raise --min-points or move --since later")
    urls = [hit["url"] for hit in data["hits"] if hit.get("url")]
    log.info("hacker news: %d stories, %d with a link", len(data["hits"]), len(urls))
    return list(dict.fromkeys(urls))
