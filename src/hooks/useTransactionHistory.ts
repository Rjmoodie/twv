/**
 * useTransactionHistory
 *
 * Fetches Plaid transactions for a user-selected time period.
 * Re-fetches automatically when `period` changes.
 *
 * Separate from useTransactions (which is optimised for the current month +
 * 90-day recurring detection window) so the analysis view can go further back
 * without inflating the data used by insight cards.
 *
 * Edge cases:
 *   - Unauthenticated → empty immediately
 *   - No transactions yet → empty, no error
 *   - Period 'ALL' → no lower date bound (fetches everything)
 *   - Re-fetch on period change debounced by React's render cycle (no extra logic needed)
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';
import { subMonths, format } from 'date-fns';
import type { PlaidTransaction } from '@/hooks/useTransactions';

export type TransactionPeriod = '1M' | '3M' | '6M' | 'ALL';

interface UseTransactionHistoryReturn {
  transactions: PlaidTransaction[];
  isLoading:    boolean;
  error:        string | null;
  refresh:      () => void;
}

function periodStartDate(period: TransactionPeriod): string | null {
  if (period === 'ALL') return null;
  const months = period === '1M' ? 1 : period === '3M' ? 3 : 6;
  return format(subMonths(new Date(), months), 'yyyy-MM-dd');
}

export function useTransactionHistory(period: TransactionPeriod): UseTransactionHistoryReturn {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<PlaidTransaction[]>([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    let query = supabase
      .from('plaid_transactions')
      .select('transaction_id,account_id,item_id,merchant_name,name,amount,date,category_key,plaid_category,pending')
      .eq('user_id', user.id)
      .eq('pending', false)
      .gt('amount', 0)           // debits only — income/refunds excluded from spending analysis
      .order('date', { ascending: false });

    const start = periodStartDate(period);
    if (start) query = query.gte('date', start);

    const { data, error: err } = await query;

    // 404 means the table doesn't exist yet (migration not applied) — fail silently
    const isTableMissing = err != null &&
      (err.code === '42P01' || (err as any).status === 404 || err.message?.includes('does not exist'));

    if (isTableMissing) {
      // noop — leave array empty
    } else if (err) {
      setError(err.message);
    } else {
      setTransactions((data ?? []) as PlaidTransaction[]);
    }

    setIsLoading(false);
  }, [user, period]);

  useEffect(() => { load(); }, [load]);

  return { transactions, isLoading, error, refresh: load };
}
