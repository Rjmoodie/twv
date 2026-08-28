"""
HTTP response caching system for the PDUFA scraper.
"""

from __future__ import annotations
import hashlib
import os
import json
import time
from pathlib import Path

CACHE_DIR = Path(os.getenv("PDUFA_CACHE_DIR", ".cache/pdufa"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)
TTL_SECONDS = int(os.getenv("PDUFA_CACHE_TTL", "900"))  # 15 min default


def _key(url: str) -> Path:
    """Generate cache file path for URL."""
    h = hashlib.sha256(url.encode()).hexdigest()
    return CACHE_DIR / f"{h}.json"


def get(url: str) -> Optional[str]:
    """Get cached response for URL if valid."""
    p = _key(url)
    if p.exists():
        with p.open() as f:
            data = json.load(f)
        if time.time() - data["ts"] < TTL_SECONDS:
            return data["body"]
    return None


def set(url: str, body: str) -> None:
    """Cache response body for URL."""
    p = _key(url)
    p.write_text(json.dumps({"ts": time.time(), "body": body}))

