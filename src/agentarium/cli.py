"""Command line: collect candidate agents from sources into data/raw."""

from __future__ import annotations

import argparse
import http.client
import logging
from collections import Counter
from collections.abc import Iterable
from datetime import date

from agentarium.sources import (
    SkipRecord,
    awesome_lists,
    ecosystems,
    github,
    github_repo,
    hackernews,
    is_product_link,
    web,
    web_key,
    write_manifests,
)

FETCH_ERRORS = (OSError, http.client.HTTPException, SkipRecord)

log = logging.getLogger("agentarium")


def route(urls: Iterable[str], min_stars: int | None = None) -> Counter[str]:
    """Fetch every candidate URL: GitHub repositories through the API, other pages as websites."""
    repos: dict[str, str] = {}
    pages: dict[str, str] = {}
    counts: Counter[str] = Counter()
    for url in urls:
        if full_name := github_repo(url):
            repos.setdefault(full_name, url)
        elif is_product_link(url):
            pages.setdefault(web_key(url), url)
        else:
            counts["skipped: not a repository or product page"] += 1
    log.info("%d repositories and %d web pages to fetch", len(repos), len(pages))

    for full_name in repos:
        try:
            record = github.repo(full_name)
            if record["fork"]:
                counts["skipped: fork"] += 1
            elif min_stars is not None and record["stargazers_count"] < min_stars:
                counts[f"skipped: under {min_stars} stars"] += 1
            else:
                github.fetch(record)
                counts["saved: github"] += 1
        except FETCH_ERRORS as err:
            log.warning("failed %s: %s", full_name, err)
            counts["failed: github"] += 1

    for url in pages.values():
        try:
            web.fetch(url)
            counts["saved: web"] += 1
        except FETCH_ERRORS as err:
            log.warning("failed %s: %s", url, err)
            counts["failed: web"] += 1
    return counts


def collect(args: argparse.Namespace) -> Counter[str]:
    if args.source == "github" and args.query:
        counts: Counter[str] = Counter()
        records = github.search(args.query, args.min_stars)
        log.info("%d repositories match", len(records))
        for record in records:
            try:
                github.fetch(record)
                counts["saved: github"] += 1
            except FETCH_ERRORS as err:
                log.warning("failed %s: %s", record["full_name"], err)
                counts["failed: github"] += 1
        return counts
    if args.source == "github":
        return route([f"https://github.com/{args.repo}"], args.min_stars)
    if args.source == "awesome-list":
        return route(awesome_lists.find(args.repo))
    if args.source == "dependents":
        return route(ecosystems.find(args.ecosystem, args.package, args.min_stars), args.min_stars)
    if args.source == "hackernews":
        return route(hackernews.find(args.query, args.since, args.min_points))
    return route([args.url])


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="agentarium", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    collect_parser = commands.add_parser("collect", help="fetch candidates into data/raw")
    sources = collect_parser.add_subparsers(dest="source", required=True)

    github_parser = sources.add_parser("github", help="repository search, or one repository")
    target = github_parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--query", help="GitHub search query, without a stars: qualifier")
    target.add_argument("--repo", help="one repository, as owner/name")
    github_parser.add_argument("--min-stars", type=int, help="required with --query")

    awesome = sources.add_parser("awesome-list", help="every link in a curated list's README")
    awesome.add_argument("--repo", required=True, help="the list repository, as owner/name")

    dependents = sources.add_parser("dependents", help="GitHub repositories depending on a package")
    dependents.add_argument("--ecosystem", required=True, help="e.g. pypi or npm")
    dependents.add_argument("--package", required=True)
    dependents.add_argument("--min-stars", type=int, required=True)

    hn = sources.add_parser("hackernews", help="links from Show HN stories")
    hn.add_argument("--query", required=True)
    hn.add_argument("--since", type=date.fromisoformat, required=True, help="YYYY-MM-DD")
    hn.add_argument("--min-points", type=int, required=True)

    page = sources.add_parser("web", help="one web page")
    page.add_argument("--url", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    if args.source == "github" and args.query and args.min_stars is None:
        parser.error("--min-stars is required with --query")
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    try:
        counts = collect(args)
    finally:
        write_manifests()
    for label, number in sorted(counts.items()):
        print(f"{label}: {number}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
