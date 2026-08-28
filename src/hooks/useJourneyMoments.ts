import { useCallback, useEffect, useRef, useState } from 'react';
import { journeyMomentsService, type JourneyPost } from '@/services/journeyMomentsService';
import type { ReactionEmoji, PostVisibility } from '@/components/somatech/journey/momentTemplates';
import { toast } from '@/hooks/use-toast';

// ── My posts (journey history) ────────────────────────────────────────────────

export function useMyJourneyMoments(userId: string | undefined) {
  const [posts, setPosts] = useState<JourneyPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await journeyMomentsService.getMyPosts(userId);
      setPosts(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Reload when a new moment is created anywhere in the app
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('somatech:moment-created', handler);
    return () => window.removeEventListener('somatech:moment-created', handler);
  }, [load]);

  const changeVisibility = useCallback(async (postId: string, visibility: PostVisibility) => {
    // Snapshot the previous visibility before optimistic update
    const previousVisibility = posts.find(p => p.id === postId)?.visibility;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, visibility } : p));
    try {
      await journeyMomentsService.updateVisibility(postId, visibility);
    } catch {
      // Restore the original visibility from snapshot
      if (previousVisibility !== undefined) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, visibility: previousVisibility } : p));
      }
      toast({ title: 'Could not update visibility', variant: 'destructive' });
    }
  }, [posts]);

  const remove = useCallback(async (postId: string) => {
    const saved = posts.find(p => p.id === postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    try {
      await journeyMomentsService.deletePost(postId);
      toast({ title: 'Moment removed' });
    } catch {
      if (saved) setPosts(prev => [saved, ...prev]);
      toast({ title: 'Could not remove moment', variant: 'destructive' });
    }
  }, [posts]);

  return { posts, loading, error, reload: load, changeVisibility, remove };
}

// ── Community feed ────────────────────────────────────────────────────────────

export function useJourneyFeed(
  userId: string | undefined,
  journeyId?: string,
  highlightedPostId?: string | null,
) {
  const [posts, setPosts]       = useState<JourneyPost[]>([]);
  const [loading, setLoading]   = useState(false);
  const [hasMore, setHasMore]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const offsetRef               = useRef(0);
  const PAGE                    = 20;

  const load = useCallback(async (reset = false) => {
    const offset = reset ? 0 : offsetRef.current;
    setLoading(true);
    setError(null);
    try {
      const page = await journeyMomentsService.getFeed(userId ?? null, {
        journeyId, limit: PAGE, offset,
      });
      if (reset && highlightedPostId && !page.some(post => post.id === highlightedPostId)) {
        const highlighted = await journeyMomentsService.getSharedPost(highlightedPostId, userId ?? null);
        setPosts(highlighted ? [highlighted, ...page] : page);
      } else {
        setPosts(prev => reset ? page : [...prev, ...page]);
      }
      offsetRef.current = offset + page.length;
      setHasMore(page.length === PAGE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [userId, journeyId, highlightedPostId]);

  useEffect(() => {
    offsetRef.current = 0;
    load(true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) load(false);
  }, [loading, hasMore, load]);

  // Optimistic reaction toggle
  const react = useCallback(async (postId: string, emoji: ReactionEmoji) => {
    if (!userId) return;

    // Snapshot for rollback
    const prev = posts.find(p => p.id === postId);
    if (!prev) return;

    const current = prev.my_reaction;
    const isRemoving = current === emoji;
    const isReplacing = current !== null && current !== emoji;

    const emojiToCount: Record<ReactionEmoji, keyof JourneyPost> = {
      '👏': 'reaction_clap', '🔥': 'reaction_fire',
      '💪': 'reaction_muscle', '🚀': 'reaction_rocket',
    };

    const optimistic = (p: JourneyPost): JourneyPost => {
      const updated = { ...p };
      if (isRemoving) {
        (updated[emojiToCount[emoji]] as number) = Math.max(0, (p[emojiToCount[emoji]] as number) - 1);
        updated.my_reaction = null;
      } else {
        if (isReplacing && current) {
          (updated[emojiToCount[current]] as number) = Math.max(0, (p[emojiToCount[current]] as number) - 1);
        }
        (updated[emojiToCount[emoji]] as number) = (p[emojiToCount[emoji]] as number) + 1;
        updated.my_reaction = emoji;
      }
      return updated;
    };

    setPosts(all => all.map(p => p.id === postId ? optimistic(p) : p));

    try {
      await journeyMomentsService.toggleReaction(postId, userId, emoji);
    } catch {
      // Rollback on failure
      setPosts(all => all.map(p => p.id === postId ? prev : p));
      toast({ title: 'Could not save reaction', variant: 'destructive' });
    }
  }, [userId, posts]);

  const report = useCallback(async (
    postId: string,
    reason: Parameters<typeof journeyMomentsService.reportPost>[2],
  ) => {
    if (!userId) return;
    try {
      await journeyMomentsService.reportPost(postId, userId, reason);
      // Optimistically hide the post from the feed
      setPosts(prev => prev.filter(p => p.id !== postId));
      toast({ title: 'Post reported', description: 'Thank you — our team will review it.' });
    } catch {
      toast({ title: 'Could not submit report', variant: 'destructive' });
    }
  }, [userId]);

  return { posts, loading, hasMore, error, loadMore, react, report };
}
