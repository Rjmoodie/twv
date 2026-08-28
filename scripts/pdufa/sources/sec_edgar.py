"""
SEC EDGAR 8-K filings parser for watchlist companies.
"""

from __future__ import annotations
from datetime import datetime
import httpx
from ..models import Item, Source, DecisionType
from ..util import HEADERS, slugify

SUBMISSIONS = "https://data.sec.gov/submissions/CIK{cik}.json"


async def parse(ciks: list[str]) -> list[Item]:
    """Parse SEC EDGAR submissions for 8-K filings from watchlist CIKs."""
    out: list[Item] = []
    
    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        for cik in ciks:
            url = SUBMISSIONS.format(cik=str(cik).zfill(10))
            
            try:
                r = await client.get(url)
                if r.status_code != 200:
                    continue
                    
                data = r.json()
                
                # Get recent filings
                recent = data.get("filings", {}).get("recent", {})
                
                for form, acc_no, primary_doc, filing_date in zip(
                    recent.get("form", []),
                    recent.get("accessionNumber", []),
                    recent.get("primaryDocument", []),
                    recent.get("filingDate", []),
                ):
                    if form != "8-K":
                        continue
                    
                    headline = f"SEC 8-K: {acc_no} ({filing_date})"
                    doc_url = f"https://www.sec.gov/ixviewer/doc?action=display&source=content&accno={acc_no}"
                    
                    out.append(Item(
                        id=f"sec-{slugify(acc_no)}",
                        source=Source.SEC,
                        captured_at=datetime.utcnow(),
                        event_date=None,
                        headline=headline,
                        url=doc_url,
                        decision_type=DecisionType.OTHER,
                        confidence=0.5,
                    ))
                    
            except Exception:
                # Skip failed CIK lookups
                continue
    
    return out

