"""
Company newsroom RSS feeds parser for watchlist tickers.
"""

from __future__ import annotations
from datetime import datetime
import feedparser
from ..models import Item, Source, DecisionType
from ..util import slugify

# Map your watchlist to company RSS feeds (extend via YAML if you want)
DEFAULT_FEEDS = {
    "BMY": "https://news.bms.com/cpress/rss/index.xml",
    "PFE": "https://www.pfizer.com/news/press-releases/rss.xml",
    "JNJ": "https://www.jnj.com/rss/news-releases.xml",
    "MRK": "https://www.merck.com/news/rss/",
    "ABBV": "https://news.abbvie.com/rss.xml",
    "LLY": "https://investor.lilly.com/rss/news-releases.xml",
    "NVS": "https://www.novartis.com/rss/news.xml",
    "RHHBY": "https://www.roche.com/rss/news.xml",
    "SNY": "https://www.sanofi.com/rss/news.xml",
    "GSK": "https://www.gsk.com/rss/news.xml",
}


async def parse(ticker_to_feed: dict[str, str] = DEFAULT_FEEDS) -> list[Item]:
    """Parse company RSS feeds for regulatory news."""
    out: list[Item] = []
    
    for ticker, feed_url in ticker_to_feed.items():
        try:
            feed = feedparser.parse(feed_url)
            
            for e in feed.entries:
                dt = None
                if getattr(e, "published_parsed", None):
                    dt = datetime(*e.published_parsed[:6]).date()
                
                decision = DecisionType.OTHER
                title = e.title
                
                # Check for regulatory keywords
                if any(k in title.lower() for k in ["fda", "pdufa", "approval", "complete response"]):
                    if "approval" in title.lower():
                        decision = DecisionType.APPROVAL
                    elif "complete response" in title.lower():
                        decision = DecisionType.CRL
                    else:
                        decision = DecisionType.PDUFA
                
                out.append(Item(
                    id=f"rss-{ticker}-{slugify(title)}",
                    source=Source.COMPANY_RSS,
                    captured_at=datetime.utcnow(),
                    event_date=dt,
                    headline=title,
                    url=e.link,
                    ticker=ticker,
                    decision_type=decision,
                    confidence=0.6,
                ))
                
        except Exception:
            # Skip failed feed parsing
            continue
    
    return out

