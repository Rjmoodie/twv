import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CircleHelp, Loader2, ScrollText, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../AuthProvider';
import type { WatchlistItem } from './useWatchlistOperations';
import {
  deriveInvalidationSignals,
  pendingReviewSnapshot,
  summarizeReviews,
  type ReviewableSnapshot,
  type ThesisReview,
  type ThesisVerdict,
} from './thesisReview';

interface ThesisReviewCardProps {
  item: WatchlistItem;
  snapshots: ReviewableSnapshot[];
}

const VERDICTS: { value: ThesisVerdict; label: string; icon: typeof CheckCircle2; className: string }[] = [
  { value: 'holds', label: 'Still holds', icon: CheckCircle2, className: 'border-emerald-500/40 hover:bg-emerald-500/10' },
  { value: 'invalidated', label: 'Invalidated', icon: AlertTriangle, className: 'border-red-500/40 hover:bg-red-500/10' },
  { value: 'unclear', label: 'Too early to tell', icon: CircleHelp, className: 'border-amber-500/40 hover:bg-amber-500/10' },
];

const VERDICT_LABEL: Record<ThesisVerdict, string> = {
  holds: 'Still holds',
  invalidated: 'Invalidated',
  unclear: 'Too early to tell',
};

const WEIGHT_STYLE = {
  contradicts: { icon: TrendingDown, className: 'text-destructive', label: 'Cuts against' },
  weakens: { icon: TrendingDown, className: 'text-amber-600 dark:text-amber-400', label: 'Weakens' },
  supports: { icon: TrendingUp, className: 'text-emerald-600 dark:text-emerald-400', label: 'Supports' },
} as const;

export default function ThesisReviewCard({ item, snapshots }: ThesisReviewCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');

  const reviewsQuery = useQuery({
    queryKey: ['thesis-reviews', item.id],
    enabled: Boolean(user?.id) && item.tracking_mode === 'thesis',
    queryFn: async (): Promise<ThesisReview[]> => {
      const { data, error } = await supabase
        .from('thesis_reviews')
        .select('id,watchlist_id,snapshot_id,verdict,note,thesis_invalidation_at_review,created_at')
        .eq('watchlist_id', item.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ThesisReview[];
    },
    staleTime: 60_000,
  });

  const reviews = reviewsQuery.data ?? [];
  const pending = pendingReviewSnapshot(item, snapshots, reviews);
  const record = summarizeReviews(reviews);

  const submit = useMutation({
    mutationFn: async (verdict: ThesisVerdict) => {
      if (!user?.id || !pending) throw new Error('No snapshot is awaiting a verdict.');
      const { error } = await supabase.from('thesis_reviews').insert({
        watchlist_id: item.id,
        snapshot_id: pending.id,
        user_id: user.id,
        verdict,
        note: note.trim() || null,
        thesis_invalidation_at_review: item.thesis_invalidation,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['thesis-reviews', item.id] });
      toast.success('Verdict recorded against this chapter.');
    },
    onError: (error) => {
      console.error('Thesis review failed to save:', error);
      toast.error('The verdict could not be saved. Your thesis and story history are unchanged.');
    },
  });

  // Nothing stated in advance means nothing to grade — stay out of the way entirely.
  if (item.tracking_mode !== 'thesis' || !item.thesis_invalidation?.trim()) return null;
  if (reviewsQuery.isLoading) return null;

  const signals = pending ? deriveInvalidationSignals(pending.snapshot) : [];

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 font-semibold"><ScrollText className="h-4 w-4 text-primary" />Thesis review</h3>
        {record.total > 0 && (
          <Badge variant="outline" className="ml-auto">
            {record.total} verdict{record.total === 1 ? '' : 's'}
            {record.holdRate != null && ` · held ${record.holdRate.toFixed(0)}%`}
          </Badge>
        )}
      </div>

      <div className="mt-3 space-y-2 rounded-lg bg-muted/30 p-3 text-sm">
        {item.thesis_summary?.trim() && (
          <p><span className="text-muted-foreground">Thesis: </span>{item.thesis_summary}</p>
        )}
        <p><span className="text-muted-foreground">You said this would be wrong if: </span>{item.thesis_invalidation}</p>
      </div>

      {pending ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            A newer chapter landed on {new Date(pending.source_as_of).toLocaleDateString()}. Against the condition you wrote in advance — does the thesis still stand?
          </p>

          {signals.length > 0 && (
            <ul className="mt-3 space-y-2">
              {signals.slice(0, 5).map((signal) => {
                const style = WEIGHT_STYLE[signal.weight];
                const Icon = style.icon;
                return (
                  <li key={signal.id} className="flex gap-2 rounded-lg border p-2.5 text-xs">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${style.className}`} />
                    <div className="min-w-0">
                      <p className="font-medium">{signal.headline} <span className={`font-normal ${style.className}`}>· {style.label}</span></p>
                      <p className="mt-0.5 text-muted-foreground">{signal.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What changed your mind, or what kept it the same? (optional)"
            className="mt-3"
            rows={2}
            maxLength={4000}
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {VERDICTS.map(({ value, label, icon: Icon, className }) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                className={`gap-1.5 ${className}`}
                disabled={submit.isPending}
                onClick={() => submit.mutate(value)}
              >
                {submit.isPending && submit.variables === value
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Icon className="h-3.5 w-3.5" />}
                {label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {record.total === 0
            ? 'No new chapter since you set this thesis. You will be asked to grade it when fresh filings arrive.'
            : `Latest chapter already graded: ${VERDICT_LABEL[record.lastVerdict!]}${record.lastReviewedAt ? ` on ${new Date(record.lastReviewedAt).toLocaleDateString()}` : ''}.`}
        </p>
      )}

      {reviews.length > 0 && (
        <div className="mt-4 space-y-2 border-t pt-3">
          {reviews.map((review) => (
            <div key={review.id} className="border-l-2 border-primary/30 pl-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{VERDICT_LABEL[review.verdict]}</span>
                <span className="text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</span>
              </div>
              {review.note && <p className="mt-0.5 text-muted-foreground">{review.note}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
