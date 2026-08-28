"""
Utility functions for HTTP requests, text processing, and common operations.
"""

import asyncio
import re
import httpx
from tenacity import retry, wait_exponential, stop_after_attempt
from typing import Optional
from .cache import get as cache_get, set as cache_set

HEADERS = {"User-Agent": "somatech-pdufa-scraper/1.0"}

_slug = re.compile(r"[^a-z0-9]+")


@retry(wait=wait_exponential(min=1, max=30), stop=stop_after_attempt(5))
async def fetch(url: str) -> str:
    """Fetch URL with caching and retry logic."""
    if (cached := cache_get(url)):
        return cached
    
    async with httpx.AsyncClient(
        timeout=30, 
        headers=HEADERS, 
        follow_redirects=True
    ) as client:
        r = await client.get(url)
        r.raise_for_status()
        cache_set(url, r.text)
        return r.text


def slugify(s: str) -> str:
    """Convert string to URL-safe slug."""
    return _slug.sub("-", s.lower()).strip("-")


def normalize_text(s: str) -> str:
    """Normalize text for consistent processing."""
    # Remove extra whitespace
    s = re.sub(r"\s+", " ", s)
    # Remove common suffixes
    s = re.sub(r"\s+-\s+FDA$", "", s, flags=re.IGNORECASE)
    return s.strip()

