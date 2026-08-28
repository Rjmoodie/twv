export interface MarketData {
  sp500: number | null;
  nasdaq: number | null;
  dow: number | null;
  vix: number | null;
  change: {
    sp500: number | null;
    nasdaq: number | null;
    dow: number | null;
    vix: number | null;
  };
  updatedAt?: string;
  asOf: {
    sp500: string | null;
    nasdaq: string | null;
    dow: string | null;
    vix: string | null;
  };
  stale: {
    sp500: boolean;
    nasdaq: boolean;
    dow: boolean;
    vix: boolean;
  };
  warning?: string;
}

// Retained for the standalone news renderer; the dashboard does not fabricate
// news when no provider-backed feed is available.
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  timestamp: string;
  source: string;
  url?: string;
}
