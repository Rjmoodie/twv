# 🧠 Smarter PDUFA Scraper

A comprehensive multi-source intelligence system for tracking FDA decisions, advisory committee meetings, and regulatory events with confidence scoring and deduplication.

## ✨ Features

- **🔍 Multi-Source Intelligence**: FDA advisory calendar, press releases, SEC 8-K filings, company RSS feeds
- **🎯 Confidence Scoring**: Smart scoring based on source reliability and multi-source corroboration
- **🔄 Deduplication**: Intelligent merging of duplicate items across sources
- **📊 Rich Output**: Pretty tables, multiple export formats (CSV, JSON, Markdown, iCal)
- **⚡ Async Performance**: Fast concurrent data gathering with caching
- **🛡️ Robust Parsing**: Retry logic, error handling, and graceful degradation
- **🎛️ Watchlist Filtering**: Focus on specific tickers and CIKs
- **📅 Calendar Integration**: Export to iCal for calendar apps

## 🚀 Quick Start

### Installation

```bash
# Install dependencies
pip install -r scripts/pdufa/requirements.txt

# Run the scraper
python -m scripts.pdufa.cli run
```

### Basic Usage

```bash
# Scrape all sources and export to Markdown + iCal
python -m scripts.pdufa.cli run

# Focus on specific tickers
python -m scripts.pdufa.cli run -t PFE -t BMY -t JNJ

# Include SEC filings for specific CIKs
python -m scripts.pdufa.cli run --cik 0000078003 --cik 0000078006

# Export to multiple formats
python -m scripts.pdufa.cli run --csv --json --md --ics

# Limit displayed results
python -m scripts.pdufa.cli run --limit 20
```

## 📊 Data Sources

| Source | Type | URL | Status |
|--------|------|-----|--------|
| FDA Advisory Committee | HTML | https://www.fda.gov/advisory-committees/advisory-committee-calendar | ✅ Active |
| FDA Press Releases | RSS | https://www.fda.gov/news-events/fda-newsroom/press-announcements/rss.xml | ✅ Active |
| SEC EDGAR | JSON API | https://data.sec.gov/submissions/ | ✅ Active |
| Company RSS | RSS | Various company newsrooms | ✅ Active |

## 🏢 Default Watchlist

| Ticker | Company | RSS Feed |
|--------|---------|----------|
| BMY | Bristol Myers Squibb | https://news.bms.com/cpress/rss/index.xml |
| PFE | Pfizer | https://www.pfizer.com/news/press-releases/rss.xml |
| JNJ | Johnson & Johnson | https://www.jnj.com/rss/news-releases.xml |
| MRK | Merck | https://www.merck.com/news/rss/ |
| ABBV | AbbVie | https://news.abbvie.com/rss.xml |
| LLY | Eli Lilly | https://investor.lilly.com/rss/news-releases.xml |

## 📁 Project Structure

```
scripts/pdufa/
├── __init__.py          # Package initialization
├── cli.py              # Command-line interface
├── models.py           # Pydantic data models
├── pipeline.py         # Merge, dedupe, and scoring
├── cache.py            # HTTP response caching
├── util.py             # Utility functions
├── export.py           # Export functionality
├── rules.yaml          # Configuration and rules
├── requirements.txt    # Python dependencies
└── sources/            # Data source parsers
    ├── __init__.py
    ├── fda_adcom.py    # FDA Advisory Committee
    ├── fda_press.py    # FDA Press Releases
    ├── sec_edgar.py    # SEC EDGAR filings
    └── company_rss.py  # Company RSS feeds
```

## 🔧 Configuration

### Environment Variables

```bash
# Cache configuration
export PDUFA_CACHE_DIR=".cache/pdufa"
export PDUFA_CACHE_TTL="900"  # 15 minutes
```

### Rules Configuration

Edit `rules.yaml` to customize:
- Keyword synonyms and mappings
- Confidence scoring rules
- Company ticker mappings
- Decision type classifications

## 📈 Confidence Scoring

The system uses a sophisticated confidence scoring algorithm:

- **Base Score**: Source-specific reliability (FDA = 0.7, RSS = 0.6, SEC = 0.5)
- **Multi-Source Bonus**: +0.1 for each additional source confirming the same item
- **Keyword Match Bonus**: +0.1 for regulatory keyword matches
- **Recency Bonus**: +0.1 for recent items
- **FDA Official Bonus**: +0.2 for official FDA sources

## 🎯 Decision Types

- **PDUFA**: Prescription Drug User Fee Act action dates
- **ADVISORY**: Advisory committee meetings
- **APPROVAL**: Drug approvals and positive decisions
- **CRL**: Complete Response Letters
- **OTHER**: Other regulatory events

## 📤 Export Formats

### Markdown Table
```markdown
| Date | Source | Headline | Ticker | Decision Type | Confidence | Link |
|---|---|---|---|---|---|---|
| 2025-01-15 | fda_press | FDA Approves New Drug | PFE | approval | 0.80 | [View](https://...) |
```

### iCalendar (.ics)
Import into any calendar application for event tracking.

### CSV
Structured data for spreadsheet analysis.

### JSON
Machine-readable format for API integration.

## 🧪 Testing

```bash
# Run tests
python -m pytest tests/test_pdufa_parsers.py -v

# Test specific parser
python -c "import asyncio; from scripts.pdufa.sources import fda_press; print(asyncio.run(fda_press.parse()))"
```

## 🔍 CLI Commands

```bash
# Main scraping command
python -m scripts.pdufa.cli run [OPTIONS]

# List available sources
python -m scripts.pdufa.cli sources

# Show default watchlist
python -m scripts.pdufa.cli watchlist

# Get help
python -m scripts.pdufa.cli --help
```

## 🚨 Important Notes

- **Rate Limiting**: Be respectful of data.sec.gov rate limits
- **Caching**: Responses are cached for 15 minutes by default
- **Error Handling**: Failed sources are gracefully skipped
- **No Official PDUFA Calendar**: FDA doesn't publish official PDUFA dates, so we approximate via other sources

## 🔮 Future Enhancements

- **Email/Slack Alerts**: Notifications for high-confidence items
- **OpenFDA Integration**: Drug mechanism and class enrichment
- **Database Persistence**: SQLite/Supabase storage for history
- **Web Dashboard**: Real-time monitoring interface
- **Machine Learning**: Improved confidence scoring and classification

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

This project is part of the SomaTech platform and follows the same licensing terms.

---

**Built with ❤️ by the SomaTech Team**

