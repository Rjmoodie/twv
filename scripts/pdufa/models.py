"""
Core data models for the PDUFA scraper system.
"""

from __future__ import annotations
from datetime import datetime, date
from enum import Enum
from pydantic import BaseModel, HttpUrl, Field
from typing import Optional, List, Literal


class Source(str, Enum):
    """Data source enumeration."""
    FDA_ADVISORY = "fda_advisory"
    FDA_PRESS = "fda_press"
    SEC = "sec_edgar"
    COMPANY_RSS = "company_rss"


class DecisionType(str, Enum):
    """Decision type enumeration."""
    PDUFA = "pdufa"
    ADVISORY = "adcom"
    APPROVAL = "approval"
    CRL = "crl"
    OTHER = "other"


class Item(BaseModel):
    """Individual PDUFA/regulatory event item."""
    id: str                       # stable hash of {source+url+date}
    source: Source
    captured_at: datetime
    event_date: Optional[date]    # meeting date or target action date if known
    headline: str
    url: HttpUrl
    ticker: Optional[str] = None
    sponsor: Optional[str] = None
    drug: Optional[str] = None
    indication: Optional[str] = None
    decision_type: DecisionType = DecisionType.OTHER
    priority: Optional[Literal["priority", "standard"]] = None
    notes: Optional[str] = None
    confidence: float = Field(ge=0, le=1, default=0.5)


class Result(BaseModel):
    """Collection of processed items with metadata."""
    items: List[Item]
    deduped_count: int
    raw_count: int

