"""Shared helpers for sources: HTTP with rate-limit waits, URL routing, and raw evidence files."""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, date, datetime
from email.message import Message
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from agentarium import ROOT

RAW_DIR = ROOT / "data" / "raw"
MANIFEST = "manifest.json"
USER_AGENT = "agentarium/0.1"
TIMEOUT_SECONDS = 30
MAX_ATTEMPTS = 5

# ponytail: fixed lists; links to these hosts and GitHub paths are never products or repositories.
# Extend them when a run report shows noise from a new host.
NON_PRODUCT_HOSTS = (
    "twitter.com", "x.com", "youtube.com", "youtu.be", "discord.gg", "discord.com",
    "linkedin.com", "medium.com", "reddit.com", "facebook.com", "instagram.com", "t.me",
    "arxiv.org", "wikipedia.org", "shields.io", "githubusercontent.com",
    "news.ycombinator.com", "github.com",
)
GITHUB_NON_REPO_PATHS = {
    "about", "apps", "collections", "enterprise", "events", "explore", "features", "login",
    "marketplace", "orgs", "pricing", "search", "settings", "sponsors", "topics", "trending",
}
NON_PAGE_SUFFIXES = (".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf", ".zip", ".mp4")

log = logging.getLogger(__name__)


class SkipRecord(Exception):
    """A record that cannot be used, with the reason. The run continues without it."""


def request(
    url: str, headers: dict[str, str] | None = None, max_bytes: int | None = None
) -> tuple[bytes, Message, str]:
    """GET a URL, waiting out rate limits and retrying server errors.

    Returns the body, the response headers and the final URL after redirects.
    """
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, **(headers or {})})
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as response:
                body = response.read() if max_bytes is None else response.read(max_bytes + 1)
                if max_bytes is not None and len(body) > max_bytes:
                    raise SkipRecord(f"larger than {max_bytes:,} bytes: {url}")
                _wait_if_exhausted(response.headers)
                return body, response.headers, response.url
        except urllib.error.HTTPError as err:
            wait = _retry_wait(err, attempt)
            if wait is None or attempt == MAX_ATTEMPTS:
                raise
            log.warning("HTTP %s from %s; retrying in %d s", err.code, urlsplit(url).hostname, wait)
            time.sleep(wait)
    raise AssertionError("unreachable")


def get_json(url: str, headers: dict[str, str] | None = None) -> Any:
    body, _, _ = request(url, headers)
    return json.loads(body)


def _retry_wait(err: urllib.error.HTTPError, attempt: int) -> int | None:
    """Seconds to wait before retrying, or None if the error is final."""
    if err.code >= 500:
        return 5 * 2**attempt
    if err.code not in (403, 429):
        return None
    retry_after = err.headers.get("Retry-After", "")
    if retry_after.isdigit():
        return int(retry_after) + 1
    if err.headers.get("X-RateLimit-Remaining") == "0":
        return _seconds_until_reset(err.headers)
    return None


def _wait_if_exhausted(headers: Message) -> None:
    if headers.get("X-RateLimit-Remaining") == "0":
        wait = _seconds_until_reset(headers)
        log.info("rate limit reached; waiting %d s", wait)
        time.sleep(wait)


def _seconds_until_reset(headers: Message) -> int:
    reset = int(headers.get("X-RateLimit-Reset", "0"))
    return max(reset - int(time.time()), 0) + 1


def save_raw(source: str, record_id: str, payload: dict[str, Any]) -> Path:
    """Save one fetched record as data/raw/<source>/<date>/<record_id>-<time>.json, never overwriting."""
    now = datetime.now(UTC)
    folder = RAW_DIR / source / now.date().isoformat()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{record_id}-{now:%Y%m%dT%H%M%S%fZ}.json"
    with path.open("x", encoding="utf-8") as f:
        json.dump({"retrieved_at": now.isoformat(), **payload}, f, ensure_ascii=False, indent=1)
    return path


