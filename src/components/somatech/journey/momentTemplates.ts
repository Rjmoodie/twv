import type { JourneyId } from './journeyConfig';
import type { JourneyDraft } from '@/hooks/useJourney';
import { normalizeInvestmentRiskProfile, projectInvestmentGoal } from '@/lib/investmentGoalEngine';
import { getJourney } from './journeyConfig';
import { analyzeJourney } from '@/lib/journeyMetrics';

export type PostType =
  | 'journey_started'
  | 'milestone_reached'
  | 'streak'
  | 'projection_improved'
  | 'goal_completed';

export type ReactionEmoji = '👏' | '🔥' | '💪' | '🚀';
export const REACTION_EMOJIS: ReactionEmoji[] = ['👏', '🔥', '💪', '🚀'];

export type PostVisibility = 'private' | 'anonymous' | 'community';

export interface MomentContent {
  postType:      PostType;
  templateKey:   string;
  headline:      string;
  subheadline:   string;
  timelineLabel: string | null;
  stageLabel:    string;
}

const JOURNEY_NAMES: Record<JourneyId, string> = {
  'debt-freedom':    'Debt Freedom Journey',
  'budget-clarity':  'Budget Clarity Journey',
  'investor-starter':'Investor Starter Journey',
  'home-buying':     'Home Buying Journey',
  'business-owner':  'Business Owner Journey',
};

const JOURNEY_STAGES: Record<JourneyId, string> = {
  'debt-freedom':    'Stabilize Stage',
  'budget-clarity':  'Stabilize Stage',
  'investor-starter':'Build Stage',
  'home-buying':     'Build Stage',
  'business-owner':  'Optimize Stage',
};

function fmtDate(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.ceil(months));
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Generates the display content for a Journey Moment card from the completed draft.
 * Never exposes raw balances — only sanitized milestones and timelines.
 */
export function generateMomentContent(draft: JourneyDraft): MomentContent {
  const { journeyId, answers } = draft;
  const n = (k: string) => Number(answers[k] ?? 0);
  const stageLabel  = JOURNEY_STAGES[journeyId];
  const journey = getJourney(journeyId);
  const analysis = journey ? analyzeJourney(journey, answers) : null;

  if (journeyId === 'debt-freedom') {
    let timelineLabel: string | null = null;
    let headline = 'Started my Debt Freedom plan today.';
    let subheadline = 'Taking the first step toward financial freedom.';

    const months = analysis?.metrics.find(metric => metric.id === 'debt-free-date')?.numericValue;
    if (months !== null && months !== undefined) {
      if (months < 480) {
        timelineLabel = `${Math.ceil(months)} months to go`;
        headline = 'Started my Debt Freedom plan today.';
        subheadline = `Projected debt-free: ${analysis?.primaryTargetDate
          ? new Date(`${analysis.primaryTargetDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
          : fmtDate(months)}.`;
      } else {
        headline = 'Started my Debt Freedom plan.';
        subheadline = 'Working on accelerating my payoff timeline.';
      }
    }

    return {
      postType: 'journey_started', templateKey: 'debt_freedom_started',
      headline, subheadline, timelineLabel, stageLabel,
    };
  }

  if (journeyId === 'budget-clarity') {
    const rate = analysis?.metrics.find(metric => metric.id === 'savings-rate')?.numericValue;

    const subheadline = rate !== null && rate !== undefined && rate > 0
      ? `Tracking a ${rate.toFixed(0)}% savings rate.`
      : 'Mapped out where every dollar goes.';

    return {
      postType: 'journey_started', templateKey: 'budget_clarity_started',
      headline:  'Built my first budget clarity plan today.',
      subheadline,
      timelineLabel: null,
      stageLabel,
    };
  }

  if (journeyId === 'investor-starter') {
    const goal     = n('investmentGoal');
    const current  = n('currentSavings');
    const monthly  = n('monthlyContribution');
    const horizon = n('investmentHorizonYears') || 20;

    let timelineLabel: string | null = null;
    let subheadline = 'Committed to consistent monthly contributions.';

    if (goal > 0 && current >= 0 && monthly >= 0 && horizon >= 1 && horizon <= 50) {
      const projection = projectInvestmentGoal({
        targetAmount: goal,
        currentBalance: current,
        monthlyContribution: monthly,
        horizonYears: horizon,
        riskProfile: normalizeInvestmentRiskProfile(answers.riskTolerance),
      });
      timelineLabel = `${horizon}-year goal horizon`;
      subheadline = `${projection.expectedGoalProbabilityPct.toFixed(0)}% modeled likelihood at my current contribution — reviewing as the plan changes.`;
    }

    return {
      postType: 'journey_started', templateKey: 'investor_started',
      headline:  'Started my investor journey today.',
      subheadline,
      timelineLabel,
      stageLabel,
    };
  }

  if (journeyId === 'home-buying') {
    let timelineLabel: string | null = null;
    let subheadline = 'Planning my path to homeownership.';
    const months = analysis?.metrics.find(metric => metric.id === 'deposit-date')?.numericValue;
    if (months === 0) {
      subheadline = 'Deposit is ready — time to move.';
    } else if (months !== null && months !== undefined) {
      if (months < 480) {
        timelineLabel = `${months} months to deposit`;
        subheadline = `On track for the selected deposit target by ${analysis?.primaryTargetDate
          ? new Date(`${analysis.primaryTargetDate}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
          : fmtDate(months)}.`;
      }
    }

    return {
      postType: 'journey_started', templateKey: 'home_buying_started',
      headline:  'Started my Home Buying plan today.',
      subheadline,
      timelineLabel,
      stageLabel,
    };
  }

  if (journeyId === 'business-owner') {
    const profitMetric = analysis?.metrics.find(metric => metric.id === 'operating-profit');
    const profit = profitMetric?.numericValue;
    const margin = profitMetric?.sub?.match(/^-?\d+(?:\.\d+)?%/)?.[0];

    const subheadline = margin && profit !== null && profit !== undefined && profit > 0
      ? `Running at a ${margin} operating margin before owner pay.`
      : 'Mapping business runway and breakeven.';

    return {
      postType: 'journey_started', templateKey: 'business_owner_started',
      headline:  'Built my Business Owner financial plan.',
      subheadline,
      timelineLabel: null,
      stageLabel,
    };
  }

  return {
    postType: 'journey_started', templateKey: 'generic_started',
    headline:  'Started my financial journey today.',
    subheadline: 'Taking the first step toward my goals.',
    timelineLabel: null,
    stageLabel,
  };
}

export { JOURNEY_NAMES, JOURNEY_STAGES };
