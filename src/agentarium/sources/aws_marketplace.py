"""AWS Marketplace listings in one category, through the official Discovery API.

Needs the optional `pulls` extra (boto3) and credentials allowed by the AWSMarketplaceRead-only policy.
The search pages themselves are closed to crawlers by robots.txt, so the API is the only route.
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any

from agentarium.sources import save_raw

REGION = "us-east-1"
LISTING_URL = "https://aws.amazon.com/marketplace/pp/{}"

log = logging.getLogger(__name__)


def listing_text(listing: dict[str, Any]) -> str:
    """The seller's own words on the listing page: descriptions, highlights and use cases."""
    use_cases = [f"{u['useCase']['displayName']}: {u['useCase']['description']}" for u in listing.get("useCases", [])]
    parts = [listing.get("shortDescription", ""), listing.get("longDescription", ""),
             *listing.get("highlights", []), *use_cases]
    return "\n\n".join(part.strip() for part in parts if part and part.strip())


def category_id(client: Any, name: str) -> str:
    """The id of the category with this display name, read from the API's own facet list."""
    facets: list[dict[str, Any]] = []
    token: str | None = None
    while True:
        page = client.search_facets(facetTypes=["CATEGORY"], **({"nextToken": token} if token else {}))
        facets += page["listingFacets"].get("CATEGORY", [])
        token = page.get("nextToken")
        if not token:
            break
    matches = [facet["value"] for facet in facets if facet["displayName"] == name]
    if len(matches) != 1:
        names = sorted({facet["displayName"] for facet in facets})
        raise ValueError(f"{len(matches)} AWS Marketplace categories are named {name!r}; the names are {names}")
    return matches[0]


def collect(category: str) -> Counter[str]:
    """Save every listing in the category to data/raw/aws/; API failures become RuntimeError."""
    import boto3  # the optional `pulls` extra
    from botocore.exceptions import BotoCoreError, ClientError

    counts: Counter[str] = Counter()
    try:
        client = boto3.client("marketplace-discovery", region_name=REGION)
        category_filter = [{"filterType": "CATEGORY", "filterValues": [category_id(client, category)]}]
        for page in client.get_paginator("search_listings").paginate(filters=category_filter):
            for summary in page["listingSummaries"]:
                listing_id = summary["listingId"]
                try:
                    listing = client.get_listing(listingId=listing_id)
                except ClientError as err:
                    log.warning("failed %s: %s", listing_id, err)
                    counts["failed: aws"] += 1
                    continue
                listing.pop("ResponseMetadata", None)
                save_raw("aws", listing_id, {
                    "source_url": LISTING_URL.format(listing_id),
                    "record": listing,
                    "text": listing_text(listing),
                })
                counts["saved: aws"] += 1
    except (BotoCoreError, ClientError) as err:
        raise RuntimeError(f"AWS Marketplace: {err}") from err
    return counts
