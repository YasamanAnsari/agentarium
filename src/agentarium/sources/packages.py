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
        if not isinstance(found, list):
            raise ValueError(f"{url}: expected a list of packages")
        try:
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
        except (KeyError, TypeError, AttributeError) as err:
            raise ValueError(f"{url}: a package entry lacks {err}") from err
        if len(found) < PAGE_SIZE:
            return without_repeats(rows, repository_url)
    raise RuntimeError(f"more than 999 pages of packages for {repository_url}")


def without_repeats(rows: list[dict[str, str]], repository_url: str) -> list[dict[str, str]]:
    """One row per package: the lookup lists a package once per registry of an ecosystem (each nixpkgs
    channel, for example), and those copies are identical rows. Copies that differ raise ValueError."""
    unique: dict[tuple[str, str], dict[str, str]] = {}
    for row in rows:
        key = (row["ecosystem"], row["package"])
        if unique.setdefault(key, row) != row:
            raise ValueError(f"{repository_url}: {key} is listed twice with different downloads")
    return list(unique.values())
