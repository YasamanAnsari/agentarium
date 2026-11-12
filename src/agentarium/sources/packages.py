"""Registry packages that name an agent's repository, with their downloads, from ecosyste.ms."""

from __future__ import annotations

from urllib.parse import urlencode

from agentarium.sources import get_json, save_raw

LOOKUP_URL = "https://packages.ecosyste.ms/api/v1/packages/lookup"
PAGE_SIZE = 100


def lookup(agent_id: str, repository_url: str) -> list[dict[str, str]]:
    """agent_packages rows for every package whose registry entry names the repository.

    Third-party republished copies name the repository too and are kept: the lookup cannot tell them
    apart, and the downloads show which one is real. Downloads are filled only when the registry
    reports them for the last month.
    """
    rows: list[dict[str, str]] = []
    for page in range(1, 1000):
        url = f"{LOOKUP_URL}?{urlencode({'repository_url': repository_url, 'page': page, 'per_page': PAGE_SIZE})}"
        found = get_json(url)
        save_raw("packages", f"{agent_id}-p{page}", {"source_url": url, "record": found})
        rows += [
            {
                "agent_id": agent_id,
                "ecosystem": package["ecosystem"],
                "package": package["name"],
                "downloads_last_month": str(package["downloads"])
                if package.get("downloads_period") == "last-month" and package.get("downloads") is not None
                else "",
                "source_url": url,
            }
            for package in found
        ]
        if len(found) < PAGE_SIZE:
            return rows
    raise RuntimeError(f"more than 999 pages of packages for {repository_url}")
