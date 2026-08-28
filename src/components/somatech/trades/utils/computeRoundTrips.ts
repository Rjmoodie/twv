import { Trade } from '../context/TradesProvider';

export interface RoundTrip {
  id: string;
  ticker: string;
  /** 'long' = bought first then sold; 'short' = sold first then covered */
  position: 'long' | 'short';
  entryTime: string;
  exitTime: string;
  /** Number of shares matched in this round trip */
  size: number;
  entryPrice: number;
  exitPrice: number;
  profitLoss: number;
  strategy: string;
}

interface Lot {
  orderId: string;
  qty: number;   // always > 0; stored as integer units (×10^8) to avoid float drift
  price: number;
  time: string;
  strategy: string;
}

// Work in integer units of 1e-8 to avoid float accumulation errors.
// Alpaca fills are quoted to 8 decimal places for crypto, 4 for equities.
const SCALE = 1e8;
const toInt = (n: number) => Math.round(n * SCALE);
const fromInt = (n: number) => n / SCALE;

/**
 * Pairs individual filled orders into round-trip trades using FIFO matching.
 *
 * Handles both long (buy → sell) and short (sell → cover-buy) positions.
 * Unpaired lots (open positions / incomplete history) are excluded.
 * Floating-point drift is eliminated by scaling quantities to integers.
 */
export function computeRoundTrips(orders: Trade[]): RoundTrip[] {
  // Discard orders with no fill data
  const valid = orders.filter(
    (o) => o.filled_at && o.filled_avg_price != null && o.qty > 0
  );

  // Sort chronologically — the FIFO algorithm depends on order of arrival
  const sorted = [...valid].sort(
    (a, b) => new Date(a.filled_at!).getTime() - new Date(b.filled_at!).getTime()
  );

  const results: RoundTrip[] = [];

  // Per-ticker queues for both position directions
  const longBuys  = new Map<string, Lot[]>(); // open long lots (buys awaiting a sell)
  const shortSells = new Map<string, Lot[]>(); // open short lots (sells awaiting a cover)

  for (const order of sorted) {
    const ticker = order.ticker;
    const price   = order.filled_avg_price!;
    const qtyInt  = toInt(order.qty);
    const strategy = order.strategy ?? 'Untagged';
    const time     = order.filled_at!;

    if (order.side === 'buy') {
      // ── Try to close an existing short position first ──────────────────
      const shorts = shortSells.get(ticker);
      if (shorts?.length) {
        let remainingInt = qtyInt;

        while (remainingInt > 0 && shorts.length) {
          const short = shorts[0];
          const matchInt = Math.min(remainingInt, short.qty);

          results.push({
            id:         `${short.orderId}-${order.id}`,
            ticker,
            position:   'short',
            entryTime:  short.time,  // short opened at the sell time
            exitTime:   time,        // short closed at the cover-buy time
            size:       fromInt(matchInt),
            entryPrice: short.price,
            exitPrice:  price,
            // P&L for short: sold high, bought low = profit
            profitLoss: (short.price - price) * fromInt(matchInt),
            strategy:   strategy !== 'Untagged' ? strategy : short.strategy,
          });

          short.qty   -= matchInt;
          remainingInt -= matchInt;
          if (short.qty <= 0) shorts.shift();
        }

        if (shorts.length === 0) shortSells.delete(ticker);

        // Any leftover buy qty opens a new long lot
        if (remainingInt > 0) {
          const buys = longBuys.get(ticker) ?? [];
          buys.push({ orderId: order.id, qty: remainingInt, price, time, strategy });
          longBuys.set(ticker, buys);
        }
      } else {
        // No open short — add to long queue
        const buys = longBuys.get(ticker) ?? [];
        buys.push({ orderId: order.id, qty: qtyInt, price, time, strategy });
        longBuys.set(ticker, buys);
      }
    } else {
      // side === 'sell'
      // ── Try to close an existing long position first ───────────────────
      const buys = longBuys.get(ticker);
      if (buys?.length) {
        let remainingInt = qtyInt;

        while (remainingInt > 0 && buys.length) {
          const buy = buys[0];
          const matchInt = Math.min(remainingInt, buy.qty);

          results.push({
            id:         `${buy.orderId}-${order.id}`,
            ticker,
            position:   'long',
            entryTime:  buy.time,
            exitTime:   time,
            size:       fromInt(matchInt),
            entryPrice: buy.price,
            exitPrice:  price,
            profitLoss: (price - buy.price) * fromInt(matchInt),
            strategy:   strategy !== 'Untagged' ? strategy : buy.strategy,
          });

          buy.qty      -= matchInt;
          remainingInt  -= matchInt;
          if (buy.qty <= 0) buys.shift();
        }

        if (buys.length === 0) longBuys.delete(ticker);

        // Any leftover sell qty opens a new short lot
        if (remainingInt > 0) {
          const shorts = shortSells.get(ticker) ?? [];
          shorts.push({ orderId: order.id, qty: remainingInt, price, time, strategy });
          shortSells.set(ticker, shorts);
        }
      } else {
        // No open long — this is a new short position
        const shorts = shortSells.get(ticker) ?? [];
        shorts.push({ orderId: order.id, qty: qtyInt, price, time, strategy });
        shortSells.set(ticker, shorts);
      }
    }
  }

  // Sort descending by exit time for display
  return results.sort(
    (a, b) => new Date(b.exitTime).getTime() - new Date(a.exitTime).getTime()
  );
}
