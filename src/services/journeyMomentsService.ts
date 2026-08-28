import { supabase } from '@/integrations/supabase/client';
import type { PostVisibility, PostType, ReactionEmoji } from '@/components/somatech/journey/momentTemplates';

export interface JourneyPost {
  id:               string;
  user_id:          string;
  journey_id:       string;
  post_type:        PostType;
  visibility:       PostVisibility;
  identity_mode:    'anonymous' | 'display_name';
  template_key:     string;
  headline:         string;
  subheadline:      string | null;
  timeline_label:   string | null;
  stage_label:      string;
  show_timeline:    boolean;
  show_percentages: boolean;
  show_exact_amounts: boolean;
  status:           string;
  reaction_clap:    number;
  reaction_fire:    number;
  reaction_muscle:  number;
  reaction_rocket:  number;
  created_at:       string;
  updated_at:       string;
  journey_plan_id?: string | null;
  source_revision?: number | null;
  verification_mode?: 'plan_activation' | 'user_reported';
  // client-side: the current user's reaction on this post (if any)
  my_reaction?:     ReactionEmoji | null;
  author_display_name?: string | null;
}

export interface CreatePostParams {
  userId:          string;
  journeyId:       string;
  postType:        PostType;
  visibility:      PostVisibility;
  identityMode:    'anonymous' | 'display_name';
  templateKey:     string;
  headline:        string;
  subheadline?:    string;
  timelineLabel?:  string;
  stageLabel:      string;
  showTimeline:    boolean;
  showPercentages: boolean;
  showExactAmounts: boolean;
  journeyPlanId?:   string;
  sourceRevision?:  number;
}

export interface FeedOptions {
  /** Filter to posts on the same journey */
  journeyId?:  string;
  limit?:      number;
  offset?:     number;
}

// ── Post CRUD ─────────────────────────────────────────────────────────────────

async function createPost(params: CreatePostParams): Promise<JourneyPost> {
  // Remove after deployed schema types include Journey plan provenance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from('journey_posts')
    .insert({
      user_id:           params.userId,
      journey_id:        params.journeyId,
      post_type:         params.postType,
      visibility:        params.visibility,
      identity_mode:     params.identityMode,
      template_key:      params.templateKey,
      headline:          params.headline,
      subheadline:       params.subheadline ?? null,
      timeline_label:    params.timelineLabel ?? null,
      stage_label:       params.stageLabel,
      show_timeline:     params.showTimeline,
      show_percentages:  params.showPercentages,
      show_exact_amounts: params.showExactAmounts,
      journey_plan_id:    params.journeyPlanId ?? null,
      source_revision:    params.sourceRevision ?? null,
      verification_mode:  params.journeyPlanId ? 'plan_activation' : 'user_reported',
    })
    .select()
    .single();

  if (error) throw error;
  return data as JourneyPost;
}

async function updateVisibility(postId: string, visibility: PostVisibility): Promise<void> {
  const { error } = await supabase
    .from('journey_posts')
    .update({ visibility, updated_at: new Date().toISOString() })
    .eq('id', postId);
  if (error) throw error;
}

async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase
    .from('journey_posts')
    .delete()
    .eq('id', postId);
  if (error) throw error;
}

