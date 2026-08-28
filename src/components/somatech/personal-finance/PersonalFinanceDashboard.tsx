import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, Sliders, Loader2, X, AlertTriangle, Brain, Maximize2, ChevronDown, Lightbulb, Route } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePersonalFinance } from '@/hooks/usePersonalFinance';
import { usePlaid } from '@/hooks/usePlaid';
import { useJourney } from '@/hooks/useJourney';
import OverviewSection       from './OverviewSection';
import CashFlowSection       from './CashFlowSection';
import ScenarioSection       from './ScenarioSection';
import PlaidConnect          from './PlaidConnect';
import SuggestedJourneys     from './SuggestedJourneys';
import FinancialPictureSummaryCard from './FinancialPictureSummary';
import FinancialHealthScoreCard    from './FinancialHealthScoreCard';
import NetWorthChangeCard          from './NetWorthChangeCard';
import MonthlyMoneyStoryCard       from './MonthlyMoneyStoryCard';
import NextBestActionCard          from './NextBestActionCard';
import RisksAndOpportunities       from './RisksAndOpportunities';
import MilestoneCard               from './MilestoneCard';
import { generateFinancialInsights } from '@/lib/personalFinanceEngine';
import { useBrokerageNetWorth } from '@/hooks/useBrokerageNetWorth';
import { deriveJourneyRecommendations, mapPFDataToJourneyAnswers } from '@/lib/journeyRecommendations';
import type { JourneyId } from '@/components/somatech/journey/journeyConfig';
import { useAuth } from '@/components/somatech/AuthProvider';
import { cn } from '@/lib/utils';
import ContextualNudge from '@/components/somatech/guide/ContextualNudge';
import { useGuideState, GUIDE_IDS } from '@/hooks/useGuideState';
import { useTransactions } from '@/hooks/useTransactions';
import InsightCards from './InsightCards';
import SpendingBreakdown from './SpendingBreakdown';
import TransactionAnalysis from './TransactionAnalysis';
import ActiveJourneyPlanCard from '@/components/somatech/journey/ActiveJourneyPlanCard';

const FinancialCoach = lazyWithRetry(() => import('@/components/somatech/FinancialCoach'));

const STALE_THRESHOLD_HOURS = 24;

interface PersonalFinanceDashboardProps {
  onNavigate?: (module: string) => void;
  plaidConnectionLimit?: number;
  onRequestUpgrade?: () => void;
}

