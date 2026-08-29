/**
 * PlaidSettings — Connected Accounts control centre.
 *
 * Mobile:   single-column trust-first stack, thumb-friendly touch targets.
 * Desktop:  two-column layout — institutions left, trust/value sidebar right.
 *
 * Sync is global (all institutions at once) — usePlaid does not expose
 * per-institution sync, so "Sync all" is used. Disconnect is per-institution.
 */

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePlaid, type PlaidConnection } from '@/hooks/usePlaid';
import {
  Shield, RefreshCw, CheckCircle2, Unlink, Plus,
  Building2, AlertTriangle, Lock, Zap, TrendingUp,
  BarChart3, Brain, Clock,
} from 'lucide-react';
import { differenceInDays, differenceInHours, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ── Shared trust line ─────────────────────────────────────────────────────────

const TRUST_LINE = 'Bank-level 256-bit encryption · Read-only access · TW Ventures cannot move money · Powered by Plaid';

// ── Sync health ───────────────────────────────────────────────────────────────

type SyncTone = 'success' | 'warning' | 'muted';

interface SyncHealth {
  label:       'Healthy' | 'Needs refresh' | 'Stale' | 'Never synced';
  tone:        SyncTone;
  description: string;
}

function getSyncHealth(lastSyncedAt?: string | null): SyncHealth {
  if (!lastSyncedAt) {
    return { label: 'Never synced', tone: 'warning', description: 'This connection has not synced yet.' };
  }
  const days = differenceInDays(new Date(), new Date(lastSyncedAt));
  if (days <= 3)  return { label: 'Healthy',        tone: 'success', description: 'Data is current.' };
  if (days <= 7)  return { label: 'Needs refresh',  tone: 'warning', description: 'Sync to refresh your latest balances.' };
  return           { label: 'Stale',           tone: 'warning', description: 'This connection may be out of date.' };
}

const TONE_BADGE: Record<SyncTone, string> = {
  success: 'text-accent border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/10',
  warning: 'text-warning  border-warning/20/40  bg-warning/10  dark:bg-warning/100/10',
  muted:   'text-muted-foreground border-border/40',
};

const TONE_ICON: Record<SyncTone, string> = {
  success: 'text-accent',
  warning: 'text-warning',
  muted:   'text-muted-foreground/40',
};

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ── Error alert ───────────────────────────────────────────────────────────────

function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3.5">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-destructive">Connection issue</p>
        <p className="text-xs text-destructive/80 mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="shrink-0 h-8 text-xs">
          Retry
        </Button>
      )}
    </div>
  );
}

// ── Hero card ─────────────────────────────────────────────────────────────────

