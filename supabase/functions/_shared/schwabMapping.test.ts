import { describe, expect, it } from 'vitest';
import {
  isCompleteAccountSnapshot,
  normalizeFilledOrders,
  normalizePositions,
  sanitizeBrokerPayload,
} from './schwabMapping.ts';

describe('schwab position normalization', () => {
  it('normalizes a long equity position without using ticker as the only identity', () => {
    const payload = { securitiesAccount: { currentBalances: { longMarketValue: 210 }, positions: [{
      longQuantity: 2, shortQuantity: 0, averageLongPrice: 90, marketValue: 210,
      instrument: { instrumentId: 42, cusip: 'CUSIP', symbol: 'abc', assetType: 'EQUITY', description: 'ABC Inc' },
    }] } };
    const result = normalizePositions(payload);
    expect(result.quarantined.length).toBe(0);
    expect(result.values[0].instrument_id).toBe('42');
    expect(result.values[0].symbol).toBe('ABC');
    expect(result.values[0].cost_basis).toBe('180');
    expect(isCompleteAccountSnapshot(payload, result.values.length)).toBe(true);
  });

  it('treats a zero-balance empty account as complete but preserves positions on contradictory emptiness', () => {
    const empty = { securitiesAccount: { currentBalances: { longMarketValue: 0, shortMarketValue: 0 }, positions: [] } };
    expect(isCompleteAccountSnapshot(empty, 0)).toBe(true);
    expect(
      isCompleteAccountSnapshot({ securitiesAccount: { currentBalances: { longMarketValue: 100 }, positions: null } }, 0),
    ).toBe(false);
  });
});

describe('schwab fill normalization', () => {
  it('maps partial fills independently and keeps their execution identities', () => {
    const result = normalizeFilledOrders([{
      orderId: 77,
      orderLegCollection: [{ legId: 1, instruction: 'SELL', instrument: { symbol: 'XYZ', assetType: 'EQUITY', instrumentId: 9 } }],
      orderActivityCollection: [{ executionType: 'FILL', executionLegs: [
        { executionId: 'fill-1', legId: 1, quantity: 2, price: 11.5, time: '2026-08-27T14:30:00Z' },
        { executionId: 'fill-2', legId: 1, quantity: 1, price: 11.75, time: '2026-08-27T14:31:00Z' },
      ] }],
    }]);
    expect(result.values.map(value => value.provider_execution_id)).toEqual(['fill-1', 'fill-2']);
    expect(result.values.map(value => value.gross_amount)).toEqual(['23', '11.75']);
  });

  it('walks child orders and records buys as negative cash flow', () => {
    const result = normalizeFilledOrders([{ orderId: 'parent', childOrderStrategies: [{
      orderId: 'child',
      orderLegCollection: [{ legId: 1, instruction: 'BUY_TO_OPEN', instrument: { symbol: 'ABC', assetType: 'EQUITY' } }],
      orderActivityCollection: [{ executionType: 'FILL', executionLegs: [{ executionId: 'child-fill', legId: 1, quantity: 3, price: 5, time: '2026-08-27T14:30:00Z' }] }],
    }] }]);
    expect(result.values.length).toBe(1);
    expect(result.values[0].provider_order_id).toBe('child');
    expect(result.values[0].net_amount).toBe('-15');
  });

  it('quarantines malformed fills and redacts provider secrets', () => {
    const result = normalizeFilledOrders([{ orderId: 1, orderActivityCollection: [{ executionType: 'FILL', executionLegs: [{}] }] }]);
    expect(result.values.length).toBe(0);
    expect(result.quarantined[0].reason).toBe('unsupported_or_malformed_fill');
    expect(sanitizeBrokerPayload({ accountNumber: '123', nested: { access_token: 'secret', safe: 1 } })).toEqual({
      accountNumber: '[REDACTED]', nested: { access_token: '[REDACTED]', safe: 1 },
    });
  });
});