interface InsightDisclosureProps {
  title: string;
  summary: string;
  count?: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function InsightDisclosure({ title, summary, count, icon, children }: InsightDisclosureProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="overflow-hidden rounded-2xl border border-border/40 bg-background">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/25" aria-expanded={open}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{title}</span>
              {typeof count === 'number' && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{count}</span>}
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{summary}</span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-border/30 p-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function PersonalFinanceDashboard({ onNavigate, plaidConnectionLimit = 999, onRequestUpgrade }: PersonalFinanceDashboardProps) {
  const { user } = useAuth();
  const finance  = usePersonalFinance();
  const plaid    = usePlaid(finance.refresh);
  const txns     = useTransactions();
  const { startJourney } = useJourney();
  const [dismissedDemo, setDismissedDemo] = useState(false);
  const { isDismissed, dismiss } = useGuideState(user?.id);
  const openPlaidLink = plaid.openPlaidLink;
  const syncPlaid = plaid.sync;

  const handleConnectBank   = useCallback(() => openPlaidLink(), [openPlaidLink]);
  const handleSync          = useCallback(() => syncPlaid(), [syncPlaid]);
  const dismissConnectBank  = useCallback(() => dismiss(GUIDE_IDS.NUDGE_CONNECT_BANK), [dismiss]);
  const dismissStaleSync    = useCallback(() => dismiss(GUIDE_IDS.NUDGE_STALE_SYNC), [dismiss]);

  // Persist active tab across navigation — user doesn't lose their place when switching modules
  const [activeTab, setActiveTab] = useState<'overview' | 'cashflow' | 'scenarios' | 'transactions'>(() => {
    const saved = sessionStorage.getItem('pf_active_tab');
    return (saved === 'overview' || saved === 'cashflow' || saved === 'scenarios' || saved === 'transactions') ? saved : 'overview';
  });
  const handleTabChange = useCallback((tab: string) => {
    const t = tab as 'overview' | 'cashflow' | 'scenarios' | 'transactions';
    setActiveTab(t);
    sessionStorage.setItem('pf_active_tab', t);
  }, []);

  const [coachOpen, setCoachOpen]             = useState(false);
  const [coachEverOpened, setCoachEverOpened] = useState(false);
  const [coachPrompt, setCoachPrompt]         = useState<string | undefined>(undefined);
  const [coachKey, setCoachKey]               = useState(0);

  const handleAskCoach = useCallback((prompt: string) => {
    setCoachPrompt(prompt);
    setCoachKey(k => k + 1);
    setCoachEverOpened(true);
    setCoachOpen(true);
  }, []);

  const openCoach = useCallback(() => {
    setCoachPrompt(undefined);
    setCoachEverOpened(true);
    setCoachOpen(true);
  }, []);

  // Most-recently-synced connection (used for staleness check and insights)
  const mostRecentConn = plaid.connections.length > 0
    ? plaid.connections.reduce((a, b) => (a.last_synced_at ?? '') >= (b.last_synced_at ?? '') ? a : b)
    : null;

  // Auto-sync if any Plaid connection is present and stale
  useEffect(() => {
    if (!mostRecentConn || plaid.isSyncing || plaid.isLoading) return;
    const lastSync = mostRecentConn.last_synced_at;
    if (!lastSync) { syncPlaid(); return; }
    const hoursSince = (Date.now() - new Date(lastSync).getTime()) / 36e5;
    if (hoursSince > STALE_THRESHOLD_HOURS) syncPlaid();
  }, [mostRecentConn, plaid.isSyncing, plaid.isLoading, syncPlaid]);

  const { brokerage } = useBrokerageNetWorth();

  /**
   * Plaid excludes accounts matched to a direct brokerage connection, so without
   * this the linked brokerage is missing from every figure on this page — and
   * the dashboard, which does include it, quotes a different net worth.
   *
   * The balance is added to every snapshot rather than only the newest. It is a
   * level, not a gain: crediting it to the latest row alone would make
   * analyzeNetWorthChange report the entire account as this month's increase.
   * The cost is that months before the account was opened are overstated by its
   * current value, which is the lesser error — a fabricated spike reads as
   * something you did, whereas a slightly high baseline does not.
   */
  const snapshots = useMemo(() => {
    // Demo rows are illustrative; folding a real balance into them would produce
    // a number that is neither the sample nor the truth. Each consumer below
    // keeps whatever demo handling it already had.
    if (finance.isDemo || !brokerage || brokerage.totalUsd === 0) return finance.snapshots;
    return finance.snapshots.map((snapshot) => ({
      ...snapshot,
      investments: snapshot.investments + brokerage.totalUsd,
    }));
  }, [finance.snapshots, finance.isDemo, brokerage]);

  // ── Insight engine — memoised, pure, no side effects ──────────────────────
  const insights = useMemo(() =>
    generateFinancialInsights(
      finance.isDemo ? [] : snapshots,
      finance.isDemo ? [] : finance.cashFlows,
      finance.scenarios,
      mostRecentConn?.last_synced_at ?? null,
    ),
    [snapshots, finance.cashFlows, finance.scenarios, finance.isDemo, mostRecentConn?.last_synced_at]
  );

  // ── Journey recommendations — derived from real PF data only ─────────────
  const journeyRecommendations = useMemo(() =>
    deriveJourneyRecommendations(
      snapshots,
      finance.cashFlows,
      finance.isDemo,
    ),
    [snapshots, finance.cashFlows, finance.isDemo]
  );

  const handleStartJourney = useCallback((journeyId: JourneyId) => {
    const prefilledAnswers = mapPFDataToJourneyAnswers(
      journeyId,
      snapshots,
      finance.cashFlows,
    );
    startJourney(journeyId, prefilledAnswers, Object.keys(prefilledAnswers), 'personal_finance');
    onNavigate?.('journey');
  }, [snapshots, finance.cashFlows, startJourney, onNavigate]);

  const contextualSuggestions = useMemo((): string[] => {
    const base = [
      'How should I allocate my monthly surplus?',
      'Build me an emergency fund plan',
      'Explain my cash runway risk',
      'Should I pay off debt or invest first?',
    ];
    const insightPrompts = insights.risks.slice(0, 2).map(r => r.recommendedAction);
    return insightPrompts.length > 0 ? [...insightPrompts, ...base.slice(0, 2)] : base;
  }, [insights.risks]);

  const dockLabel = useMemo(() => {
    const topRisk = insights.risks.find(r => r.severity === 'critical' || r.severity === 'warning');
    if (topRisk) return topRisk.title.slice(0, 38) + (topRisk.title.length > 38 ? '…' : '');
    if (insights.nextBestAction) return insights.nextBestAction.title.slice(0, 38);
    return 'Ready to help';
  }, [insights]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold">Personal Finance Dashboard</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sign in to track your net worth, cash flow, and model future scenarios.
          </p>
        </div>
      </div>
    );
  }

  if (finance.isLoading || plaid.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const showDemo = finance.isDemo && !dismissedDemo && !finance.loadError && plaid.connections.length === 0;
  const hasRealData = !finance.isDemo && !finance.loadError;

  return (
    <>
      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-5 p-4">

        <div>
          <h1 className="text-xl font-semibold">Personal Finance</h1>
          <p className="text-sm text-muted-foreground">Balance sheet, cash flow, and scenario modeling</p>
        </div>

        <PlaidConnect onSyncComplete={finance.refresh} variant="compact" connectionLimit={plaidConnectionLimit} onRequestUpgrade={onRequestUpgrade} />

        {/* ── Contextual nudges — one at a time, in priority order ─────────── */}
        {/* Gate on user so dismissals are never silently dropped before auth resolves */}
        {!!user && plaid.connections.length === 0 && !showDemo && !isDismissed(GUIDE_IDS.NUDGE_CONNECT_BANK) && (
          <ContextualNudge
            variant="info"
            title="Connect your bank to unlock real insights"
            body="Plaid links your accounts in under a minute — read-only, bank-level encryption. Net worth and cash flow update automatically."
            action={{ label: 'Connect now', onClick: handleConnectBank }}
            onDismiss={dismissConnectBank}
          />
        )}
        {!!user && plaid.connections.length > 0 && (() => {
          const last = mostRecentConn?.last_synced_at;
          return last
            ? (Date.now() - new Date(last).getTime()) / 36e5 > 72
            : false; // no last_synced_at yet → auto-sync is already queued, don't nudge
        })() && !isDismissed(GUIDE_IDS.NUDGE_STALE_SYNC) && (
          <ContextualNudge
            variant="warning"
            title="Your data hasn't synced in 3+ days"
            body="Insights may not reflect recent transactions. Sync now to keep your financial picture current."
            action={{ label: 'Sync now', onClick: handleSync }}
            onDismiss={dismissStaleSync}
          />
        )}

        {finance.loadError && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-medium text-destructive">Could not load your data</span>
              <span className="text-muted-foreground ml-2">— {finance.loadError}</span>
            </div>
          </div>
        )}

        {showDemo && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="text-sm space-y-1.5">
              <div>
                <span className="font-medium text-primary">Demo data</span>
                <span className="text-muted-foreground ml-2">
                  — Connect your bank above, or enter your expenses manually.
                </span>
              </div>
              <button
                onClick={() => { setDismissedDemo(true); handleTabChange('cashflow'); }}
                className="text-xs text-primary font-medium hover:underline underline-offset-2"
              >
                Log your income &amp; expenses →
              </button>
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={() => setDismissedDemo(true)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* ── Intelligence layer — only with real data ───────────────────── */}
        {hasRealData && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your financial briefing</p>
              <p className="mt-1 text-sm text-muted-foreground">Start with the headline and next action. Expand supporting detail only when you need it.</p>
            </div>

            {/* 1. Financial Picture Summary */}
            <FinancialPictureSummaryCard
              summary={insights.summary}
              stage={insights.stage}
              onAskCoach={handleAskCoach}
            />

            <ActiveJourneyPlanCard currentMonthlySurplus={insights.summary.monthlySurplus} />

            {/* 2. Health Score */}
            <FinancialHealthScoreCard score={insights.healthScore} />

            {/* 3. Next Best Action */}
            {insights.nextBestAction && (
              <NextBestActionCard action={insights.nextBestAction} onAskCoach={handleAskCoach} />
            )}

            {/* 4. Risks + Opportunities — collapsed until requested */}
            {(insights.risks.length > 0 || insights.opportunities.length > 0) && (
              <InsightDisclosure
                title="Risks and opportunities"
                summary={`${insights.risks.length} ${insights.risks.length === 1 ? 'risk' : 'risks'} and ${insights.opportunities.length} ${insights.opportunities.length === 1 ? 'opportunity' : 'opportunities'} identified`}
                count={insights.risks.length + insights.opportunities.length}
                icon={<AlertTriangle className="h-4 w-4" />}
              >
                <RisksAndOpportunities
                  risks={insights.risks}
                  opportunities={insights.opportunities}
                  onAskCoach={handleAskCoach}
                />
              </InsightDisclosure>
            )}

            {/* 5. Transaction-level insight cards — collapsed until requested */}
            {(txns.allTransactions.length > 0 || snapshots.length > 0) && (
              <InsightDisclosure
                title="Spending and trend insights"
                summary="Patterns detected across your balances, cash flow, and recent transactions"
                icon={<Lightbulb className="h-4 w-4" />}
              >
                <InsightCards
                  snapshots={snapshots}
                  cashFlows={finance.cashFlows}
                  allTransactions={txns.allTransactions}
                  onAskCoach={handleAskCoach}
                />
              </InsightDisclosure>
            )}

            {/* 6. Journey recommendations — collapsed until requested */}
            {journeyRecommendations.length > 0 && onNavigate && (
              <InsightDisclosure
                title="Recommended journeys"
                summary="Goal-based plans matched to your current financial position"
                count={journeyRecommendations.length}
                icon={<Route className="h-4 w-4" />}
              >
                <SuggestedJourneys
                  recommendations={journeyRecommendations}
                  onStartJourney={handleStartJourney}
                />
              </InsightDisclosure>
            )}
          </>
        )}

        {/* ── Main tabs ──────────────────────────────────────────────────── */}
        <div className="border-t border-border/40 pt-5">
          <h2 className="text-base font-semibold">Explore your finances</h2>
          <p className="mt-1 text-xs text-muted-foreground">Choose one area to review or update.</p>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          {/* Scrollable tab bar — negative margin breaks out of parent padding so
              the scroll container reaches the true edge; px-4 restores visual padding.
              sm: switches to a 4-column grid that fills the available width. */}
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
            <TabsList className="inline-flex w-max min-w-full sm:grid sm:w-full sm:grid-cols-4 rounded-2xl">
              <TabsTrigger value="overview"     className="gap-1 rounded-xl text-[11px] sm:text-xs px-3"><BarChart3 className="h-3.5 w-3.5 shrink-0" /> Net Worth</TabsTrigger>
              <TabsTrigger value="cashflow"     className="gap-1 rounded-xl text-[11px] sm:text-xs px-3"><TrendingUp className="h-3.5 w-3.5 shrink-0" /> Cash Flow</TabsTrigger>
              <TabsTrigger value="transactions" className="gap-1 rounded-xl text-[11px] sm:text-xs px-3"><Maximize2 className="h-3.5 w-3.5 shrink-0" /> Transactions</TabsTrigger>
              <TabsTrigger value="scenarios"    className="gap-1 rounded-xl text-[11px] sm:text-xs px-3"><Sliders className="h-3.5 w-3.5 shrink-0" /> Scenarios</TabsTrigger>
            </TabsList>
          </div>

          {/* Net Worth tab */}
          <TabsContent value="overview" className="mt-6 space-y-4">
            <OverviewSection
              snapshots={snapshots}
              cashFlows={finance.cashFlows}
              isDemo={finance.isDemo}
              isPlaidConnected={plaid.connections.length > 0}
              saveSnapshot={finance.saveSnapshot}
              onAskCoach={handleAskCoach}
            />
            {hasRealData && insights.netWorthChange && (
              <NetWorthChangeCard analysis={insights.netWorthChange} onAskCoach={handleAskCoach} />
            )}
            {hasRealData && insights.milestones.length > 0 && (
              <MilestoneCard milestones={insights.milestones} onAskCoach={handleAskCoach} />
            )}
          </TabsContent>

          {/* Cash Flow tab */}
          <TabsContent value="cashflow" className="mt-6 space-y-4">
            <CashFlowSection
              cashFlows={finance.cashFlows}
              isDemo={finance.isDemo}
              isPlaidConnected={plaid.connections.length > 0}
              saveCashFlow={finance.saveCashFlow}
              onAskCoach={handleAskCoach}
            />
            {hasRealData && insights.moneyStory && (
              <MonthlyMoneyStoryCard story={insights.moneyStory} onAskCoach={handleAskCoach} />
            )}
            {hasRealData && (txns.transactions.length > 0 || txns.allTransactions.length > 0) && (
              <SpendingBreakdown
                transactions={txns.transactions}
                allTransactions={txns.allTransactions}
                latestFlow={finance.cashFlows[finance.cashFlows.length - 1] ?? null}
                onAskCoach={handleAskCoach}
              />
            )}
          </TabsContent>

          {/* Transactions tab */}
          <TabsContent value="transactions" className="mt-6">
            <TransactionAnalysis />
          </TabsContent>

          {/* Scenarios tab */}
          <TabsContent value="scenarios" className="mt-6">
            <ScenarioSection
              snapshots={snapshots}
              cashFlows={finance.cashFlows}
              scenarios={finance.scenarios}
              saveScenario={finance.saveScenario}
              deleteScenario={finance.deleteScenario}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Coach dock ──────────────────────────────────────────────────────── */}
      {/* On mobile: sits above the bottom nav (h-16 = 4rem) with extra 1rem gap = bottom-20.
          On desktop: standard bottom-6. Label hidden on mobile — icon + dot is enough. */}
      <button
        onClick={openCoach}
        onMouseEnter={() => { void import('@/components/somatech/FinancialCoach'); }}
        onFocus={() => { void import('@/components/somatech/FinancialCoach'); }}
        aria-label="Open Financial Coach"
        className={cn(
          'fixed bottom-20 right-4 z-30 group lg:bottom-6 lg:right-6',
          'flex items-center gap-3',
          'bg-background/95 backdrop-blur-sm',
          'border border-border/50 rounded-2xl px-3 py-3 lg:px-4',
          'transition-all duration-300 ease-out hover:border-border hover:shadow-md',
          coachOpen ? 'opacity-0 pointer-events-none scale-90' : 'opacity-100 scale-100'
        )}
        style={{ boxShadow: coachOpen ? 'none' : '0 4px 24px rgba(0,0,0,0.06)' }}
      >
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border-2 border-background" />
        </div>
        {/* Label only on desktop — too wide for mobile alongside the bottom nav */}
        <div className="text-left min-w-0 hidden lg:block">
          <p className="text-[13px] font-semibold text-foreground leading-none mb-1">Financial Coach</p>
          <p className="text-[11px] text-muted-foreground leading-none truncate max-w-[160px]">{dockLabel}</p>
        </div>
      </button>

      {/* ── Backdrop ────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-40 transition-opacity duration-300',
          'bg-black/20 backdrop-blur-[2px]',
          coachOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setCoachOpen(false)}
      />

      {/* ── Coach panel ─────────────────────────────────────────────────────── */}
      {/* translate-x-full on a fixed w-full panel pushes it 100vw to the right.
          overflow:clip on html/body clips it, but we also add visibility:hidden
          when closed so the element is not painted or reachable by touch at all. */}
      <div
        className={cn(
          'fixed top-0 right-0 bottom-0 z-50 flex flex-col',
          'w-full sm:w-[400px]',
          'bg-background/[0.97] backdrop-blur-md',
          'border-l border-border/30',
          'transition-transform duration-300 ease-out will-change-transform',
          coachOpen ? 'translate-x-0 visible' : 'translate-x-full pointer-events-none invisible'
        )}
        style={{ boxShadow: '-8px 0 48px -8px rgba(0,0,0,0.10)' }}
      >
        {/* Panel header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border-2 border-background" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground leading-none">Financial Coach</p>
              <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Personal Finance context</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onNavigate && (
              <Button
                size="sm" variant="ghost"
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1.5"
                onClick={() => { setCoachOpen(false); onNavigate('financial-coach'); }}
              >
                <Maximize2 className="h-3 w-3" /> Full view
              </Button>
            )}
            <Button
              size="icon" variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setCoachOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {coachEverOpened && (
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }>
              <FinancialCoach
                key={coachKey}
                initialPrompt={coachPrompt}
                contextualSuggestions={contextualSuggestions}
                compact
                onNavigate={onNavigate}
              />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
