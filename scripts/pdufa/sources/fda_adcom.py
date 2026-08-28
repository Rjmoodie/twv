"""
FDA Advisory Committee calendar parser.
"""

from __future__ import annotations
from datetime import datetime
from selectolax.parser import HTMLParser
from urllib.parse import urljoin
from ..models import Item, Source, DecisionType
from ..util import fetch, slugify

URL = "https://www.fda.gov/advisory-committees/advisory-committee-calendar"


async def parse() -> list[Item]:
    """Parse FDA Advisory Committee calendar for meeting information."""
    html = await fetch(URL)
    tree = HTMLParser(html)
    items: list[Item] = []
    
    # FDA page is a table; capture rows with meeting title/date/link
    for row in tree.css("table tr"):
        cells = [c.text(strip=True) for c in row.css("td")]
        if len(cells) < 3:
            continue
            
        date_txt = cells[0]
        title = cells[1] if len(cells) > 1 else ""
        link = row.css_first("a")
        href = urljoin(URL, link.attributes.get("href")) if link else URL
        
        # Heuristics for headline
        headline = title or (link.text(strip=True) if link else "FDA Advisory Committee Meeting")
        
        # Parse date
        dt = None
        try:
            # Handle various date formats like MM/DD/YYYY or 'July 17, 2025'
            if "/" in date_txt:
                dt = datetime.strptime(date_txt.replace("-", "/"), "%m/%d/%Y").date()
            elif "," in date_txt:
                dt = datetime.strptime(date_txt, "%B %d, %Y").date()
        except Exception:
            pass
        
        items.append(Item(
            id=f"adcom-{slugify(headline)}-{dt or 'tbd'}",
            source=Source.FDA_ADVISORY,
            captured_at=datetime.utcnow(),
            event_date=dt,
            headline=headline,
            url=href,
            decision_type=DecisionType.ADVISORY,
            confidence=0.7,
        ))
    
    return items

