/**
 * useTransactions
 *
 * Fetches the user's persisted Plaid transactions from Supabase.
 * Returns two windows:
 *   - transactions: current calendar month (for spending breakdown UI)
 *   - allTransactions: last 90 days (for recurring charge detection)
 *
 * Edge cases:
 *   - Unauthenticated → returns empty arrays immediately
 *   - No Plaid connection → returns empty arrays (no error surfaced)
 *   - Network failure → error surfaced, empty arrays returned
 *   - Pending transactions included — caller decides whether to show them
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/app/AuthProvider';
import { startOfMonth, subDays, format } from 'date-fns';

export interface PlaidTransaction {
  transaction_id: string;
  account_id:     string;
  item_id:        string;
  merchant_name:  string | null;
  name:           string;
  amount:         number;       // positive = money out
  date:           string;       // 'YYYY-MM-DD'
  category_key:   string | null;
  plaid_category: string | null;
  pending:        boolean;
}

interface UseTransactionsReturn {
  /** Current calendar month — drives the SpendingBreakdown UI */
  transactions:    PlaidTransaction[];
  /** Last 90 days — drives recurring charge detection */
  allTransactions: PlaidTransaction[];
  isLoading:       boolean;
  error:           string | null;
  refresh:         () => void;
}

export function useTransactions(): UseTransactionsReturn {
  const { user } = useAuth();
  const [transactions,    setTransactions]    = useState<PlaidTransaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<PlaidTransaction[]>([]);
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [dataUserId,      setDataUserId]      = useState<string | null>(null);
  const requestSequence = useRef(0);
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    const sequence = ++requestSequence.current;
    if (!userId) {
      setTransactions([]);
      setAllTransactions([]);
      setError(null);
      setDataUserId(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
    const ninetyDaysAgo = format(subDays(new Date(), 90), 'yyyy-MM-dd');

    const [monthRes, allRes] = await Promise.all([
      supabase
        .from('plaid_transactions')
        .select('transaction_id,account_id,item_id,merchant_name,name,amount,date,category_key,plaid_category,pending')
        .eq('user_id', userId)
        .gte('date', monthStart)
        .order('date', { ascending: false }),
      supabase
        .from('plaid_transactions')
        .select('transaction_id,account_id,item_id,merchant_name,name,amount,date,category_key,plaid_category,pending')
        .eq('user_id', userId)
        .gte('date', ninetyDaysAgo)
        .order('date', { ascending: false }),
    ]);

    if (sequence !== requestSequence.current) return;

    const monthErr = monthRes.error;
    const allErr   = allRes.error;

    // A missing table is a deployment fault, not evidence that the user has no
    // transactions. Surface it so dashboard insights cannot claim a clean bill
    // of health from an unavailable source.
    const isTableMissing = (e: typeof monthErr) =>
      e != null && (e.code === '42P01' || (e as any).status === 404 || e.message?.includes('does not exist'));

    if (isTableMissing(monthErr) || isTableMissing(allErr)) {
      setTransactions([]);
      setAllTransactions([]);
      setError('Transaction history is not available in this deployment.');
      setDataUserId(userId);
    } else if (monthErr || allErr) {
      setError((monthErr ?? allErr)?.message ?? 'Failed to load transactions');
      setDataUserId(userId);
    } else {
      setTransactions((monthRes.data ?? []) as PlaidTransaction[]);
      setAllTransactions((allRes.data ?? []) as PlaidTransaction[]);
      setDataUserId(userId);
    }

    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    // Clear synchronously with the effect before starting the replacement
    // request; the sequence guard prevents the previous account winning later.
    setTransactions([]);
    setAllTransactions([]);
    setError(null);
    setDataUserId(null);
    void load();
    const activeRequest = requestSequence.current;
    return () => {
      if (requestSequence.current === activeRequest) requestSequence.current = activeRequest + 1;
    };
  }, [load]);

  const ownsData = Boolean(userId && dataUserId === userId);
  return {
    transactions: ownsData ? transactions : [],
    allTransactions: ownsData ? allTransactions : [],
    isLoading: Boolean(userId) && (!ownsData || isLoading),
    error: ownsData ? error : null,
    refresh: load,
  };
}
