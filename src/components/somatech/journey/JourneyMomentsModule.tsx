import { useState, useEffect } from 'react';
import { Sparkles, History, Globe, Lock, Trash2, ShieldCheck, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { track } from '@/lib/analytics';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useMyJourneyMoments } from '@/hooks/useJourneyMoments';
import JourneyFeed from './JourneyFeed';
import JourneyMomentCard from './JourneyMomentCard';
import { JOURNEY_NAMES, type PostVisibility } from './momentTemplates';
import type { JourneyId } from './journeyConfig';

type Tab           = 'community' | 'my-moments';
type JourneyFilter = JourneyId | 'all';
type IntentFilter  = 'recent' | 'same-journey' | 'wins' | 'starting';

// ── Filter config ─────────────────────────────────────────────────────────────

const JOURNEY_FILTERS: { id: JourneyFilter; label: string }[] = [
  { id: 'all',              label: 'All' },
  { id: 'debt-freedom',     label: 'Debt Freedom' },
  { id: 'budget-clarity',   label: 'Budget Clarity' },
  { id: 'investor-starter', label: 'Investing' },
  { id: 'home-buying',      label: 'Home Buying' },
  { id: 'business-owner',   label: 'Business' },
];

const INTENT_FILTERS: { id: IntentFilter; label: string; emoji: string }[] = [
  { id: 'recent',       label: 'Recent',       emoji: '🕐' },
  { id: 'same-journey', label: 'Same journey', emoji: '👥' },
  { id: 'wins',         label: 'Wins',         emoji: '🏆' },
  { id: 'starting',     label: 'Starting out', emoji: '🚀' },
];

// ── Visibility controls ───────────────────────────────────────────────────────

const VISIBILITY_ICON: Record<PostVisibility, React.ElementType> = {
  private:   Lock,
  anonymous: Globe,
  community: Globe,
};

const VISIBILITY_LABEL: Record<PostVisibility, string> = {
  private:   'Private',
  anonymous: 'Anonymous',
  community: 'Named',
};

// ── Trust header ──────────────────────────────────────────────────────────────

function FeedTrustHeader() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
        <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
      </div>
      <div>
        <p className="text-xs font-semibold text-foreground leading-snug">
          Privacy-safe progress from real people
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          No balances shown · Reactions only · Progress, not advice.
        </p>
      </div>
    </div>
  );
}

// ── Module ────────────────────────────────────────────────────────────────────

