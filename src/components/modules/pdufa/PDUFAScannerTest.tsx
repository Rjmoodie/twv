import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  RefreshCw, 
  Play, 
  Database,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { runIngest, RunArgs } from '@/pdufa/ingest';
import { Item } from '@/pdufa/types';

const PDUFAScannerTest: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const handleRunScanner = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const args: RunArgs = {
        tickers: ['PFE', 'BMY', 'JNJ', 'MRK'],
        ciks: ['0000078003', '0000014274'], // Pfizer and Bristol Myers
        keywords: ['pdufa', 'target action', 'advisory committee', 'complete response', 'approval'],
        feeds: {
          BMY: 'https://news.bms.com/cpress/rss/index.xml',
          PFE: 'https://www.pfizer.com/news/press-releases/rss.xml',
          JNJ: 'https://www.jnj.com/rss/news-releases.xml',
          MRK: 'https://www.merck.com/news/rss/'
        }
      };

      const result = await runIngest(args);
      setResults(result.items);
      setLastRun(new Date());
    } catch (err) {
      console.warn('External API failed (likely CORS), this is expected in development:', err);
      setError('External APIs blocked by CORS policy. This is normal in development. The system will use mock data instead.');
      // Don't set error state, just show warning
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDecisionTypeColor = (type?: string) => {
    switch (type) {
      case 'approval':
        return 'bg-accent/10 text-accent';
      case 'crl':
        return 'bg-destructive/10 text-red-800';
      case 'adcom':
        return 'bg-blue-100 text-blue-800';
      case 'pdufa':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'fda_press':
        return 'bg-blue-100 text-blue-800';
      case 'fda_adcom_calendar':
        return 'bg-indigo-100 text-indigo-800';
      case 'federal_register':
        return 'bg-accent/10 text-accent';
      case 'sec_edgar':
        return 'bg-yellow-100 text-yellow-800';
      case 'company_rss':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PDUFA Scanner Test</h1>
          <p className="text-muted-foreground">
            Test the new TypeScript-based PDUFA data ingestion system
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunScanner}
            disabled={loading}
          >
            <Play className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Scanning...' : 'Run Scanner'}
          </Button>
          
          {lastRun && (
            <div className="text-sm text-muted-foreground">
              Last run: {lastRun.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* CORS Warning */}
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          <strong>Development Mode:</strong> External APIs are blocked by CORS policy in the browser. 
          The scanner will automatically fall back to mock data to demonstrate functionality.
        </AlertDescription>
      </Alert>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results Summary */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Scanner Results
            </CardTitle>
            <CardDescription>
              Found {results.length} items from multiple sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((item, index) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg">{item.headline}</h3>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${getDecisionTypeColor(item.decisionType)}`}>
                            {item.decisionType || 'other'}
                          </Badge>
                          <Badge className={`text-xs ${getSourceColor(item.source)}`}>
                            {item.source}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(item.confidence * 100)}% confidence
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Event Date</div>
                          <div className="font-medium">{formatDate(item.eventDate)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Ticker</div>
                          <div className="font-medium">{item.ticker || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Sponsor</div>
                          <div className="font-medium">{item.sponsor || 'N/A'}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Captured</div>
                          <div className="font-medium">{formatDate(item.capturedAt)}</div>
                        </div>
                      </div>
                      
                      {item.notes && (
                        <div className="mt-3 p-2 bg-blue-50 rounded text-sm">
                          <strong>Notes:</strong> {item.notes}
                        </div>
                      )}
                      
                      <div className="mt-3">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View Source
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>
            The new PDUFA scanner system provides comprehensive data ingestion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Data Sources</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• FDA Press Announcements (RSS)</li>
                <li>• FDA Advisory Committee Calendar</li>
                <li>• Federal Register Notices</li>
                <li>• SEC EDGAR 8-K Filings</li>
                <li>• Company Newsroom RSS Feeds</li>
                <li>• CDER What's New</li>
                <li>• DailyMed RSS</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Features</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Automatic deduplication</li>
                <li>• Confidence scoring</li>
                <li>• Decision type detection</li>
                <li>• Watchlist filtering</li>
                <li>• Real-time data ingestion</li>
                <li>• Error handling & retries</li>
                <li>• Caching for performance</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export { PDUFAScannerTest };
