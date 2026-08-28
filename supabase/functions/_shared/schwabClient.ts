const TRADER_BASE = 'https://api.schwabapi.com/trader/v1';
const MARKET_DATA_BASE = 'https://api.schwabapi.com/marketdata/v1';

export class SchwabApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfterSeconds: number | null,
    public readonly requestId: string | null,
  ) {
    super(`Schwab request failed with status ${status}`);
    this.name = 'SchwabApiError';
  }
}

export interface SchwabAccountNumber {
  accountNumber: string;
  hashValue: string;
}

export class SchwabReadOnlyClient {
  constructor(private readonly accessToken: string) {}

  private async get<T>(base: string, path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(`${base}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accessToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const rawRetry = response.headers.get('retry-after');
      const retryAfter = rawRetry && /^\d+$/.test(rawRetry) ? Number(rawRetry) : null;
      throw new SchwabApiError(
        response.status,
        retryAfter,
        response.headers.get('x-request-id') ?? response.headers.get('request-id'),
      );
    }
    return response.json() as Promise<T>;
  }

  listAccountNumbers(): Promise<SchwabAccountNumber[]> {
    return this.get(TRADER_BASE, '/accounts/accountNumbers');
  }

  getAccount(accountHash: string): Promise<Record<string, unknown>> {
    return this.get(TRADER_BASE, `/accounts/${encodeURIComponent(accountHash)}`, { fields: 'positions' });
  }

  listFilledOrders(accountHash: string, from: string, to: string): Promise<Record<string, unknown>[]> {
    return this.get(TRADER_BASE, `/accounts/${encodeURIComponent(accountHash)}/orders`, {
      fromEnteredTime: from,
      toEnteredTime: to,
      maxResults: 3000,
      status: 'FILLED',
    });
  }

  getQuotes(symbols: string[]): Promise<Record<string, unknown>> {
    if (!symbols.length) return Promise.resolve({});
    return this.get(MARKET_DATA_BASE, '/quotes', {
      symbols: symbols.join(','),
      fields: 'quote,reference',
      indicative: false,
    });
  }
}
