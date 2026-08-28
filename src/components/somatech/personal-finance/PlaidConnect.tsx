import React, { useState } from 'react';
import HelpTooltip from '@/components/somatech/guide/HelpTooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { usePlaid } from '@/hooks/usePlaid';
import {
  RefreshCw, Link, Unlink, CheckCircle2,
  AlertTriangle, Building2, Plus, ChevronDown, Lock,
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { cn } from '@/lib/utils';

// Single source of truth for trust copy — matches PlaidSettings.tsx exactly
const TRUST_LINE = 'Bank-level 256-bit encryption · Read-only access · SomaTech cannot move money · Powered by Plaid';

interface PlaidConnectProps {
  onSyncComplete?: () => void;
  /** compact = status bar(s); full = card with account list */
  variant?: 'compact' | 'full';
  /** Max number of institutions the user can connect (use 999 for unlimited — avoids JSON serialization issues with Infinity) */
  connectionLimit?: number;
  onRequestUpgrade?: () => void;
}

export default function PlaidConnect({
  onSyncComplete,
  variant = 'compact',
  connectionLimit = 999,
  onRequestUpgrade,
}: PlaidConnectProps) {
  const {
    connections, isLoading, isSyncing, isConnecting,
    error, openPlaidLink, sync, disconnectByItemId,
  } = usePlaid(onSyncComplete);

  const [expanded, setExpanded]     = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmState, setConfirmState]   = useState<{
    open: boolean; itemId: string; name: string;
  }>({ open: false, itemId: '', name: '' });

  const handleDisconnectRequest = (itemId: string, name: string) => {
    setConfirmState({ open: true, itemId, name });
  };

  const handleDisconnectConfirm = async () => {
    setDisconnecting(true);
    await disconnectByItemId(confirmState.itemId);
    setDisconnecting(false);
  };

  const atLimit = connections.length >= connectionLimit;

  if (isLoading) return null;

  // ── Not connected ────────────────────────────────────────────────────────────

  if (connections.length === 0) {
    if (variant === 'compact') {
      return (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Connect your bank</p>
              <p className="text-xs text-muted-foreground truncate">
                Auto-fill net worth and cash flow — read-only, no manual entry
              </p>
            </div>
          </div>
          <Button size="sm" onClick={openPlaidLink} disabled={isConnecting} className="gap-2 shrink-0">
            {isConnecting
              ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              : <Link className="h-3.5 w-3.5" />}
            {isConnecting ? 'Connecting…' : 'Connect'}
          </Button>
        </div>
      );
    }

    return (
      <Card className="app-card">
        <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1.5 max-w-xs">
            <p className="font-semibold">Connect your bank</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Link your checking, savings, investments, and credit cards.
              Net worth and cash flow update automatically — no manual entry needed.
            </p>
          </div>
          <Button onClick={openPlaidLink} disabled={isConnecting} className="gap-2">
            {isConnecting
              ? <RefreshCw className="h-4 w-4 animate-spin" />
              : <Link className="h-4 w-4" />}
            {isConnecting ? 'Opening Plaid…' : 'Connect with Plaid'}
          </Button>
          <HelpTooltip term="plaid_read_only" side="bottom">
            <p className="text-[10px] text-muted-foreground leading-relaxed max-w-xs cursor-default underline decoration-dotted underline-offset-2">
              {TRUST_LINE}
            </p>
          </HelpTooltip>
        </CardContent>
      </Card>
    );
  }

  // ── Connected — compact ──────────────────────────────────────────────────────

  if (variant === 'compact') {
    const mostRecent  = connections.reduce((a, b) =>
      (a.last_synced_at ?? '') >= (b.last_synced_at ?? '') ? a : b
    );
    const lastSyncStr = mostRecent.last_synced_at
      ? formatDistanceToNow(new Date(mostRecent.last_synced_at), { addSuffix: true })
      : 'Never synced';
    const isStale = mostRecent.last_synced_at
      ? differenceInHours(new Date(), new Date(mostRecent.last_synced_at)) > 48
      : true;

    return (
      <div className="space-y-1.5">
        <div className={cn(
          'flex items-center justify-between rounded-2xl border px-4 py-2.5',
          isStale ? 'border-warning/20/30 bg-warning/100/5' : 'border-accent/20/30 bg-accent/5'
        )}>
          <button
            onClick={() => connections.length > 1 && setExpanded(e => !e)}
            className={cn(
              'flex items-center gap-2.5 min-w-0',
              connections.length > 1 && 'cursor-pointer'
            )}
            aria-expanded={expanded}
          >
            <CheckCircle2 className={cn(
              'h-4 w-4 shrink-0',
              isStale ? 'text-warning' : 'text-accent'
            )} />
            <div className="text-left min-w-0">
              <p className="text-sm font-medium leading-none">
                {connections.length === 1
                  ? connections[0].institution_name
                  : `${connections.length} banks connected`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isStale ? 'Data may be outdated — ' : 'Synced '}
                {lastSyncStr}
              </p>
            </div>
            {connections.length > 1 && (
              <ChevronDown className={cn(
                'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
                expanded && 'rotate-180'
              )} />
            )}
          </button>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Button
              size="sm" variant="outline"
              onClick={sync} disabled={isSyncing}
              className="gap-1.5 h-7 px-2.5 text-xs"
            >
              <RefreshCw className={cn('h-3 w-3', isSyncing && 'animate-spin')} />
              {isSyncing ? 'Syncing…' : 'Sync'}
            </Button>
            <Button
              size="sm" variant="ghost"
              onClick={atLimit ? onRequestUpgrade : openPlaidLink}
              disabled={isConnecting}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title={atLimit ? `Upgrade to add more than ${connectionLimit} bank${connectionLimit === 1 ? '' : 's'}` : 'Add another bank'}
            >
              {isConnecting
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : atLimit
                  ? <Lock className="h-3 w-3" />
                  : <Plus className="h-3 w-3" />}
            </Button>
            {connections.length === 1 && (
              <Button
                size="sm" variant="ghost"
                onClick={() => handleDisconnectRequest(connections[0].item_id, connections[0].institution_name)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                title="Disconnect bank"
              >
                <Unlink className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Per-bank list when expanded */}
        {connections.length > 1 && expanded && (
          <div className="space-y-1 px-1">
            {connections.map(conn => {
              const syncStr = conn.last_synced_at
                ? formatDistanceToNow(new Date(conn.last_synced_at), { addSuffix: true })
                : 'never synced';
              return (
                <div
                  key={conn.item_id}
                  className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-muted/30 border border-border/30"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    <span className="font-medium truncate">{conn.institution_name}</span>
                    <span className="text-muted-foreground shrink-0">{syncStr}</span>
                  </div>
                  <Button
                    size="sm" variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleDisconnectRequest(conn.item_id, conn.institution_name)}
                    title={`Disconnect ${conn.institution_name}`}
                  >
                    <Unlink className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <ConfirmDialog
          open={confirmState.open}
          onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
          title={`Disconnect ${confirmState.name}?`}
          description="Future automatic syncs from this bank will stop."
          detail="Your existing data stays in the app. You can reconnect at any time."
          confirmLabel="Disconnect bank"
          onConfirm={handleDisconnectConfirm}
          loading={disconnecting}
        />
      </div>
    );
  }

  // ── Connected — full ─────────────────────────────────────────────────────────

  const connection  = connections[0];
  const lastSync    = connection.last_synced_at
    ? formatDistanceToNow(new Date(connection.last_synced_at), { addSuffix: true })
    : 'Never synced';
  const isStale     = connection.last_synced_at
    ? differenceInHours(new Date(), new Date(connection.last_synced_at)) > 48
    : true;

  return (
    <Card className="app-card">
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
              isStale ? 'bg-warning/100/10' : 'bg-accent/10'
            )}>
              <CheckCircle2 className={cn('h-5 w-5', isStale ? 'text-warning' : 'text-accent')} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{connection.institution_name}</p>
              <p className="text-xs text-muted-foreground">
                {isStale ? 'Stale — ' : 'Synced '}
                {lastSync}
              </p>
            </div>
          </div>
          <Badge variant={isStale ? 'outline' : 'secondary'} className={cn(
            'text-xs shrink-0',
            isStale && 'text-warning border-warning/20/50'
          )}>
            {isStale ? 'Needs sync' : 'Connected'}
          </Badge>
        </div>

        {connection.accounts.length > 0 && (
          <div className="space-y-1.5 pl-1">
            {connection.accounts.map(acct => (
              <div key={acct.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                  <span className="text-muted-foreground">{acct.name}</span>
                  {acct.mask && (
                    <span className="text-muted-foreground/50 font-mono text-xs">···{acct.mask}</span>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                  {acct.subtype}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={sync} disabled={isSyncing} className="gap-2 flex-1">
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDisconnectRequest(connection.item_id, connection.institution_name)}
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 hover:text-destructive"
          >
            <Unlink className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">{TRUST_LINE}</p>

        <ConfirmDialog
          open={confirmState.open}
          onOpenChange={(open) => setConfirmState(s => ({ ...s, open }))}
          title={`Disconnect ${confirmState.name}?`}
          description="Future automatic syncs from this bank will stop."
          detail="Your existing data stays in the app. You can reconnect at any time."
          confirmLabel="Disconnect bank"
          onConfirm={handleDisconnectConfirm}
          loading={disconnecting}
        />
      </CardContent>
    </Card>
  );
}
