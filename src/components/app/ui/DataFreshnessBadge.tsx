import { RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { freshnessTimeLabel } from './dataFreshness';

type SyncStatus = 'synced' | 'stale' | 'error' | 'syncing' | 'never';

interface DataFreshnessBadgeProps {
  lastSyncedAt?: string | Date | null;
  status?:       SyncStatus;
  onRefresh?:    () => void;
  className?:    string;
}

function resolveStatus(lastSyncedAt?: string | Date | null): SyncStatus {
  if (!lastSyncedAt) return 'never';
  const d = typeof lastSyncedAt === 'string' ? new Date(lastSyncedAt) : lastSyncedAt;
  if (isNaN(d.getTime())) return 'never';
  const hoursAgo = (Date.now() - d.getTime()) / (1000 * 60 * 60);
  return hoursAgo > 24 ? 'stale' : 'synced';
}

/**
 * Compact badge showing when financial data was last synced.
 * Visible on financial overview, dashboard header, account screen.
 */
export default function DataFreshnessBadge({
  lastSyncedAt, status: explicitStatus, onRefresh, className,
}: DataFreshnessBadgeProps) {
  const status = explicitStatus ?? resolveStatus(lastSyncedAt);

  const config: Record<SyncStatus, { icon: React.ElementType; label: string; color: string }> = {
    synced:  { icon: CheckCircle2, label: 'Data current', color: 'text-accent' },
    stale:   { icon: AlertCircle,  label: 'Data may be outdated', color: 'text-warning' },
    error:   { icon: AlertCircle,  label: 'Sync failed',   color: 'text-destructive' },
    syncing: { icon: RefreshCw,    label: 'Syncing…',      color: 'text-primary' },
    never:   { icon: AlertCircle,  label: 'Not connected', color: 'text-muted-foreground' },
  };

  const { icon: Icon, label, color } = config[status];

  const timeLabel = status === 'synced' || status === 'stale'
    ? freshnessTimeLabel(lastSyncedAt) ?? label
    : label;

  return (
    <button
      onClick={onRefresh}
      disabled={!onRefresh || status === 'syncing'}
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1',
        'border border-border/40 bg-card/80 backdrop-blur-sm',
        'transition-colors',
        onRefresh && status !== 'syncing' && 'hover:bg-muted/60 cursor-pointer',
        !onRefresh && 'cursor-default',
        className,
      )}
      title={status === 'stale' ? 'Data may be outdated — tap to refresh' : timeLabel}
      aria-label={onRefresh ? `${timeLabel}. Refresh financial data` : timeLabel}
    >
      <Icon className={cn(
        'h-3 w-3 shrink-0',
        color,
        status === 'syncing' && 'animate-spin',
      )} />
      <span className={cn('text-[0.65rem] font-medium', color)}>
        {timeLabel}
      </span>
    </button>
  );
}
