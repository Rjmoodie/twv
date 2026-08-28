import { formatDistanceToNow } from 'date-fns';

export function freshnessTimeLabel(lastSyncedAt?: string | Date | null): string | null {
  if (!lastSyncedAt) return null;
  const date = typeof lastSyncedAt === 'string' ? new Date(lastSyncedAt) : lastSyncedAt;
  if (Number.isNaN(date.getTime())) return null;
  return `Updated ${formatDistanceToNow(date, { addSuffix: true })}`;
}
