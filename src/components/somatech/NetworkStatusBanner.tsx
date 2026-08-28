/**
 * NetworkStatusBanner — D4 data-freshness indicator.
 *
 * Audit requirement: "Display a persistent banner when the app is offline or
 * when market data is stale (> 15 minutes). Institutional users need to know
 * whether prices are live."
 *
 * Two distinct modes:
 *   1. Offline   — browser lost internet (navigator.onLine + events)
 *   2. Stale     — caller passes `dataUpdatedAt` and it is > STALE_THRESHOLD_MS old
 *
 * The banner sits at the top of the viewport (sticky, below the nav) and
 * auto-dismisses when the condition clears.
 */
import React, { useEffect, useState } from 'react';
import { WifiOff, AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDataAge } from '@/lib/finance';

// ─── Config ──────────────────────────────────────────────────────────────────

/** Market data older than this triggers a "stale" warning (15 minutes) */
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

// ─── Props ───────────────────────────────────────────────────────────────────

interface NetworkStatusBannerProps {
  /** ISO string or Date of the most recent data update */
  dataUpdatedAt?: string | Date | null;
  /** Called when the user clicks "Refresh" */
  onRefresh?: () => void;
  /** Additional class names */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  dataUpdatedAt,
  onRefresh,
  className,
}) => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [dismissed, setDismissed] = useState(false);
  const [, forceUpdate] = useState(0);

  // Re-evaluate staleness every minute
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  setDismissed(false); };
    const onOffline = () => { setIsOnline(false); setDismissed(false); };
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Re-show banner on new stale trigger
  useEffect(() => {
    setDismissed(false);
  }, [dataUpdatedAt]);

  const isOffline = !isOnline;

  let isStale = false;
  let ageLabel = '';
  if (dataUpdatedAt && isOnline) {
    const ageMs = Date.now() - new Date(dataUpdatedAt).getTime();
    isStale = ageMs > STALE_THRESHOLD_MS;
    if (isStale) {
      ageLabel = formatDataAge(dataUpdatedAt).label;
    }
  }

  const show = (isOffline || isStale) && !dismissed;

  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-40 flex items-center gap-3 px-4 py-2 text-sm',
        isOffline
          ? 'bg-destructive text-destructive-foreground'
          : 'bg-warning/100 text-white dark:bg-warning/15',
        className
      )}
    >
      {isOffline ? (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      )}

      <span className="flex-1 font-medium">
        {isOffline
          ? 'You are offline. Market data may be out of date.'
          : `Market data last updated ${ageLabel}. Prices may not reflect current values.`}
      </span>

      <div className="flex items-center gap-2">
        {onRefresh && isOnline && (
          <Button
            size="sm"
            variant="secondary"
            onClick={onRefresh}
            className="h-6 px-2 text-xs gap-1"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Refresh
          </Button>
        )}
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="p-0.5 rounded hover:opacity-75 focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default NetworkStatusBanner;
