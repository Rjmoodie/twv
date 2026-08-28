import { describe, expect, it } from 'vitest';
import { alphaVantageNewsTimestamp, normalizeCompanyNews } from './companyNews.ts';

describe('company news normalization', () => {
  it('keeps only safe, ticker-relevant articles and normalizes provider time', () => {
    const rows = normalizeCompanyNews({ feed: [{
      title: 'Apple reports results', url: 'https://example.com/apple', time_published: '20260827T141500',
      source: 'Example News', summary: 'Filed results and context.', banner_image: 'javascript:alert(1)',
      topics: [{ topic: 'Earnings' }], ticker_sentiment: [{ ticker: 'AAPL', relevance_score: '0.91', ticker_sentiment_score: '0.22', ticker_sentiment_label: 'Somewhat-Bullish' }],
    }, {
      title: 'Other company', url: 'https://example.com/other', time_published: '20260827T130000',
      ticker_sentiment: [{ ticker: 'MSFT', relevance_score: '0.9' }],
    }] }, 'aapl');
    expect(rows).toEqual([expect.objectContaining({
      title: 'Apple reports results', publishedAt: '2026-08-27T14:15:00Z', relevanceScore: 0.91,
      sentimentScore: 0.22, imageUrl: null, topics: ['Earnings'],
    })]);
  });

  it('rejects impossible provider publication dates', () => {
    expect(alphaVantageNewsTimestamp('20260230T120000')).toBeNull();
  });

  it('rejects impossible provider timestamps', () => {
    expect(alphaVantageNewsTimestamp('20261399T999999')).toBeNull();
  });
});
