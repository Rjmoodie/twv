import { useCallback, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { usePersonalFinance, computeNetWorth, computeCashFlow } from '@/hooks/usePersonalFinance';
import { usePlaid } from '@/hooks/usePlaid';
import { useBrokerageNetWorth } from '@/hooks/useBrokerageNetWorth';
import { useCountUp } from '@/hooks/useCountUp';
import DataFreshnessBadge from '@/components/somatech/ui/DataFreshnessBadge';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';

const _fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmt = (n: number) => _fmt.format(n);
const fmtK = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${n < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}k`;
  return fmt(n);
};

/**
 * The answer-first hero on the dashboard.
 * Answers: "Where do I stand?" in 3 seconds.
 *
 * Shows: net worth + MoM change, cash runway, savings rate.
 * Links through to full Insights module.
 */
export default function FinancialPictureHero() {
  const { navigateToModule } = useNavigation();
  const finance = usePersonalFinance();
  const refreshFinance = finance.refresh;
  const { brokerage, loading: brokerageLoading, error: brokerageError, refresh: refreshBrokerage } = useBrokerageNetWorth();
  const refreshAccountData = useCallback(() => {
    refreshFinance();
    refreshBrokerage();
  }, [refreshFinance, refreshBrokerage]);
  const { sync, connections, isLoading: plaidLoading, isSyncing, error: plaidError } = usePlaid();

  const handleSync = useCallback(async () => {
    if (connections.length > 0) await sync();
    refreshAccountData();
  }, [connections.length, refreshAccountData, sync]);
  const { snapshots, cashFlows, isDemo } = finance;

  const { netWorth, change, changeDir, runway, savingsRate, banking } = useMemo(() => {
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.snapshot_month).getTime() - new Date(a.snapshot_month).getTime()
    );
    const latest   = sorted[0]  ? computeNetWorth(sorted[0])  : null;
    const previous = sorted[1]  ? computeNetWorth(sorted[1])  : null;
    const latestCF = cashFlows.length > 0 ? computeCashFlow(cashFlows[cashFlows.length - 1]) : null;

    // Plaid excludes accounts matched to a direct brokerage connection, so the
    // brokerage total adds here rather than double-counting.
    const banking = latest?.netWorth ?? null;
    const netWorth = banking == null
      ? (brokerage ? brokerage.totalUsd : null)
      : banking + (brokerage?.totalUsd ?? 0);

    // Deliberately banking-only. We hold today's brokerage value but no history
    // aligned to last month's snapshot, so folding it in would report the entire
    // account balance as this month's gain.
    const change   = (latest && previous)
      ? latest.netWorth - previous.netWorth
      : null;
    const changeDir: 'up' | 'down' | 'flat' =
      change === null ? 'flat' : change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

    // A savings rate needs reported income, and runway needs an actual liquid
    // balance. Missing either input is unknown, not zero.
    const savingsRate = latestCF && latestCF.totalIncome > 0 ? latestCF.savingsRate : null;
    const runway = latestCF && sorted[0] && latestCF.totalExpenses > 0
      ? Math.round(((sorted[0].checking + sorted[0].savings) / latestCF.totalExpenses) * 10) / 10
      : null;

    return { netWorth, change, changeDir, runway, savingsRate, banking };
  }, [snapshots, cashFlows, brokerage]);

  const lastSyncedAt = useMemo(() => {
    if (isDemo) return null;
    const bankingTimes = [
      ...snapshots.map((snapshot) => snapshot.updated_at),
      ...connections.map((connection) => connection.last_synced_at),
    ].flatMap((value) => {
      const timestamp = value ? Date.parse(value) : NaN;
      return Number.isFinite(timestamp) ? [timestamp] : [];
    });
    const bankingUpdatedAt = bankingTimes.length > 0 ? Math.max(...bankingTimes) : null;
    const brokerageUpdatedAt = brokerage?.asOf ? Date.parse(brokerage.asOf) : NaN;
    if (banking != null && bankingUpdatedAt == null) return null;
    if (brokerage != null && !Number.isFinite(brokerageUpdatedAt)) return null;
    const contributingTimes = [bankingUpdatedAt, Number.isFinite(brokerageUpdatedAt) ? brokerageUpdatedAt : null]
      .filter((value): value is number => value != null);
    // A combined total is only as current as its stalest contributing source.
    return contributingTimes.length > 0 ? new Date(Math.min(...contributingTimes)) : null;
  }, [banking, brokerage, connections, isDemo, snapshots]);

  // Hooks must be called unconditionally — before any early return
  const netWorthDisplay = useCountUp(netWorth,    { duration: 800, formatFn: fmtK });
  const runwayDisplay   = useCountUp(runway,      { duration: 400, formatFn: (v) => `${Math.max(0, v).toFixed(1)} mo` });
  const savingsDisplay  = useCountUp(savingsRate, { duration: 500, formatFn: (v) => `${Math.max(0, v).toFixed(0)}%` });

  // User has no data yet — don't render the hero
  const hasNoFinancialData = snapshots.length === 0 && cashFlows.length === 0 && !isDemo && !brokerage;
  if (hasNoFinancialData && (finance.isLoading || brokerageLoading || plaidLoading)) return null;
  if (hasNoFinancialData && (finance.loadError || brokerageError || plaidError)) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-card p-5" role="alert">
        <p className="text-sm font-semibold text-foreground">Your financial picture could not be loaded</p>
        <p className="mt-1 text-xs text-muted-foreground">No balances are shown until the account data can be read safely.</p>
        <button className="mt-3 text-xs font-medium text-primary hover:underline" onClick={() => void handleSync()}>Try again</button>
      </div>
    );
  }
  if (hasNoFinancialData) return null;

  const hasRisk = runway !== null && runway < 3;
  const changeColor = changeDir === 'up' ? 'text-accent' : changeDir === 'down' ? 'text-destructive' : 'text-muted-foreground';
  const ChangeIcon  = changeDir === 'up' ? TrendingUp : changeDir === 'down' ? TrendingDown : Minus;

  return (
    <div
      className="w-full rounded-2xl border border-border/40 bg-card p-5 text-left hover-lift shadow-elev-1 space-y-4"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-wide text-muted-foreground" style={{ fontSize: '0.65rem' }}>
            {isDemo ? 'Demo — Net Worth' : 'Net Worth'}
          </p>
          <p className="text-4xl font-bold font-mono tabular-nums tracking-tight text-foreground leading-none mt-1">
            {netWorthDisplay}
          </p>
          {brokerage != null && banking != null && (
            <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
              {fmtK(banking)} banking + {fmtK(brokerage.totalUsd)} brokerage
              {brokerage.unvaluedCount > 0 && (
                <span className="text-warning">
                  {' '}· {brokerage.unvaluedCount} account
                  {brokerage.unvaluedCount === 1 ? '' : 's'} not yet valued
                </span>
              )}
            </p>
          )}
          {change !== null && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm font-semibold tabular-nums', changeColor)}>
              <ChangeIcon className="h-3.5 w-3.5 shrink-0" />
              {change >= 0 ? '+' : ''}{fmtK(change)} this month
              {brokerage != null && (
                <span className="font-normal text-muted-foreground">(banking only)</span>
              )}
            </div>
          )}
        </div>

        <span className="shrink-0 mt-0.5">
          <DataFreshnessBadge
            lastSyncedAt={lastSyncedAt}
            status={isSyncing ? 'syncing' : plaidError || finance.loadError || brokerageError ? 'error' : undefined}
            onRefresh={handleSync}
          />
        </span>
      </div>

      {(plaidError || finance.loadError || brokerageError) && (
        <p className="text-xs text-destructive" role="alert">
          Some account data could not be refreshed. Existing figures may be incomplete.
        </p>
      )}

      {/* Supporting metrics */}
      {(runway !== null || savingsRate !== null) && (
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
          {runway !== null && (
            <div className={cn(
              'transition-all duration-300',
              hasRisk && 'border-l-2 border-warning pl-2 -ml-px',
            )}>
              <p className="label-wide text-muted-foreground" style={{ fontSize: '0.6rem' }}>Cash runway</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {hasRisk && <AlertCircle className="h-3 w-3 text-warning shrink-0" />}
                <p className={cn('text-lg font-bold font-mono tabular-nums', hasRisk ? 'text-warning' : 'text-foreground')}>
                  {runwayDisplay}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {hasRisk ? 'Below 3-month target' : 'of expenses covered'}
              </p>
            </div>
          )}

          {savingsRate !== null && (
            <div>
              <p className="label-wide text-muted-foreground" style={{ fontSize: '0.6rem' }}>Savings rate</p>
              <p className={cn(
                'text-lg font-bold font-mono tabular-nums mt-0.5',
                savingsRate >= 20 ? 'text-accent' : savingsRate >= 10 ? 'text-foreground' : 'text-warning',
              )}>
                {savingsDisplay}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {savingsRate >= 20 ? 'On track' : savingsRate >= 10 ? 'Room to improve' : 'Below target'}
              </p>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => navigateToModule('personal-finance')} className="text-xs font-medium text-primary hover:underline">
        View financial details
      </button>
    </div>
  );
}