export default function JourneyMomentsModule({ onRequestAuth }: { onRequestAuth?: () => void }) {
  const { user } = useAuth();
  const sharedMomentId = new URLSearchParams(window.location.search).get('moment');

  // The loop's RETURN step. `moment_shared` counts emissions; this counts
  // arrivals — without both, the share loop cannot be shown to close.
  useEffect(() => {
    track('community_feed_viewed', {
      signed_in: !!user,
      via_shared_moment: !!sharedMomentId,
    });
    if (sharedMomentId) {
      track('moment_share_opened', { moment_id: sharedMomentId, signed_in: !!user });
    }
    // Deliberately fires once per mount, not on every auth refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeTab,      setActiveTab]      = useState<Tab>('community');
  const [journeyFilter,  setJourneyFilter]  = useState<JourneyFilter>('all');
  const [intentFilter,   setIntentFilter]   = useState<IntentFilter>('recent');

  const { posts: myPosts, loading: myLoading, changeVisibility, remove } =
    useMyJourneyMoments(user?.id);

  // Anon users can browse the community feed — they just can't react or share.
  // Show a soft sign-in nudge instead of a wall.

  // For "same-journey" intent filter: find the user's most recently-started
  // unique journey (first distinct journey_id in desc-created_at order).
  const activeSameJourneyId: JourneyId | undefined =
    intentFilter === 'same-journey' && myPosts.length > 0
      ? (myPosts.find((p, i, arr) =>
          arr.findIndex(q => q.journey_id === p.journey_id) === i
        )?.journey_id as JourneyId | undefined)
      : undefined;

  const feedJourneyId =
    journeyFilter !== 'all' ? journeyFilter
    : activeSameJourneyId   ? activeSameJourneyId
    : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="label-wide text-primary mb-1">Community</p>
        <h1 className="heading-tight text-2xl font-bold">Journey Moments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real progress from people on the same path.
        </p>
      </div>

      {/* Soft sign-in nudge for anon users */}
      {!user && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-foreground">Sign in to share your own milestones and react to others.</p>
          </div>
          {onRequestAuth && (
            <Button size="sm" variant="outline" onClick={onRequestAuth} className="shrink-0 gap-1.5">
              <LogIn className="h-3.5 w-3.5" />
              Sign in
            </Button>
          )}
        </div>
      )}

      <a href="/research" className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-4 py-3 transition-colors hover:border-primary/40">
        <div><p className="text-sm font-semibold">Community research</p><p className="mt-0.5 text-xs text-muted-foreground">Browse source-aware stock analysis, risks, assumptions, and disclosures.</p></div>
        <span className="shrink-0 text-sm font-semibold text-primary">Browse analysis →</span>
      </a>

      {/* Tabs — hide My Moments for anon users */}
      {(() => {
        const tabs: [Tab, string][] = user
          ? [['community', 'Community'], ['my-moments', 'My Moments']]
          : [['community', 'Community']];
        return (
          <div className="flex gap-1 rounded-xl bg-muted/40 p-1">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-background text-foreground shadow-elev-1'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        );
      })()}

      {/* ── Community tab ──────────────────────────────────────────────────── */}
      {activeTab === 'community' && (
        <div className="space-y-4">
          <FeedTrustHeader />

          {/* Journey filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {JOURNEY_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => {
                  setJourneyFilter(id);
                  // "Same journey" intent only makes sense when no explicit journey filter is active
                  if (id !== 'all' && intentFilter === 'same-journey') setIntentFilter('recent');
                }}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  journeyFilter === id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Intent / mood filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {INTENT_FILTERS.map(({ id, label, emoji }) => (
              <button
                key={id}
                onClick={() => setIntentFilter(id)}
                className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  intentFilter === id
                    ? 'border-primary/40 bg-primary/8 text-primary'
                    : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <span>{emoji}</span>
                {label}
              </button>
            ))}
          </div>

          <JourneyFeed
            userId={user?.id ?? null}
            journeyId={feedJourneyId}
            highlightedPostId={sharedMomentId}
            ownPostIds={myPosts.map(p => p.id)}
            onDelete={remove}
          />
        </div>
      )}

      {/* ── My Moments tab ─────────────────────────────────────────────────── */}
      {activeTab === 'my-moments' && (
        <div className="space-y-4">
          {myLoading && (
            <div className="space-y-4">
              {[0, 1].map(i => (
                <div key={i} className="h-40 rounded-2xl bg-muted/40 shimmer" />
              ))}
            </div>
          )}

          {!myLoading && myPosts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                <History className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="heading-tight text-base font-semibold">No moments yet</h3>
              <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                Complete a journey plan and tap "Share Moment" — your history appears here.
                Only you can see private moments.
              </p>
            </div>
          )}

          {!myLoading && myPosts.map(post => {
            const journeyName = JOURNEY_NAMES[post.journey_id as JourneyId] ?? post.journey_id;

            return (
              <div key={post.id} className="space-y-2">
                <JourneyMomentCard
                  journeyId={post.journey_id as JourneyId}
                  headline={post.headline}
                  subheadline={post.subheadline ?? ''}
                  timelineLabel={post.timeline_label}
                  stageLabel={post.stage_label}
                  showTimeline={post.show_timeline}
                  compact
                />

                {/* Inline controls */}
                <div className="flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-1.5">
                    {(['private', 'anonymous', 'community'] as PostVisibility[]).map(v => {
                      const Icon = VISIBILITY_ICON[v];
                      return (
                        <button
                          key={v}
                          onClick={() => changeVisibility(post.id, v)}
                          title={`Set to ${VISIBILITY_LABEL[v]}`}
                          className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all min-h-[32px] ${
                            post.visibility === v
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border/60 text-muted-foreground hover:border-border'
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          {VISIBILITY_LABEL[v]}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => remove(post.id)}
                    aria-label={`Remove ${journeyName} moment`}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg p-1.5
                      text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
