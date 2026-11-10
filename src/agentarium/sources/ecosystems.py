"""ecosyste.ms: GitHub repositories whose manifests depend on a package."""

from __future__ import annotations

import itertools
import logging
from collections import Counter
from urllib.parse import quote

from agentarium.sources import get_json, github_repo

API = "https://repos.ecosyste.ms/api/v1/usage"
PAGE_SIZE = 100  # larger pages return HTTP 500

log = logging.getLogger(__name__)


def find(ecosystem: str, package: str, min_stars: int) -> list[str]:
    """URLs of non-fork GitHub repositories depending on the package, at min_stars or more.

    ponytail: filters on ecosyste.ms star counts, which lag GitHub by months, so a repository
    that crossed the threshold since its last sync is missed. The GitHub fetch re-checks the
    current count. Fetch every dependent from GitHub if that gap matters.
    """
    base = f"{API}/{quote(ecosystem, safe='')}/{quote(package, safe='')}/dependencies"
    urls: dict[str, None] = {}
    skipped: Counter[str] = Counter()
    for page in itertools.count(1):
        rows = get_json(f"{base}?per_page={PAGE_SIZE}&page={page}")
        for row in rows:
            repo = row.get("repository") or {}
            url = repo.get("html_url") or ""
            if github_repo(url) is None:
                skipped["not a GitHub repository"] += 1
            elif repo.get("fork"):
                skipped["fork"] += 1
            elif (repo.get("stargazers_count") or 0) < min_stars:
                skipped[f"under {min_stars} stars"] += 1
            else:
                urls[url] = None
        if len(rows) < PAGE_SIZE:
            break
    log.info("%s %s: %d repositories kept; dependency rows skipped: %s", ecosystem, package, len(urls), dict(skipped))
    return list(urls)