def write_manifests(raw_dir: Path = RAW_DIR) -> None:
    """Record URL, time, size and SHA-256 of every raw file in data/raw/<source>/<date>/manifest.json.

    Git tracks only the manifests. Entries for files no longer on disk (a fresh clone holds
    manifests but no raw files) are kept, so a manifest only ever grows.
    """
    for folder in sorted(raw_dir.glob("*/*/")):
        records = sorted(p for p in folder.glob("*.json") if p.name != MANIFEST)
        if not records:
            continue
        manifest_path = folder / MANIFEST
        manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
        for path in records:
            body = path.read_bytes()
            raw = json.loads(body)
            manifest[path.name] = {
                "bytes": len(body),
                "fetched_at": raw["retrieved_at"],
                "sha256": hashlib.sha256(body).hexdigest(),
                "url": raw["source_url"],
            }
        manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


@dataclass(frozen=True)
class Candidate:
    """One saved record, reduced to the fields the catalog copies from it."""

    key: str
    name: str
    url: str
    description: str
    organization: str
    source_url: str
    retrieved_on: str
    created_on: str  # repository creation date; empty for web pages
    stars: str  # stargazer count at retrieval; empty for web pages
    text: str


def candidate(source: str, raw: dict[str, Any]) -> Candidate:
    """Read a saved GitHub or web record into the catalog's fields; nothing is written by a model."""
    retrieved_on = datetime.fromisoformat(raw["retrieved_at"]).date().isoformat()
    if source == "github":
        record = raw["record"]
        homepage = (record.get("homepage") or "").strip()
        owner = record["owner"]
        return Candidate(
            key=f"github:{record['id']}",
            name=record["name"],
            url=homepage if homepage.startswith(("http://", "https://")) else record["html_url"],
            description=(record.get("description") or "").strip(),
            organization=owner["login"] if owner.get("type") == "Organization" else "",
            source_url=record["html_url"],
            retrieved_on=retrieved_on,
            created_on=record["created_at"][:10],
            stars=str(record["stargazers_count"]),
            text=raw["text"],
        )
    return Candidate(
        key=web_key(raw["source_url"]),
        name=raw["site_name"] or raw["title"],
        url=raw["source_url"],
        description=raw["description"].strip(),
        organization="",
        source_url=raw["source_url"],
        retrieved_on=retrieved_on,
        created_on="",
        stars="",
        text=raw["text"],
    )


def latest_candidates(day: date, raw_dir: Path = RAW_DIR) -> list[Candidate]:
    """The newest saved fetch of each record on that day, across the GitHub and web raw folders."""
    by_key: dict[str, Candidate] = {}
    for source in ("github", "web"):
        # Filenames are <record id>-<timestamp>.json, so sorting puts each record's newest fetch last.
        for path in sorted((raw_dir / source / day.isoformat()).glob("*.json")):
            if path.name == MANIFEST:
                continue
            found = candidate(source, json.loads(path.read_text(encoding="utf-8")))
            by_key[found.key] = found
    return list(by_key.values())


def github_repo(url: str) -> str | None:
    """'owner/name' (lowercased) if the URL points into a GitHub repository, else None."""
    parts = urlsplit(url.strip())
    if (parts.hostname or "").lower() not in ("github.com", "www.github.com"):
        return None
    segments = [segment for segment in parts.path.split("/") if segment]
    if len(segments) < 2 or segments[0].lower() in GITHUB_NON_REPO_PATHS:
        return None
    name = segments[1].removesuffix(".git")
    if not re.fullmatch(r"[\w.-]+", segments[0]) or not re.fullmatch(r"[\w.-]+", name):
        return None
    return f"{segments[0]}/{name}".lower()


def is_product_link(url: str) -> bool:
    """True for an http(s) page that could be a product site: not a social, media or file link."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https") or not host:
        return False
    if any(host == h or host.endswith("." + h) for h in NON_PRODUCT_HOSTS):
        return False
    return not parts.path.lower().endswith(NON_PAGE_SUFFIXES)


def web_key(url: str) -> str:
    """Identity key of a web page: host and path, lowercased, without www., query, fragment or trailing slash."""
    parts = urlsplit(url.strip())
    host = (parts.hostname or "").lower().removeprefix("www.")
    return f"web:{host}{parts.path.lower().rstrip('/')}"
