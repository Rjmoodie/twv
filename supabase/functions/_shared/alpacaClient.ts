/**
 * Typed Alpaca REST API client for Supabase Edge Functions.
 * Handles auth headers, base URL selection (paper vs live), and error unwrapping.
 */

export type AlpacaEnv = 'paper' | 'live'

const BASE: Record<AlpacaEnv, string> = {
  paper: 'https://paper-api.alpaca.markets',
  live:  'https://api.alpaca.markets',
}
const DATA_BASE = 'https://data.alpaca.markets'

export interface AlpacaAccount {
  id: string
  account_number: string
  status: string
  account_blocked: boolean
  trading_blocked: boolean
  equity: string
  cash: string
  portfolio_value: string
  buying_power: string
  pattern_day_trader: boolean
  daytrade_count: number
  account_type?: string
}

export interface AlpacaPosition {
  asset_id: string
  symbol: string
  exchange: string
  asset_class: string
  qty: string
  qty_available: string
  avg_entry_price: string
  side: 'long' | 'short'
  market_value: string
  cost_basis: string
  unrealized_pl: string
  unrealized_plpc: string
  current_price: string
  lastday_price: string
  change_today: string
}

export interface AlpacaOrder {
  id: string
  client_order_id: string
  symbol: string
  side: 'buy' | 'sell'
  type: string
  qty?: string
  notional?: string
  status: string
  filled_qty: string
  filled_avg_price?: string
  submitted_at: string
  filled_at?: string
  created_at: string
}

export interface PlaceOrderParams {
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  time_in_force: 'day' | 'gtc' | 'ioc' | 'fok'
  qty?: string
  notional?: string      // dollar amount for fractional shares
  limit_price?: string
}

export class AlpacaClient {
  private headers: Record<string, string>
  private base: string

  constructor(apiKey: string, apiSecret: string, env: AlpacaEnv = 'paper') {
    this.headers = {
      'APCA-API-KEY-ID':     apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
      'Content-Type':        'application/json',
    }
    this.base = BASE[env]
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Alpaca ${method} ${path} → ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  }

  getAccount(): Promise<AlpacaAccount> {
    return this.request<AlpacaAccount>('GET', '/v2/account')
  }

  listPositions(): Promise<AlpacaPosition[]> {
    return this.request<AlpacaPosition[]>('GET', '/v2/positions')
  }

  getPosition(symbol: string): Promise<AlpacaPosition> {
    return this.request<AlpacaPosition>('GET', `/v2/positions/${symbol}`)
  }

  placeOrder(params: PlaceOrderParams): Promise<AlpacaOrder> {
    return this.request<AlpacaOrder>('POST', '/v2/orders', params)
  }

  cancelOrder(orderId: string): Promise<void> {
    return this.request<void>('DELETE', `/v2/orders/${orderId}`)
  }

  getOrder(orderId: string): Promise<AlpacaOrder> {
    return this.request<AlpacaOrder>('GET', `/v2/orders/${orderId}`)
  }

  // Fetch latest bar prices for a list of symbols
  async getLatestPrices(symbols: string[]): Promise<Record<string, number>> {
    if (symbols.length === 0) return {}
    const qs  = symbols.map((s) => `symbols=${encodeURIComponent(s)}`).join('&')
    const res = await fetch(`${DATA_BASE}/v2/stocks/bars/latest?${qs}&feed=iex`, {
      headers: this.headers,
    })
    if (!res.ok) return {}
    const json = (await res.json()) as { bars: Record<string, { c: number }> }
    const prices: Record<string, number> = {}
    for (const [sym, bar] of Object.entries(json.bars ?? {})) {
      prices[sym] = bar.c
    }
    return prices
  }

  // Check if US market is open
  async isMarketOpen(): Promise<boolean> {
    const clock = await this.request<{ is_open: boolean }>('GET', '/v2/clock')
    return clock.is_open
  }
}
