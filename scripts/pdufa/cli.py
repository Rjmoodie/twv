"""
Command-line interface for the PDUFA scraper.
"""

from __future__ import annotations
import asyncio
import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

from .models import Result
from .sources import fda_adcom, fda_press, sec_edgar, company_rss
from .pipeline import merge_and_score
from .export import to_csv, to_json, to_md, to_ics

app = typer.Typer(help="Smarter PDUFA scraper with multi-source intelligence")
console = Console()


@app.command()
def run(
    tickers: list[str] = typer.Option([], "--ticker", "-t", help="Watchlist tickers (repeatable)"),
    ciks: list[str] = typer.Option([], "--cik", help="Watchlist CIKs (repeatable)"),
    out: str = typer.Option("pdufa", help="Output basename (no extension)"),
    ics: bool = typer.Option(True, help="Write calendar .ics"),
    md: bool = typer.Option(True, help="Write Markdown table"),
    csv: bool = typer.Option(False, help="Write CSV"),
    json: bool = typer.Option(False, help="Write JSON"),
    limit: int = typer.Option(50, help="Limit number of results displayed"),
):
    """Scrape multiple sources, merge, score, and export."""
    
    async def gather():
        """Gather data from all sources."""
        tasks = [
            fda_adcom.parse(),
            fda_press.parse(),
            company_rss.parse({
                t: company_rss.DEFAULT_FEEDS.get(t, v) 
                for t, v in company_rss.DEFAULT_FEEDS.items() 
                if not tickers or t in tickers
            })
        ]
        
        if ciks:
            tasks.append(sec_edgar.parse(ciks))
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Gathering data from sources...", total=None)
            
            results = await asyncio.gather(*tasks)
            progress.update(task, description="Processing and deduplicating...")
            
            flat = [it for sub in results for it in sub]
            return merge_and_score(flat)

    # Run the async gathering
    res: Result = asyncio.run(gather())

    # Display results in a pretty table
    table = Table(title=f"PDUFA Intelligence ({res.deduped_count} items, {res.raw_count} raw)")
    for col in ["Date", "Source", "Headline", "Ticker", "Type", "Conf", "Link"]:
        table.add_column(col)
    
    # Limit displayed results
    display_items = res.items[:limit]
    for it in display_items:
        table.add_row(
            str(it.event_date or ""),
            it.source.value,
            it.headline[:60] + "..." if len(it.headline) > 60 else it.headline,
            it.ticker or "",
            it.decision_type.value,
            f"{it.confidence:.2f}",
            "View"
        )
    
    console.print(table)
    
    if len(res.items) > limit:
        console.print(f"\n[dim]Showing {limit} of {len(res.items)} results. Use --limit to adjust.[/dim]")

    # Export to requested formats
    if md:
        to_md(res, f"{out}.md")
        console.print(f"✅ Exported to {out}.md")
    
    if ics:
        to_ics(res, f"{out}.ics")
        console.print(f"✅ Exported to {out}.ics")
    
    if csv:
        to_csv(res, f"{out}.csv")
        console.print(f"✅ Exported to {out}.csv")
    
    if json:
        to_json(res, f"{out}.json")
        console.print(f"✅ Exported to {out}.json")


@app.command()
def sources():
    """List available data sources and their status."""
    table = Table(title="Available Data Sources")
    table.add_column("Source")
    table.add_column("Type")
    table.add_column("URL")
    table.add_column("Status")
    
    sources_info = [
        ("FDA Advisory Committee", "HTML", "https://www.fda.gov/advisory-committees/advisory-committee-calendar", "✅ Active"),
        ("FDA Press Releases", "RSS", "https://www.fda.gov/news-events/fda-newsroom/press-announcements/rss.xml", "✅ Active"),
        ("SEC EDGAR", "JSON API", "https://data.sec.gov/submissions/", "✅ Active"),
        ("Company RSS", "RSS", "Various company newsrooms", "✅ Active"),
    ]
    
    for source, type_, url, status in sources_info:
        table.add_row(source, type_, url, status)
    
    console.print(table)


@app.command()
def watchlist():
    """Show default company watchlist and RSS feeds."""
    table = Table(title="Default Company Watchlist")
    table.add_column("Ticker")
    table.add_column("Company")
    table.add_column("RSS Feed")
    
    companies = [
        ("BMY", "Bristol Myers Squibb", "https://news.bms.com/cpress/rss/index.xml"),
        ("PFE", "Pfizer", "https://www.pfizer.com/news/press-releases/rss.xml"),
        ("JNJ", "Johnson & Johnson", "https://www.jnj.com/rss/news-releases.xml"),
        ("MRK", "Merck", "https://www.merck.com/news/rss/"),
        ("ABBV", "AbbVie", "https://news.abbvie.com/rss.xml"),
        ("LLY", "Eli Lilly", "https://investor.lilly.com/rss/news-releases.xml"),
    ]
    
    for ticker, company, feed in companies:
        table.add_row(ticker, company, feed)
    
    console.print(table)


if __name__ == "__main__":
    app()

