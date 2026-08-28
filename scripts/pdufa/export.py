"""
Export functionality for various formats (CSV, JSON, Markdown, iCal).
"""

from __future__ import annotations
import csv
import json
from pathlib import Path
from datetime import datetime
from ics import Calendar, Event
from .models import Result


def to_csv(res: Result, path: str) -> None:
    """Export results to CSV format."""
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "date", "source", "headline", "ticker", "drug", 
            "indication", "url", "confidence", "decision_type"
        ])
        for it in res.items:
            w.writerow([
                it.event_date or "",
                it.source,
                it.headline,
                it.ticker or "",
                it.drug or "",
                it.indication or "",
                it.url,
                it.confidence,
                it.decision_type
            ])


def to_json(res: Result, path: str) -> None:
    """Export results to JSON format."""
    Path(path).write_text(
        json.dumps([it.model_dump() for it in res.items], indent=2, default=str),
        encoding="utf-8"
    )


MD_HEADER = "| Date | Source | Headline | Ticker | Decision Type | Confidence | Link |\n|---|---|---|---|---|---|---|\n"


def to_md(res: Result, path: str) -> None:
    """Export results to Markdown table format."""
    lines = [MD_HEADER]
    for it in res.items:
        link = f"[View]({it.url})"
        lines.append(
            f"| {it.event_date or ''} | {it.source} | {it.headline} | "
            f"{it.ticker or ''} | {it.decision_type} | {it.confidence:.2f} | {link} |\n"
        )
    Path(path).write_text("".join(lines), encoding="utf-8")


def to_ics(res: Result, path: str) -> None:
    """Export results to iCalendar format."""
    cal = Calendar()
    
    for it in res.items:
        if not it.event_date:  # only dated items like adcom meetings
            continue
            
        e = Event()
        e.name = it.headline
        e.begin = datetime.combine(it.event_date, datetime.min.time())
        e.url = str(it.url)
        e.description = (
            f"Source: {it.source}\n"
            f"Confidence: {it.confidence:.2f}\n"
            f"Decision Type: {it.decision_type}\n"
            f"Ticker: {it.ticker or 'N/A'}\n"
            f"URL: {it.url}"
        )
        cal.events.add(e)
    
    Path(path).write_text(str(cal), encoding="utf-8")

