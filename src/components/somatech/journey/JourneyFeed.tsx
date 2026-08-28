import { useRef, useCallback, useMemo, useEffect } from 'react';
import { Loader2, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { useJourneyFeed } from '@/hooks/useJourneyMoments';
import JourneyFeedPost from './JourneyFeedPost';
import type { ReactionEmoji } from './momentTemplates';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface JourneyFeedProps {
  userId?:     string | null;
  journeyId?:  string;
  highlightedPostId?: string | null;
  ownPostIds?: string[];
  onDelete?:   (postId: string) => void;
  className?:  string;
}

function JourneyFeedSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading Journey Moments">
      {[0, 1, 2].map(i => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          <div className="h-40 shimmer bg-muted/40" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-32 shimmer rounded-full bg-muted" />
            <div className="flex gap-2">
              {[0, 1, 2].map(j => (
                <div key={j} className="h-7 w-16 shimmer rounded-full bg-muted" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function JourneyFeedEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Users className="h-7 w-7 text-primary" aria-hidden />
      </div>
      <h3 className="heading-tight mt-4 text-base font-semibold">No Journey Moments yet</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Be the first. Complete a plan, hit a milestone, and choose whether to keep it
        private or post anonymously to the community.
      </p>
    </div>
  );
}

function JourneyFeedErrorState() {
  return (
    <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden />
      </div>
      <h3 className="heading-tight mt-4 text-base font-semibold">Couldn't load Journey Moments</h3>
      <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
        Something went wrong. Try refreshing the page.
      </p>
      <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => window.location.reload()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </div>
  );
}

export default function JourneyFeed({ userId, journeyId, highlightedPostId, ownPostIds, onDelete, className }: JourneyFeedProps) {
  const { posts, loading, hasMore, error, loadMore, react, report } =
    useJourneyFeed(userId, journeyId, highlightedPostId);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set lookup — O(1) vs includes() O(n) per post
  const ownPostIdSet = useMemo(
    () => (ownPostIds?.length ? new Set(ownPostIds) : null),
    [ownPostIds],
  );

  const handleReact = useCallback(
    (postId: string, emoji: ReactionEmoji) => react(postId, emoji),
    [react],
  );

  const handleReport = useCallback(
    (postId: string, reason: Parameters<typeof report>[1]) => report(postId, reason),
    [report],
  );

  // Sentinel ref — disconnect before attaching, guard against re-entrant loadMore()
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      if (!node || !hasMore || loading) return;

      observerRef.current = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting && hasMore && !loading) loadMore();
        },
        { root: null, rootMargin: '500px 0px', threshold: 0 },
      );
      observerRef.current.observe(node);
    },
    [hasMore, loading, loadMore],
  );

  // Cleanup observer on unmount
  useEffect(() => () => observerRef.current?.disconnect(), []);

  if (error)                            return <JourneyFeedErrorState />;
  if (loading && posts.length === 0)    return <JourneyFeedSkeleton />;
  if (!loading && posts.length === 0)   return <JourneyFeedEmptyState />;

  return (
    <section className={cn('space-y-5', className)} aria-label="Journey Moments feed">
      <div className="space-y-5" role="feed">
        {posts.map(post => (
          <JourneyFeedPost
            key={post.id}
            post={post}
            onReact={handleReact}
            onReport={handleReport}
            isOwn={post.user_id === userId || Boolean(ownPostIdSet?.has(post.id))}
            isSameJourney={!!journeyId && post.journey_id === journeyId}
            onDelete={onDelete}
            className={post.id === highlightedPostId ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : undefined}
          />
        ))}
      </div>

      {/* Infinite scroll sentinel with manual fallback */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading more moments…
            </div>
          ) : (
            <Button variant="ghost" size="sm" onClick={loadMore} className="text-xs text-muted-foreground">
              Load more
            </Button>
          )}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="py-6 text-center">
          <p className="text-xs text-muted-foreground">You're all caught up.</p>
          <p className="mt-1 text-[0.7rem] text-muted-foreground/60">
            New Journey Moments appear here as people share progress.
          </p>
        </div>
      )}
    </section>
  );
}
