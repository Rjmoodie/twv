# PDUFA Scanner — TypeScript Implementation

A comprehensive, production-ready PDUFA (Prescription Drug User Fee Act) data ingestion system built with TypeScript. This system aggregates data from multiple FDA and regulatory sources to provide real-time insights into drug approval timelines and regulatory milestones.

## 🚀 Features

- **Multi-Source Data Ingestion**: Aggregates data from 9+ regulatory sources
- **Intelligent Deduplication**: Automatically merges and deduplicates items across sources
- **Confidence Scoring**: Assigns confidence scores based on source reliability and corroboration
- **Watchlist Support**: Filter data by specific tickers, CIKs, and keywords
- **Real-Time Processing**: Live data ingestion with caching for performance
- **Type Safety**: Full TypeScript implementation with comprehensive type definitions
- **Error Handling**: Robust error handling with fallback mechanisms

## 📊 Data Sources

| Source | Type | Weight | Description |
|--------|------|--------|-------------|
| FDA Press Announcements | RSS | 0.9 | Official FDA press releases and announcements |
| FDA Advisory Committee Calendar | HTML | 0.85 | Upcoming advisory committee meetings |
| Federal Register | API | 0.8 | Official FDA notices and regulations |
| SEC EDGAR | API | 0.85 | 8-K filings for regulatory updates |
| Company RSS Feeds | RSS | 0.7 | Company-specific news and press releases |
| CDER What's New | HTML | 0.7 | Drug safety and availability updates |
| DailyMed RSS | RSS | 0.6 | Drug labeling and safety information |
| Orange Book | File | 0.9 | Approved drug products (nightly) |
| Purple Book | File | 0.9 | Licensed biologics (nightly) |

## 🏗️ Architecture

```
src/pdufa/
├── types.ts              # TypeScript interfaces and types
├── util.ts               # Utility functions (hashing, parsing, etc.)
├── sources/              # Data source implementations
│   ├── fdaPress.ts       # FDA press announcements
│   ├── fdaAdcomCalendar.ts # Advisory committee calendar
│   ├── federalRegister.ts # Federal Register API
│   ├── secEdgar.ts       # SEC EDGAR submissions
│   ├── companyRSS.ts     # Company RSS feeds
│   ├── cderWhatsNew.ts   # CDER updates
│   ├── dailymed.ts       # DailyMed RSS
│   ├── orangePurple.ts   # Orange/Purple Book
│   └── index.ts          # Source registry
├── merge.ts              # Deduplication and scoring logic
├── ingest.ts             # Main orchestration engine
└── index.ts              # Public API exports
```

## 🛠️ Usage

### Basic Usage

```typescript
import { runIngest } from './pdufa/ingest';

// Run with default settings
const result = await runIngest();

console.log(`Found ${result.items.length} items`);
console.log(`Raw: ${result.rawCount}, Deduplicated: ${result.dedupedCount}`);
```

### Advanced Usage with Watchlist

```typescript
import { runIngest, RunArgs } from './pdufa/ingest';

const args: RunArgs = {
  tickers: ['PFE', 'BMY', 'JNJ', 'MRK'],
  ciks: ['0000078003', '0000014274'], // Pfizer, Bristol Myers
  keywords: ['pdufa', 'target action', 'advisory committee'],
  feeds: {
    BMY: 'https://news.bms.com/cpress/rss/index.xml',
    PFE: 'https://www.pfizer.com/news/press-releases/rss.xml'
  }
};

const result = await runIngest(args);
```

### Integration with UI

```typescript
import { enhancedPdufaAPI } from '@/api/enhanced-pdufa-api';

// Get all PDUFA data
const response = await enhancedPdufaAPI.getAllPDUFAs();

// Get upcoming PDUFAs
const upcoming = await enhancedPdufaAPI.getUpcomingPDUFAs(30);

// Search by ticker
const pfizerData = await enhancedPdufaAPI.getPDUFAsByTicker('PFE');
```

## 🔧 Configuration

### Environment Variables

```bash
# Optional: Custom user agent for requests
PDUFA_USER_AGENT="somatech-pdufa/1.0"

# Optional: Request timeout (default: 30s)
PDUFA_TIMEOUT=30000
```

### Source Configuration

Sources can be enabled/disabled and weighted in `sources/index.ts`:

```typescript
export const SOURCES: SourceDef[] = [
  fdaPress,           // enabled: true, weight: 0.9
  fdaAdcomCalendar,   // enabled: true, weight: 0.85
  // ... other sources
  orangeBook,         // enabled: false (nightly only)
  purpleBook,         // enabled: false (nightly only)
];
```

## 📈 Data Processing Pipeline

1. **Ingestion**: Fetch data from all enabled sources in parallel
2. **Parsing**: Extract structured data from HTML, XML, and JSON
3. **Normalization**: Standardize data formats and fields
4. **Deduplication**: Merge duplicate items using stable hashing
5. **Scoring**: Calculate confidence scores based on source weight and corroboration
6. **Sorting**: Order by event date and relevance

## 🎯 Decision Type Detection

The system automatically categorizes items into decision types:

- **`pdufa`**: PDUFA target action dates
- **`adcom`**: Advisory committee meetings
- **`approval`**: Drug approvals and licenses
- **`crl`**: Complete Response Letters
- **`other`**: General regulatory updates

## 🔍 Confidence Scoring

Confidence scores are calculated based on:

- **Source Weight**: Base reliability of the data source
- **Corroboration Bonus**: Additional confidence for items found in multiple sources
- **Data Quality**: Completeness and accuracy of extracted data

Formula: `min(1.0, sourceWeight + (0.1 * (distinctSources - 1)))`

## 🚨 Error Handling

- **Graceful Degradation**: System continues if individual sources fail
- **Retry Logic**: Automatic retries for transient failures
- **Caching**: Fallback to cached data when sources are unavailable
- **Logging**: Comprehensive error logging for debugging

## 🧪 Testing

The system includes a test interface accessible via the PDUFA page:

1. Navigate to the PDUFA module
2. Click on the "Scanner Test" tab
3. Click "Run Scanner" to test the ingestion system
4. View real-time results and source breakdown

## 🔮 Future Enhancements

- **Machine Learning**: AI-powered drug name and indication extraction
- **Sentiment Analysis**: Analyze regulatory sentiment and market impact
- **Predictive Modeling**: Predict approval probabilities based on historical data
- **Real-Time Alerts**: Push notifications for critical regulatory events
- **API Integration**: RESTful API for external integrations

## 📝 Dependencies

```json
{
  "fast-xml-parser": "^4.3.2",
  "cheerio": "^1.0.0-rc.12",
  "zod": "^3.22.4"
}
```

## 🤝 Contributing

1. Add new data sources in `sources/`
2. Implement the `SourceDef` interface
3. Add to the `SOURCES` registry
4. Update tests and documentation

## 📄 License

This implementation is part of the SomaTech platform and follows the same licensing terms.
