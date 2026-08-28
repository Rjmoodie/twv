import React, { useState, useEffect, useCallback } from 'react';
import { useFinancialCoach } from '@/hooks/useFinancialCoach';
import { useAuth } from '@/components/somatech/AuthProvider';
import { coachService } from '@/services/coachService';
import type { UserMilestone, MilestoneStatus } from '@/services/coachService';
import { buildRoadmap, detectAutoCompletions } from '@/services/roadmapService';
import type { PersonalisedRoadmap } from '@/services/roadmapService';
import { EMPTY_FACTS, loadRoadmapFacts } from '@/services/roadmapFacts';
import ProfileIntake from './financial-coach/ProfileIntake';
import ChatInterface from './financial-coach/ChatInterface';
import ToolModal from './financial-coach/ToolModal';
import SnapshotIntake from './financial-coach/SnapshotIntake';
import RoadmapView from './financial-coach/RoadmapView';
import { consumeCoachPrefill } from '@/lib/askCoach';
import { Loader2, Brain, MessageCircle, Map, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FinancialProfile } from '@/services/coachService';

function buildContextSummary(profile: FinancialProfile | null): string | undefined {
  if (!profile) return undefined;

  const parts: string[] = [];

  if (profile.age) parts.push(`${profile.age}yo`);
  if (profile.primary_concern) parts.push(profile.primary_concern.replace(/-/g, ' '));

  if (profile.snapshot_completed) {
    const expenses = profile.monthly_expenses ?? 0;
    const liquid   = profile.liquid_savings ?? 0;
    if (expenses > 0 && liquid >= 0) {
      const runway = liquid / expenses;
      parts.push(`${runway.toFixed(1)} mo runway`);
    }
    if ((profile.high_interest_debt ?? 0) > 0) parts.push('high-interest debt');
  }

  return parts.length > 0 ? parts.join(' · ') : undefined;
}

interface FinancialCoachProps {
  onNavigate?: (moduleId: string) => void;
  initialPrompt?: string;
  compact?: boolean;
  contextualSuggestions?: string[];
}

type ActiveTab = 'chat' | 'roadmap';

