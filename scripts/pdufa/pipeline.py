"""
Pipeline for merging, enriching, deduplicating, and scoring items.
"""

from __future__ import annotations
from datetime import datetime
from collections import defaultdict
import hashlib
import re
from .models import Item, Result
from .util import normalize_text

CLEAN = [
    (re.compile(r"\s+"), " "),
    (re.compile(r"\s+-\s+FDA$", re.I), ""),
]


def stable_id(item: Item) -> str:
    """Generate stable ID for deduplication."""
    raw = f"{item.source}|{item.url}|{item.event_date or ''}|{item.headline}"
    return hashlib.sha1(raw.encode()).hexdigest()


def merge_and_score(items: list[Item]) -> Result:
    """Merge duplicate items and calculate confidence scores."""
    buckets: dict[str, list[Item]] = defaultdict(list)
    
    for it in items:
        it.headline = normalize_text(it.headline)
        key = stable_id(it)
        it.id = key
        buckets[key].append(it)

    merged: list[Item] = []
    
    for key, group in buckets.items():
        # Simple confidence uplift for multi-source corroboration
        conf = min(1.0, sum(i.confidence for i in group) / len(group) + (0.1 * (len(group) - 1)))
        base = max(group, key=lambda x: x.confidence)
        base.confidence = conf
        merged.append(base)

    return Result(
        items=sorted(merged, key=lambda x: (x.event_date or datetime.max.date(), x.headline)),
        deduped_count=len(merged),
        raw_count=sum(len(v) for v in buckets.values())
    )

