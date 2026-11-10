"""Awesome lists: every link in a curated list's README."""

from __future__ import annotations

import re

from agentarium.sources import github

LINK = re.compile(r"https?://[^\s<>()\[\]\"'`]+")


def extract_links(markdown: str) -> list[str]:
    """Links in order of first appearance, without trailing punctuation or duplicates."""
    links = (match.rstrip(".,;:!?*_") for match in LINK.findall(markdown))
    return list(dict.fromkeys(links))


def find(list_repo: str) -> list[str]:
    """Links in the README of `owner/name`, excluding links back to the list itself."""
    own = f"github.com/{list_repo.lower()}"
    return [url for url in extract_links(github.readme(list_repo)) if own not in url.lower()]
