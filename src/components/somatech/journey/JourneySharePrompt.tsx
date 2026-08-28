import { useState } from 'react';
import { Share2, Download, Globe, Lock, Users, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Capacitor } from '@capacitor/core';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/components/somatech/AuthProvider';
import { track } from '@/lib/analytics';
import { useHaptics } from '@/hooks/useHaptics';
import { journeyMomentsService } from '@/services/journeyMomentsService';
import { generateMomentContent, type PostVisibility } from './momentTemplates';
import JourneyMomentCard from './JourneyMomentCard';
import type { JourneyDraft } from '@/hooks/useJourney';
import type { JourneyId } from './journeyConfig';

interface JourneySharePromptProps {
  draft: JourneyDraft;
  planId?: string;
  sourceRevision?: number;
  onDone: () => void;
}

type ShareStep = 'prompt' | 'privacy' | 'sharing';

// eslint-disable-next-line react-refresh/only-export-components
export function buildJourneyShareText(
  headline: string,
  subheadline: string,
  timelineLabel: string | undefined,
  showTimeline: boolean,
  returnPath?: string,
): string {
  return [
    headline,
    subheadline,
    showTimeline && timelineLabel ? timelineLabel : '',
    '',
    returnPath ?? '',
    '',
    'Progress, not advice. — Powered by SomaTech',
  ].filter(Boolean).join('\n');
}

const VISIBILITY_OPTIONS: { value: PostVisibility; icon: React.ElementType; label: string; sub: string }[] = [
  { value: 'private',   icon: Lock,   label: 'Keep private',       sub: 'Saved to your journey history only' },
  { value: 'anonymous', icon: Globe,  label: 'Share anonymously',  sub: 'Visible in community — no name shown' },
  { value: 'community', icon: Users,  label: 'Share with name',    sub: 'Visible with your display name' },
];

export default function JourneySharePrompt({ draft, planId, sourceRevision, onDone }: JourneySharePromptProps) {
  const { user } = useAuth();
  const haptics = useHaptics();
  const [step, setStep]               = useState<ShareStep>('prompt');
  const [visibility, setVisibility]   = useState<PostVisibility>('anonymous');
  const [showTimeline, setShowTimeline] = useState(true);
  const [saving, setSaving]           = useState(false);

  const content = generateMomentContent(draft);

  const handleNativeShare = async (postId?: string) => {
    const returnPath = postId && visibility !== 'private'
      ? `${window.location.origin}/?module=community&moment=${encodeURIComponent(postId)}`
      : null;
    const text = buildJourneyShareText(
      content.headline,
      content.subheadline,
      content.timelineLabel,
      showTimeline,
      returnPath ?? undefined,
    );

    try {
      if (Capacitor.isNativePlatform()) {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: content.headline, text, dialogTitle: 'Share your Journey Moment' });
      } else if (navigator.share) {
        await navigator.share({ title: 'My Journey Moment — SomaTech', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Copied to clipboard', description: 'Paste into your social app of choice.' });
      }
    } catch (e) {
      // User cancelled share — not an error
      if ((e as Error).name !== 'AbortError') {
        toast({ title: 'Share unavailable', description: 'Try copying the text manually.' });
      }
    }
  };

  const handleSaveAndShare = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const post = await journeyMomentsService.createPost({
        userId:          user.id,
        journeyId:       draft.journeyId,
        postType:        content.postType,
        visibility,
        identityMode:    visibility === 'community' ? 'display_name' : 'anonymous',
        templateKey:     content.templateKey,
        headline:        content.headline,
        subheadline:     content.subheadline,
        timelineLabel:   content.timelineLabel ?? undefined,
        stageLabel:      content.stageLabel,
        showTimeline,
        showPercentages: true,
        showExactAmounts: false,
        journeyPlanId:   planId,
        sourceRevision,
      });

      // Loop emit step — paired with `moment_share_opened` on the arrival side.
      track('moment_shared', {
        journey_id: draft.journeyId,
        visibility,
        post_type: content.postType,
        with_timeline: showTimeline,
        shareable: visibility !== 'private',
      });

      if (visibility === 'community' || visibility === 'anonymous') {
        toast({
          title: 'Journey Moment shared!',
          description: visibility === 'community'
            ? 'Your moment is live in the community feed.'
            : 'Posted anonymously to the community feed.',
        });
      } else {
        toast({ title: 'Journey Moment saved to your history.' });
      }

      haptics.success();
      await handleNativeShare(post.id);
      onDone();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('Rate limit')) {
        toast({
          title: 'Too many moments today',
          description: 'Max 3 Journey Moments per journey every 24 hours.',
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Could not save moment', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Prompt step ──────────────────────────────────────────────────────────────
  if (step === 'prompt') {
    return (
      <div className="space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold heading-tight">You built a plan.</h2>
          <p className="text-sm text-muted-foreground">
            Want to turn this into a Journey Moment?
          </p>
        </div>

        {/* Card preview */}
        <JourneyMomentCard
          journeyId={draft.journeyId as JourneyId}
          headline={content.headline}
          subheadline={content.subheadline}
          timelineLabel={content.timelineLabel}
          stageLabel={content.stageLabel}
          showTimeline={showTimeline}
        />

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => { haptics.tick(); onDone(); }}>
            Skip
          </Button>
          <Button className="flex-1 gap-1.5" onClick={() => { haptics.tap(); setStep('privacy'); }}>
            Share Moment
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-center text-[0.65rem] text-muted-foreground/60">
          No balances shown · Progress, not advice.
        </p>
      </div>
    );
  }

  // ── Privacy step ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <button onClick={() => setStep('prompt')} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <h2 className="text-base font-semibold heading-tight">Choose who sees this</h2>
      </div>

      {/* Mini card preview */}
      <JourneyMomentCard
        journeyId={draft.journeyId as JourneyId}
        headline={content.headline}
        subheadline={content.subheadline}
        timelineLabel={content.timelineLabel}
        stageLabel={content.stageLabel}
        showTimeline={showTimeline}
        compact
      />

      {/* Timeline toggle */}
      {content.timelineLabel && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Show timeline</p>
            <p className="text-xs text-muted-foreground">{content.timelineLabel}</p>
          </div>
          <button
            onClick={() => setShowTimeline(v => !v)}
            className={`relative h-6 w-11 rounded-full transition-colors ${showTimeline ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showTimeline ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      )}

      {/* Visibility options */}
      <div className="space-y-2">
        {VISIBILITY_OPTIONS.map(({ value, icon: Icon, label, sub }) => (
          <button
            key={value}
            onClick={() => { haptics.selectionChanged(); setVisibility(value); }}
            className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all ${
              visibility === value
                ? 'border-primary bg-primary/5'
                : 'border-border/60 hover:border-border'
            }`}
          >
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${visibility === value ? 'bg-primary/10' : 'bg-muted'}`}>
              <Icon className={`h-4 w-4 ${visibility === value ? 'text-primary' : 'text-muted-foreground'}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
            {visibility === value && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleNativeShare}
        >
          <Share2 className="h-3.5 w-3.5" />
          Share only
        </Button>
        <Button
          className="flex-1 gap-1.5"
          onClick={handleSaveAndShare}
          loading={saving}
        >
          <Download className="h-3.5 w-3.5" />
          {visibility === 'private' ? 'Save to history' : 'Post & share'}
        </Button>
      </div>

      <p className="text-center text-[0.65rem] text-muted-foreground/60">
        No balances shown · Privacy-safe by design
      </p>
    </div>
  );
}
