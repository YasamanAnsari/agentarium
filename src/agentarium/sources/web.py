"""Product websites: fetch one page, honoring robots.txt, and save its HTML and visible text."""

from __future__ import annotations

import hashlib
import urllib.error
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from agentarium.sources import USER_AGENT, SkipRecord, request, save_raw

MAX_BYTES = 2_000_000
HIDDEN_TAGS = {"script", "style", "noscript", "template", "svg"}
META_KEYS = {"description", "og:description", "og:site_name"}


class _PageParser(HTMLParser):
    """Collects the title, a few meta tags, and the visible text of a page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.meta: dict[str, str] = {}
        self.chunks: list[str] = []
        self._hidden_depth = 0
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "title":
            self._in_title = True
        elif tag == "meta":
            values = dict(attrs)
            key = (values.get("property") or values.get("name") or "").lower()
            content = (values.get("content") or "").strip()
            if key in META_KEYS and content:
                self.meta.setdefault(key, content)
        elif tag in HIDDEN_TAGS:
            self._hidden_depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag in HIDDEN_TAGS and self._hidden_depth:
            self._hidden_depth -= 1

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if not text:
            return
        if self._in_title:
            self.title = f"{self.title} {text}".strip()
        elif not self._hidden_depth:
            self.chunks.append(text)


def _check_robots(url: str) -> None:
    parts = urlsplit(url)
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    try:
        body, _, _ = request(robots_url, max_bytes=MAX_BYTES)
    except urllib.error.HTTPError as err:
        if 400 <= err.code < 500:
            return  # no robots.txt: every path is allowed (RFC 9309)
        raise SkipRecord(f"robots.txt returned HTTP {err.code}: {robots_url}") from err
    rules = RobotFileParser()
    rules.parse(body.decode("utf-8", errors="replace").splitlines())
    if not rules.can_fetch(USER_AGENT, url):
        raise SkipRecord(f"disallowed by robots.txt: {url}")


def _decode(body: bytes, charset: str | None) -> str:
    try:
        return body.decode(charset or "utf-8", errors="replace")
    except LookupError:
        return body.decode("utf-8", errors="replace")


def fetch(url: str) -> Path:
    """Save one page's HTML, title, meta description and visible text."""
    _check_robots(url)
    body, headers, final_url = request(url, max_bytes=MAX_BYTES)
    if headers.get_content_type() != "text/html":
        raise SkipRecord(f"not an HTML page ({headers.get_content_type()}): {url}")
    html = _decode(body, headers.get_content_charset())
    page = _PageParser()
    page.feed(html)
    page.close()

    description = page.meta.get("description") or page.meta.get("og:description", "")
    payload = {
        "source_url": final_url,
        "requested_url": url,
        "title": page.title,
        "site_name": page.meta.get("og:site_name", ""),
        "description": description,
        "html": html,
        "text": "\n".join([description, *page.chunks] if description else page.chunks),
    }
    record_id = hashlib.sha256(final_url.encode()).hexdigest()[:16]
    return save_raw("web", record_id, payload)