/** Fetch posts the current user has created (any visibility). */
async function getMyPosts(_userId: string): Promise<JourneyPost[]> {
  const { data, error } = await supabase
    .from('my_journey_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as JourneyPost[];
}

// ── Community feed ────────────────────────────────────────────────────────────

/**
 * Fetch the community feed.
 * Ranking: same-journey posts first, then recency.
 * Only published community-visibility posts.
 * Attaches the current user's reaction on each post.
 */
async function getFeed(userId: string | null, opts: FeedOptions = {}): Promise<JourneyPost[]> {
  const limit  = opts.limit  ?? 30;
  const offset = opts.offset ?? 0;

  // 1. Fetch published posts — both 'community' (named) and 'anonymous' visibility
  const query = supabase
    .from('public_journey_posts')
    .select('*')
    .in('visibility', ['community', 'anonymous'])
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: posts, error } = await query;
  if (error) throw error;
  if (!posts || posts.length === 0) return [];

  // 2. Fetch current user's reactions (skip for anon users)
  const postIds = posts.map((p: JourneyPost) => p.id);
  let myReactionMap = new Map<string, ReactionEmoji>();
  if (userId) {
    const { data: myReactions } = await supabase
      .from('my_post_reactions')
      .select('post_id, emoji')
      .in('post_id', postIds);
    myReactionMap = new Map<string, ReactionEmoji>(
      (myReactions ?? []).map((r: { post_id: string; emoji: string }) => [r.post_id, r.emoji as ReactionEmoji])
    );
  }

  const normalizedPosts = (posts as Array<JourneyPost & { user_id?: string }>).map(post => ({ ...post, user_id: post.user_id ?? '' }));
  // 3. Client-side re-rank: same journey first, then by total reactions, then recency
  const ranked = normalizedPosts
    .map(p => ({
      ...p,
      my_reaction: myReactionMap.get(p.id) ?? null,
      author_display_name: p.identity_mode === 'display_name' ? p.author_display_name ?? 'Community member' : null,
      _score:
        (opts.journeyId && p.journey_id === opts.journeyId ? 1000 : 0) +
        (p.reaction_clap + p.reaction_fire + p.reaction_muscle + p.reaction_rocket) * 2,
    }))
    .sort((a, b) => b._score - a._score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map(({ _score, ...p }) => p);

  return ranked;
}

async function getSharedPost(postId: string, userId: string | null): Promise<JourneyPost | null> {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return null;
  const { data, error } = await supabase.from('public_journey_posts').select('*').eq('id', postId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const post = { ...(data as JourneyPost), user_id: (data as JourneyPost).user_id ?? '' };
  let myReaction: ReactionEmoji | null = null;
  if (userId) {
    const { data: reaction } = await supabase.from('my_post_reactions').select('emoji').eq('post_id', postId).maybeSingle();
    myReaction = reaction?.emoji as ReactionEmoji | null ?? null;
  }
  let authorDisplayName: string | null = null;
  if (post.identity_mode === 'display_name') {
    authorDisplayName = post.author_display_name ?? 'Community member';
  }
  return { ...post, my_reaction: myReaction, author_display_name: authorDisplayName };
}

// ── Reactions ─────────────────────────────────────────────────────────────────

/**
 * Toggle a reaction. If the user has no reaction → add it.
 * If they have the same reaction → remove it (toggle off).
 * If they have a different reaction → replace it (delete old, insert new).
 */
async function toggleReaction(
  postId: string,
  userId: string,
  emoji: ReactionEmoji,
): Promise<ReactionEmoji | null> {
  // Check existing
  const { data: existing } = await supabase
    .from('my_post_reactions')
    .select('id, emoji')
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    if (existing.emoji === emoji) {
      // Same → remove (toggle off)
      await supabase.from('post_reactions').delete().eq('id', existing.id);
      return null;
    } else {
      // Different → replace
      await supabase.from('post_reactions').delete().eq('id', existing.id);
      await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, emoji });
      return emoji;
    }
  } else {
    // None → add
    await supabase.from('post_reactions').insert({ post_id: postId, user_id: userId, emoji });
    return emoji;
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

type ReportReason = 'privacy' | 'misleading' | 'spam' | 'harassment' | 'financial_advice' | 'other';

async function reportPost(
  postId: string,
  userId: string,
  reason: ReportReason,
  notes?: string,
): Promise<void> {
  const { error } = await supabase
    .from('post_reports')
    .insert({ post_id: postId, reporter_user_id: userId, reason, notes: notes ?? null });

  // Swallow unique-constraint violation — user already reported this post
  if (error && !error.message.includes('unique')) throw error;
}

export const journeyMomentsService = {
  createPost,
  updateVisibility,
  deletePost,
  getMyPosts,
  getFeed,
  getSharedPost,
  toggleReaction,
  reportPost,
};