export default function FinancialCoach({ onNavigate, initialPrompt, compact, contextualSuggestions }: FinancialCoachProps) {
  const { user } = useAuth();
  const {
    messages,
    profile,
    isLoading,
    isSending,
    hasCompletedIntake,
    quota,
    quotaExceeded,
    quotaResetAt,
    sendMessage,
    saveProfile,
    refreshProfile,
    startNewConversation,
    setRoadmapContext,
  } = useFinancialCoach();

  const [activeTool, setActiveTool] = useState<{ type: string; prefill: Record<string, unknown> } | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat');

  // Roadmap state
  const [savedMilestones, setSavedMilestones] = useState<UserMilestone[]>([]);
  const [roadmap, setRoadmap] = useState<PersonalisedRoadmap | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState(false);

  // Load milestones and build roadmap whenever profile/milestones change
  const loadRoadmap = useCallback(async () => {
    if (!user || !profile) return;
    setRoadmapLoading(true);
    try {
      const milestones = await coachService.getMilestones(user.id);

      // Auto-complete detection
      const autoIds = detectAutoCompletions(profile, milestones);
      let finalMilestones = milestones;
      if (autoIds.length > 0) {
        await coachService.bulkUpsertMilestones(
          user.id,
          autoIds.map((id) => ({ milestoneId: id, status: 'complete' as MilestoneStatus }))
        );
        finalMilestones = await coachService.getMilestones(user.id);
      }
      setSavedMilestones(finalMilestones);
      // Portfolio, brokerage, and goal data. Degrades to EMPTY_FACTS rather than
      // failing the roadmap — evidence is an enhancement, not a prerequisite.
      const facts = await loadRoadmapFacts(user.id).catch(() => EMPTY_FACTS);
      const built = buildRoadmap(profile, finalMilestones, facts);
      setRoadmap(built);
      setRoadmapContext(built.summaryText);
    } catch (err) {
      console.error('Roadmap load error:', err);
    } finally {
      setRoadmapLoading(false);
    }
  // profile?.primary_concern and snapshot_completed are the fields that actually
  // change the roadmap shape — using the object reference causes spurious reloads.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.primary_concern, profile?.snapshot_completed, profile?.completed_intake]);

  useEffect(() => {
    if (hasCompletedIntake && profile) {
      loadRoadmap();
    }
  }, [hasCompletedIntake, profile, loadRoadmap]);

  // On mount: use direct initialPrompt prop (panel mode) or fall back to sessionStorage prefill.
  useEffect(() => {
    const prompt = initialPrompt ?? consumeCoachPrefill();
    if (prompt) setPendingChatPrompt(prompt);
    refreshProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire pending prompt once the coach is loaded and on the chat tab
  useEffect(() => {
    if (pendingChatPrompt && activeTab === 'chat' && !isLoading) {
      sendMessage(pendingChatPrompt);
      setPendingChatPrompt(null);
    }
  }, [pendingChatPrompt, activeTab, isLoading, sendMessage]);

  const handleLaunchTool = (type: string, prefill: Record<string, unknown>) => {
    const navigableModules: Record<string, string> = {
      'retirement-planning': 'retirement-planning',
      'personal-finance':    'personal-finance',
    };
    if (navigableModules[type] && onNavigate) {
      onNavigate(navigableModules[type]);
    } else {
      setActiveTool({ type, prefill });
    }
  };

  const handleIntakeComplete = async (intakeProfile: Parameters<typeof saveProfile>[0]) => {
    await saveProfile(intakeProfile);
    await sendMessage("I've just set up my profile. What should I focus on first?");
  };

  const handleSnapshotSave = async (snapshot: Parameters<typeof saveProfile>[0]) => {
    await saveProfile(snapshot);
    // Leaving this set would trap the user in the form after a successful edit.
    setEditingSnapshot(false);
    // loadRoadmap will re-run via useEffect when profile updates
  };

  const handleMarkMilestone = useCallback(
    async (milestoneId: string, status: MilestoneStatus) => {
      if (!user) return;
      await coachService.upsertMilestone(user.id, milestoneId, status);
      await loadRoadmap();
    },
    [user, loadRoadmap]
  );

  const handleAskCoach = useCallback(
    (prompt: string) => {
      setActiveTab('chat');
      setPendingChatPrompt(prompt);
    },
    []
  );

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Brain className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold">Financial Coach</h2>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sign in to get personalised, research-backed financial guidance tailored to your situation.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasCompletedIntake) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-6 pt-6 pb-2 border-b border-border/60">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Financial Coach</h1>
              <p className="text-xs text-muted-foreground">Let's build your profile first — takes about 2 minutes.</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ProfileIntake onComplete={handleIntakeComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar — roadmap hidden in compact/panel mode */}
      {!compact && (
        <div className="flex border-b border-border/60 shrink-0">
          <TabButton
            active={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            icon={<MessageCircle className="h-4 w-4" />}
            label="Chat"
          />
          <TabButton
            active={activeTab === 'roadmap'}
            onClick={() => setActiveTab('roadmap')}
            icon={<Map className="h-4 w-4" />}
            label="Roadmap"
          />
        </div>
      )}

      {/* Tab content — use CSS visibility so Chat is never unmounted (preserves input state) */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div className={`absolute inset-0 ${activeTab === 'chat' ? '' : 'invisible pointer-events-none'}`}>
          <ChatInterface
            messages={messages}
            isSending={isSending}
            onSend={sendMessage}
            onNewConversation={startNewConversation}
            onLaunchTool={handleLaunchTool}
            contextSummary={buildContextSummary(profile)}
            quota={quota}
            quotaExceeded={quotaExceeded}
            quotaResetAt={quotaResetAt}
            onUpgrade={() => onNavigate?.('subscription')}
            hideToolbar={compact}
            contextualSuggestions={contextualSuggestions}
          />
        </div>

        {activeTab === 'roadmap' && (
          <div className="absolute inset-0 overflow-y-auto">
            {!profile?.snapshot_completed || editingSnapshot ? (
              <div className="p-4">
                <SnapshotIntake profile={profile ?? {}} onSave={handleSnapshotSave} />
              </div>
            ) : roadmapLoading || !roadmap ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {/* Once snapshot_completed flips there was no route back into the
                    form, so a number that arrived wrong — from a journey, or from
                    a bank sync — could never be corrected. */}
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-muted-foreground"
                    onClick={() => setEditingSnapshot(true)}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Edit your numbers
                  </Button>
                </div>
                <RoadmapView
                  roadmap={roadmap}
                  profile={profile ?? {}}
                  savedMilestones={savedMilestones}
                  onMarkMilestone={handleMarkMilestone}
                  onAskCoach={handleAskCoach}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ToolModal
        toolType={activeTool?.type ?? null}
        prefill={activeTool?.prefill ?? {}}
        onClose={() => setActiveTool(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
