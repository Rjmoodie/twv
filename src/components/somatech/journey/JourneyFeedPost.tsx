import { memo, useState, useCallback } from 'react';
import { useHaptics } from '@/hooks/useHaptics';
import { Flag, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import JourneyMomentCard from './JourneyMomentCard';
import type { JourneyPost } from '@/services/journeyMomentsService';
import type { JourneyId } from './journeyConfig';
import { REACTION_EMOJIS, type ReactionEmoji } from './momentTemplates';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type ReportReason = 'privacy' | 'misleading' | 'spam' | 'harassment' | 'financial_advice' | 'other';

const REACTION_LABELS: Record<ReactionEmoji, string> = {
  '👏': 'Clap', '🔥': 'Fire', '💪': 'Strong', '🚀': 'Rocket',
};

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'privacy',          label: 'Privacy concern' },
  { value: 'misleading',       label: 'Misleading content' },
  { value: 'spam',             label: 'Spam' },
  { value: 'financial_advice', label: 'Giving financial advice' },
  { value: 'other',            label: 'Other' },
];

const EMOJI_TO_COUNT: Record<ReactionEmoji, keyof Pick<JourneyPost,
  'reaction_clap' | 'reaction_fire' | 'reaction_muscle' | 'reaction_rocket'>> = {
  '👏': 'reaction_clap',
  '🔥': 'reaction_fire',
  '💪': 'reaction_muscle',
  '🚀': 'reaction_rocket',
};

interface JourneyFeedPostProps {
  post:           JourneyPost;
  onReact:        (postId: string, emoji: ReactionEmoji) => void;
  onReport:       (postId: string, reason: ReportReason) => void;
  isOwn?:         boolean;
  isSameJourney?: boolean;
  onDelete?:      (postId: string) => void;
  className?:     string;
}

const JourneyFeedPost = memo(function JourneyFeedPost({
  post, onReact, onReport, isOwn = false, isSameJourney = false, onDelete, className,
}: JourneyFeedPostProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const haptics = useHaptics();

  const totalReactions =
    post.reaction_clap + post.reaction_fire + post.reaction_muscle + post.reaction_rocket;

  const handleReact = useCallback(
    (emoji: ReactionEmoji) => {
      haptics.selectionChanged(); // tactile feedback per emoji tap
      onReact(post.id, emoji);
    },
    [onReact, post.id],
  );

  const handleReport = useCallback(
    (reason: ReportReason) => {
      haptics.tick();
      onReport(post.id, reason);
    },
    [onReport, post.id],
  );

  const handleDeleteConfirmed = useCallback(() => {
    haptics.warning();
    onDelete?.(post.id);
    setConfirmDelete(false);
  }, [onDelete, post.id]);

  const relativeTime = formatDistanceToNow(new Date(post.created_at), { addSuffix: true });
  const authorLabel  = post.identity_mode === 'display_name' ? (post.author_display_name || 'Community member') : 'Anonymous';

  return (
    <>
      <article className={cn('animate-fade-in space-y-2', className)}>
        {/* Same-journey context label */}
        {isSameJourney && (
          <div className="flex items-center gap-1.5 px-0.5">
            <Users className="h-3 w-3 text-primary" aria-hidden />
            <span className="text-xs font-medium text-primary">Same journey as you</span>
          </div>
        )}

        {/* Card */}
        <JourneyMomentCard
          journeyId={post.journey_id as JourneyId}
          headline={post.headline}
          subheadline={post.subheadline ?? ''}
          timelineLabel={post.timeline_label}
          stageLabel={post.stage_label}
          showTimeline={post.show_timeline}
          compact
        />

        {/* Metadata + more menu */}
        <div className="flex items-center justify-between px-0.5">
          <p className="text-xs text-muted-foreground">
            {authorLabel} · {relativeTime}
          </p>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Post options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {isOwn ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Remove moment
                </DropdownMenuItem>
              ) : (
                REPORT_REASONS.map(r => (
                  <DropdownMenuItem key={r.value} onClick={() => handleReport(r.value)}>
                    <Flag className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    {r.label}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Reaction bar */}
        <div className="flex items-center gap-2 px-0.5">
          {REACTION_EMOJIS.map(emoji => {
            const count    = post[EMOJI_TO_COUNT[emoji]] as number;
            const isActive = post.my_reaction === emoji;
            return (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                title={REACTION_LABELS[emoji]}
                aria-label={`${REACTION_LABELS[emoji]}${count > 0 ? `, ${count}` : ''}`}
                aria-pressed={isActive}
                className={`flex min-h-[36px] items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium
                  transition-all active:scale-95
                  ${isActive
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/60 bg-card text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
              >
                <span>{emoji}</span>
                {count > 0 && <span className="tabular-nums">{count}</span>}
              </button>
            );
          })}

          {totalReactions > 0 && (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">
              {totalReactions}
            </span>
          )}
        </div>
      </article>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this Journey Moment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove it from your history and from the community feed
              if it was shared. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

export default JourneyFeedPost;
