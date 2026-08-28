"""
FDA press announcements RSS parser.
"""

from __future__ import annotations
from datetime import datetime
import feedparser
from ..models import Item, Source, DecisionType
from ..util import slugify

RSS = "https://www.fda.gov/news-events/fda-newsroom/press-announcements/rss.xml"


async def parse() -> list[Item]:
    """Parse FDA press announcements RSS feed."""
    # feedparser is sync; safe to run in thread if needed
    feed = feedparser.parse(RSS)
    items: list[Item] = []
    
    for e in feed.entries:
        dt = None
        if getattr(e, "published_parsed", None):
            dt = datetime(*e.published_parsed[:6]).date()
        
        headline = e.title
        url = e.link
        
        # Determine decision type based on headline content
        decision = DecisionType.APPROVAL if any(
            k in headline.lower() for k in ["approves", "approval"]
        ) else DecisionType.OTHER
        
        items.append(Item(
            id=f"fda-press-{slugify(headline)}",
            source=Source.FDA_PRESS,
            captured_at=datetime.utcnow(),
            event_date=dt,
            headline=headline,
            url=url,
            decision_type=decision,
            confidence=0.6
        ))
    
    return items

