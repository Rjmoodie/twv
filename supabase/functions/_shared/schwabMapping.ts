export interface CanonicalPosition {
  instrument_id: string;
  symbol: string | null;
  asset_type: string;
  description: string | null;
  cusip: string | null;
  quantity: string;
  long_short: 'long' | 'short';
  average_price: string | null;
  cost_basis: string | null;
  market_price: string | null;
  market_value: string | null;
  currency: string;
}

export interface CanonicalExecution {
  provider_execution_id: string;
  provider_order_id: string;
  provider_leg_id: string;
  instrument_id: string | null;
  symbol: string | null;
  asset_type: string;
  side: 'buy' | 'sell';
  quantity: string;
  price: string | null;
  gross_amount: string | null;
  fees: string | null;
  net_amount: string | null;
  currency: string;
  executed_at: string;
  settled_at: string | null;
}

export interface MappingResult<T> {
  values: T[];
  quarantined: { reason: string; payload: Record<string, unknown> }[];
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : value != null && String(value).trim() ? String(value).trim() : null;
const decimal = (value: unknown): string | null => {
  const raw = text(value);
  if (!raw || !/^-?\d+(\.\d+)?$/.test(raw)) return null;
  return raw;
};
const positiveDecimal = (value: unknown): string | null => {
  const raw = decimal(value);
  return raw !== null && Number(raw) > 0 ? raw : null;
};
const iso = (value: unknown): string | null => {
  const raw = text(value);
  return raw && Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : null;
};

export function securitiesAccount(payload: Record<string, unknown>): Record<string, unknown> | null {
  return record(payload.securitiesAccount) ?? record(record(payload.account)?.securitiesAccount);
}

export function normalizePositions(payload: Record<string, unknown>): MappingResult<CanonicalPosition> {
  const values: CanonicalPosition[] = [];
  const quarantined: MappingResult<CanonicalPosition>['quarantined'] = [];
  const account = securitiesAccount(payload);
  if (!account) return { values, quarantined: [{ reason: 'missing_securities_account', payload }] };
  const rawPositions = account.positions;
  if (rawPositions !== undefined && !Array.isArray(rawPositions)) {
    return { values, quarantined: [{ reason: 'positions_not_array', payload: account }] };
  }

  for (const raw of (rawPositions ?? []) as unknown[]) {
    const position = record(raw);
    const instrument = record(position?.instrument);
    if (!position || !instrument) {
      quarantined.push({ reason: 'malformed_position', payload: record(raw) ?? {} });
      continue;
    }
    const longQty = decimal(position.longQuantity) ?? '0';
    const shortQty = decimal(position.shortQuantity) ?? '0';
    const long = Number(longQty);
    const short = Number(shortQty);
    if (!Number.isFinite(long) || !Number.isFinite(short) || (long <= 0 && short <= 0)) continue;
    const quantity = long > 0 ? longQty : shortQty;
    const symbol = text(instrument.symbol)?.toUpperCase() ?? null;
    const instrumentId = text(instrument.instrumentId) ?? text(instrument.cusip) ?? symbol;
    if (!instrumentId) {
      quarantined.push({ reason: 'position_missing_instrument_identity', payload: position });
      continue;
    }
    const average = decimal(long > 0
      ? position.averageLongPrice ?? position.taxLotAverageLongPrice ?? position.averagePrice
      : position.averageShortPrice ?? position.taxLotAverageShortPrice ?? position.averagePrice);
    const marketValue = decimal(position.marketValue);
    const absoluteQuantity = Math.abs(Number(quantity));
    const marketPrice = marketValue !== null && absoluteQuantity > 0
      ? String(Math.abs(Number(marketValue)) / absoluteQuantity)
      : decimal(instrument.marketPrice);
    values.push({
      instrument_id: instrumentId,
      symbol,
      asset_type: text(instrument.assetType)?.toUpperCase() ?? 'UNKNOWN',
      description: text(instrument.description),
      cusip: text(instrument.cusip),
      quantity: String(Math.abs(Number(quantity))),
      long_short: long > 0 ? 'long' : 'short',
      average_price: average,
      cost_basis: average === null ? null : String(Math.abs(Number(quantity)) * Number(average)),
      market_price: marketPrice,
      market_value: marketValue,
      currency: text(position.currency)?.toUpperCase() ?? 'USD',
    });
  }
  return { values, quarantined };
}

function instructionSide(value: unknown): 'buy' | 'sell' | null {
  const instruction = text(value)?.toUpperCase();
  if (!instruction) return null;
  if (instruction.startsWith('BUY')) return 'buy';
  if (instruction.startsWith('SELL')) return 'sell';
  return null;
}

export function normalizeFilledOrders(rawOrders: unknown[]): MappingResult<CanonicalExecution> {
  const values: CanonicalExecution[] = [];
  const quarantined: MappingResult<CanonicalExecution>['quarantined'] = [];

  const flattened: unknown[] = [];
  const visit = (raw: unknown) => {
    flattened.push(raw);
    const order = record(raw);
    if (Array.isArray(order?.childOrderStrategies)) order.childOrderStrategies.forEach(visit);
  };
  rawOrders.forEach(visit);

  for (const rawOrder of flattened) {
    const order = record(rawOrder);
    const orderId = text(order?.orderId);
    const legs = Array.isArray(order?.orderLegCollection) ? order!.orderLegCollection as unknown[] : [];
    const activities = Array.isArray(order?.orderActivityCollection) ? order!.orderActivityCollection as unknown[] : [];
    if (!order || !orderId) {
      quarantined.push({ reason: 'order_missing_identity', payload: order ?? {} });
      continue;
    }
    const legsById = new Map<string, Record<string, unknown>>();
    for (const rawLeg of legs) {
      const leg = record(rawLeg);
      const legId = text(leg?.legId);
      if (leg && legId) legsById.set(legId, leg);
    }

    for (const rawActivity of activities) {
      const activity = record(rawActivity);
      if (!activity || text(activity.executionType)?.toUpperCase() !== 'FILL') continue;
      const executionLegs = Array.isArray(activity.executionLegs) ? activity.executionLegs as unknown[] : [];
      for (const rawExecution of executionLegs) {
        const execution = record(rawExecution);
        const legId = text(execution?.legId) ?? '';
        const leg = legsById.get(legId) ?? (legs.length === 1 ? record(legs[0]) : null);
        const instrument = record(leg?.instrument);
        const quantity = positiveDecimal(execution?.quantity ?? activity.quantity);
        const price = decimal(execution?.price);
        const executedAt = iso(execution?.time ?? activity.executionTime ?? order.closeTime ?? order.enteredTime);
        const side = instructionSide(leg?.instruction);
        if (!execution || !leg || !quantity || !executedAt || !side) {
          quarantined.push({ reason: 'unsupported_or_malformed_fill', payload: { orderId, activity, execution: execution ?? {} } });
          continue;
        }
        const symbol = text(instrument?.symbol)?.toUpperCase() ?? null;
        const instrumentId = text(instrument?.instrumentId) ?? text(instrument?.cusip) ?? symbol;
        const providerExecutionId = text(execution.executionId)
          ?? `${orderId}:${legId}:${executedAt}:${quantity}:${price ?? 'unknown'}`;
        const gross = price === null ? null : String(Number(quantity) * Number(price));
        values.push({
          provider_execution_id: providerExecutionId,
          provider_order_id: orderId,
          provider_leg_id: legId,
          instrument_id: instrumentId,
          symbol,
          asset_type: text(instrument?.assetType)?.toUpperCase() ?? 'UNKNOWN',
          side,
          quantity,
          price,
          gross_amount: gross,
          fees: null,
          net_amount: gross === null ? null : String((side === 'buy' ? -1 : 1) * Number(gross)),
          currency: 'USD',
          executed_at: executedAt,
          settled_at: null,
        });
      }
    }
  }
  return { values, quarantined };
}

export function isCompleteAccountSnapshot(payload: Record<string, unknown>, positionCount: number): boolean {
  const account = securitiesAccount(payload);
  const balances = record(account?.currentBalances);
  if (!account || !balances) return false;
  if (Array.isArray(account.positions)) return true;
  if (positionCount > 0) return true;
  const longMarket = Number(decimal(balances.longMarketValue) ?? '0');
  const shortMarket = Number(decimal(balances.shortMarketValue) ?? '0');
  return longMarket === 0 && shortMarket === 0;
}

export function accountBalances(payload: Record<string, unknown>) {
  const account = securitiesAccount(payload);
  const balances = record(account?.currentBalances) ?? {};
  return {
    account_type: text(account?.type),
    liquidation_value: decimal(balances.liquidationValue),
    cash_balance: decimal(balances.cashBalance ?? balances.cashAvailableForTrading),
    buying_power: decimal(balances.buyingPower ?? balances.buyingPowerNonMarginableTrade),
    long_market_value: decimal(balances.longMarketValue),
    short_market_value: decimal(balances.shortMarketValue),
  };
}

const SENSITIVE_KEYS = /token|secret|accountnumber|hashvalue|authorization|code/i;

export function sanitizeBrokerPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeBrokerPayload);
  const input = record(value);
  if (!input) return value;
  return Object.fromEntries(Object.entries(input).map(([key, child]) => [
    key,
    SENSITIVE_KEYS.test(key) ? '[REDACTED]' : sanitizeBrokerPayload(child),
  ]));
}

export function inferredBucket(assetType: string): { bucket: string; source: 'inferred' } {
  const type = assetType.toUpperCase();
  if (type.includes('CASH')) return { bucket: 'CASH', source: 'inferred' };
  if (type.includes('BOND') || type.includes('FIXED')) return { bucket: 'FIXED_INCOME_INVESTMENT_GRADE', source: 'inferred' };
  return { bucket: 'US_EQUITY_LARGE', source: 'inferred' };
}