function ConnectedAccountsHero({
  institutionCount, accountCount, lastSyncedAt, staleCount,
}: {
  institutionCount: number;
  accountCount:     number;
  lastSyncedAt:     string | null;
  staleCount:       number;
}) {
  const lastSyncStr = lastSyncedAt
    ? formatDistanceToNow(new Date(lastSyncedAt), { addSuffix: true })
    : null;
  const overallHealth = staleCount > 0 ? 'warning' : institutionCount > 0 ? 'success' : 'muted';

  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 px-5 py-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Connected Accounts</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
            Link your financial accounts to keep net worth, cash flow, scenarios, and Financial Coach insights up to date automatically.
          </p>
        </div>
        {institutionCount > 0 && (
          <Badge variant="outline" className={cn('shrink-0 text-xs', TONE_BADGE[overallHealth])}>
            {staleCount > 0 ? `${staleCount} needs sync` : 'All synced'}
          </Badge>
        )}
      </div>

      {institutionCount > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-4">
          {[
            { label: 'Institutions', value: institutionCount },
            { label: 'Accounts',     value: accountCount },
            { label: 'Last sync',    value: lastSyncStr ?? '—' },
            { label: 'Status',       value: staleCount > 0 ? 'Needs refresh' : 'Healthy' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-muted/40 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">{TRUST_LINE}</p>
    </div>
  );
}

// ── Account row ───────────────────────────────────────────────────────────────

function AccountRow({ name, mask, subtype }: { name: string; mask?: string; subtype?: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 px-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
        <span className="text-sm text-foreground truncate">{name}</span>
        {mask && (
          <span className="text-xs text-muted-foreground/60 font-mono shrink-0">···{mask}</span>
        )}
      </div>
      {subtype && (
        <Badge variant="outline" className="text-[10px] capitalize shrink-0 ml-2">{subtype}</Badge>
      )}
    </div>
  );
}

// ── Institution card ──────────────────────────────────────────────────────────

function InstitutionCard({
  conn, isSyncing, onSyncAll, onDisconnect,
}: {
  conn:         PlaidConnection;
  isSyncing:    boolean;
  onSyncAll:    () => void;
  onDisconnect: (itemId: string, name: string) => void;
}) {
  const health    = getSyncHealth(conn.last_synced_at);
  const lastSync  = conn.last_synced_at
    ? formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })
    : null;

  return (
    <Card className="app-card overflow-hidden">
      <CardContent className="pt-4 pb-4 space-y-4">
        {/* Institution header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              health.tone === 'success' ? 'bg-emerald-500/10' : 'bg-warning/100/10'
            )}>
              <CheckCircle2 className={cn('h-5 w-5', TONE_ICON[health.tone])} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{conn.institution_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {conn.accounts.length} account{conn.accounts.length !== 1 ? 's' : ''} connected
                {lastSync && ` · Synced ${lastSync}`}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn('text-[11px] shrink-0', TONE_BADGE[health.tone])}>
            {health.label}
          </Badge>
        </div>

        {/* Account list */}
        {conn.accounts.length > 0 && (
          <div className="rounded-xl border border-border/30 bg-muted/20 divide-y divide-border/20 overflow-hidden">
            {conn.accounts.map(acct => (
              <AccountRow
                key={acct.id}
                name={acct.name}
                mask={acct.mask}
                subtype={acct.subtype}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-2 pt-1">
          <Button
            size="sm"
            onClick={onSyncAll}
            disabled={isSyncing}
            className="w-full sm:w-auto gap-2"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDisconnect(conn.item_id, conn.institution_name)}
            className="w-full sm:w-auto gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          >
            <Unlink className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onConnect, isConnecting }: { onConnect: () => void; isConnecting: boolean }) {
  return (
    <Card className="app-card">
      <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-2 max-w-sm">
          <p className="font-semibold">No accounts connected yet</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Connect your bank accounts to automatically update your financial picture — net worth, cash runway, monthly income and expenses, scenario projections, and Financial Coach insights.
          </p>
        </div>
        <Button onClick={onConnect} disabled={isConnecting} className="gap-2 h-11 px-6">
          {isConnecting
            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Connecting…</>
            : <><Plus className="h-4 w-4" /> Connect a bank</>
          }
        </Button>
      </CardContent>
    </Card>
  );
}

// ── What this powers card ─────────────────────────────────────────────────────

function ConnectedValueCard() {
  const items = [
    { icon: TrendingUp, label: 'Net worth snapshots' },
    { icon: BarChart3,  label: 'Cash flow & runway' },
    { icon: Zap,        label: 'Spending breakdowns' },
    { icon: Clock,      label: 'Scenario projections' },
    { icon: Brain,      label: 'Financial Coach insights' },
  ];

  return (
    <Card className="app-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">What connected accounts power</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <Icon className="h-3.5 w-3.5 text-primary/70 shrink-0" />
            {label}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Security card ─────────────────────────────────────────────────────────────

function SecurityCard() {
  const items = [
    {
      title: 'Read-only access',
      body:  'TW Ventures cannot move money, initiate transfers, or make payments on your behalf.',
    },
    {
      title: 'Credentials stay with Plaid',
      body:  'Your bank login is never stored by TW Ventures — only a secure, revocable token from Plaid.',
    },
    {
      title: 'Used for insights only',
      body:  'Synced data powers your personal finance dashboard and Financial Coach.',
    },
    {
      title: 'Disconnect anytime',
      body:  'Disconnecting stops future syncs immediately. Historical data stays unless you delete your account.',
    },
  ];

  return (
    <Card className="app-card border-border/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Security & data access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(({ title, body }) => (
          <div key={title} className="flex gap-2.5">
            <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary/50" />
            <div>
              <p className="text-xs font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlaidSettings() {
  const {
    connections, isLoading, isSyncing, isConnecting,
    error, openPlaidLink, sync, disconnectByItemId,
  } = usePlaid();

  const [confirmState, setConfirmState] = useState<{
    open: boolean; itemId: string; name: string;
  }>({ open: false, itemId: '', name: '' });
  const [disconnecting, setDisconnecting] = useState(false);

  // ── Derived summary ─────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const institutionCount = connections.length;
    const accountCount     = connections.reduce((n, c) => n + (c.accounts?.length ?? 0), 0);
    const mostRecentSync   = connections.reduce<string | null>((latest, c) => {
      if (!c.last_synced_at) return latest;
      if (!latest) return c.last_synced_at;
      return c.last_synced_at > latest ? c.last_synced_at : latest;
    }, null);
    const staleCount = connections.filter(
      c => getSyncHealth(c.last_synced_at).tone === 'warning'
    ).length;

    return { institutionCount, accountCount, mostRecentSync, staleCount };
  }, [connections]);

  const handleDisconnectRequest = (itemId: string, name: string) => {
    setConfirmState({ open: true, itemId, name });
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    await disconnectByItemId(confirmState.itemId);
    setDisconnecting(false);
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) return <LoadingSkeleton />;

  const hasConnections = connections.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-0 sm:px-0">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <ConnectedAccountsHero
        institutionCount={summary.institutionCount}
        accountCount={summary.accountCount}
        lastSyncedAt={summary.mostRecentSync}
        staleCount={summary.staleCount}
      />

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && <ErrorAlert message={error} />}

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">

        {/* Left — institutions ─────────────────────────────────────────── */}
        <div className="space-y-4" aria-label="Connected institutions" aria-live="polite">
          {!hasConnections ? (
            <EmptyState onConnect={openPlaidLink} isConnecting={isConnecting} />
          ) : (
            connections.map(conn => (
              <InstitutionCard
                key={conn.item_id}
                conn={conn}
                isSyncing={isSyncing}
                onSyncAll={sync}
                onDisconnect={handleDisconnectRequest}
              />
            ))
          )}

          {/* Add another bank — only shown when at least one is connected */}
          {hasConnections && (
            <Button
              onClick={openPlaidLink}
              disabled={isConnecting}
              variant="outline"
              className="w-full h-11 gap-2"
            >
              {isConnecting
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Connecting…</>
                : <><Plus className="h-4 w-4" /> Add another bank</>
              }
            </Button>
          )}
        </div>

        {/* Right — sticky sidebar ───────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <ConnectedValueCard />
          <SecurityCard />
        </aside>

      </div>

      {/* ── Disconnect dialog ─────────────────────────────────────────────── */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
        title={`Disconnect ${confirmState.name}?`}
        description="Future automatic syncs from this bank will stop."
        detail="Your existing data — net worth snapshots, cash flow history, and transactions — will remain in the app. You can reconnect at any time."
        confirmLabel="Disconnect bank"
        onConfirm={handleDisconnectConfirm}
        loading={disconnecting}
      />
    </div>
  );
}
