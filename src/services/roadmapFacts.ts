import type { Portfolio, PortfolioHolding } from '@/types/portfolio';
import type { InvestmentGoalRecord } from '@/services/investmentGoalService';
import {
  getHoldingMarketValue,
  isBrokerSourced,
  listHoldings,
  listPortfolios,
} from '@/services/portfolio/portfolioService';
import { getActiveInvestmentGoal } from '@/services/investmentGoalService';
import { listActiveUserSchwabConnections } from '@/services/brokerage/schwabService';

/**
 * What the rest of the product already knows, in the shape the roadmap needs.
 *
 * The roadmap used to see only `financial_profiles` — self-reported numbers —
 * while the app separately held a linked brokerage, real positions, and an
 * investment goal. So it asked people to tick boxes for facts it had already
 * established elsewhere.
 *
 * Everything here is deliberately narrow. A fact is included only when the data
 * supports it outright; anything requiring a guess is left out and surfaced as
 * evidence for the user to judge instead. Notably absent:
 *
 *  - whether an account is taxable. Schwab's `account_type` we store is the
 *    margin class (MARGIN / CASH / PORTFOLIO_MARGIN), not the tax treatment,
 *    so an IRA and a taxable brokerage are indistinguishable to us.
 *  - whether a position is an index fund or a single stock. PortfolioHolding
 *    has no instrument type, and inferring one from the ticker would be a
 *    guess dressed up as a check.
 */
export interface RoadmapFacts {
  /** An active brokerage connection exists. */
  brokerageConnected: boolean;
  /** Positions a broker actually reports, excluding cash. */
  brokerHoldingsCount: number;
  /** Positions that exist only in the plan — no broker confirms them. */
  plannedOnlyHoldingsCount: number;
  /** Total market value of held positions, excluding cash. */
  investedValueUsd: number | null;
  /** Largest single position as a share of invested value, 0–100. */
  largestPositionPct: number | null;
  /** The active investment goal, reduced to what the roadmap reasons about. */
  goal: {
    targetAmountUsd: number;
    monthlyContributionUsd: number;
    horizonYears: number;
  } | null;
}

export const EMPTY_FACTS: RoadmapFacts = {
  brokerageConnected: false,
  brokerHoldingsCount: 0,
  plannedOnlyHoldingsCount: 0,
  investedValueUsd: null,
  largestPositionPct: null,
  goal: null,
};

/** Cash is a balance, not a position — it would otherwise dominate concentration. */
const isInvestedPosition = (h: PortfolioHolding) => h.bucket !== 'CASH';

export function buildRoadmapFacts(input: {
  holdings: PortfolioHolding[];
  brokerageConnected: boolean;
  goal: InvestmentGoalRecord | null;
}): RoadmapFacts {
  const positions = (input.holdings ?? []).filter(isInvestedPosition);
  const values = positions.map(getHoldingMarketValue).filter((v) => Number.isFinite(v) && v > 0);
  const invested = values.reduce((sum, v) => sum + v, 0);

  return {
    brokerageConnected: input.brokerageConnected,
    brokerHoldingsCount: positions.filter(isBrokerSourced).length,
    plannedOnlyHoldingsCount: positions.filter((h) => !isBrokerSourced(h)).length,
    investedValueUsd: values.length > 0 ? invested : null,
    largestPositionPct:
      invested > 0 ? (Math.max(...values) / invested) * 100 : null,
    goal: input.goal
      ? {
          targetAmountUsd: Number(input.goal.target_amount),
          monthlyContributionUsd: Number(input.goal.monthly_contribution ?? 0),
          horizonYears: Number(input.goal.horizon_years),
        }
      : null,
  };
}

// ── Evidence ──────────────────────────────────────────────────────────────────

/**
 * Why evidence rather than more auto-completion: the honest answer for most
 * investing milestones is "the app can see something relevant but cannot settle
 * the question". Auto-completing on a partial match is how the debt milestones
 * came to be permanently wrong. So the roadmap states what it sees and lets the
 * person decide — one click, but their click.
 */
export interface MilestoneEvidence {
  /** Whether what we see points toward the milestone being done. */
  tone: 'supports' | 'contradicts' | 'informs';
  /** One sentence, display-ready. */
  statement: string;
  /** Whether to offer a one-click "mark complete" alongside it. */
  offersCompletion: boolean;
}

const usd = (value: number) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type EvidenceFn = (facts: RoadmapFacts) => MilestoneEvidence | null;

const EVIDENCE: Record<string, EvidenceFn> = {
  'p3-taxable': (f) => {
    if (!f.brokerageConnected || f.brokerHoldingsCount === 0) return null;
    const value = f.investedValueUsd != null ? ` worth ${usd(f.investedValueUsd)}` : '';
    return {
      tone: 'supports',
      // Deliberately a question. We can see the account and the positions; we
      // cannot see the tax treatment, and saying "done" would assert it.
      statement:
        `Your linked brokerage reports ${plural(f.brokerHoldingsCount, 'position')}${value}. ` +
        `If that account is taxable, this is already done.`,
      offersCompletion: true,
    };
  },

  'p3-portfolio-audit': (f) => {
    if (f.largestPositionPct == null) return null;
    const pct = f.largestPositionPct.toFixed(1);
    if (f.largestPositionPct > 5) {
      return {
        tone: 'contradicts',
        statement:
          `Your largest position is ${pct}% of the portfolio. This milestone asks for ` +
          `individual stocks under 5% — worth checking whether that holding is a fund or a single name.`,
        offersCompletion: false,
      };
    }
    return {
      tone: 'supports',
      statement: `No position exceeds ${pct}% of the portfolio, so nothing breaches the 5% guideline.`,
      offersCompletion: true,
    };
  },

  'p3-goal-savings': (f) => {
    if (!f.goal) return null;
    return {
      tone: 'informs',
      statement:
        `You have a goal of ${usd(f.goal.targetAmountUsd)} over ${plural(f.goal.horizonYears, 'year')}, ` +
        `funded at ${usd(f.goal.monthlyContributionUsd)}/month.`,
      offersCompletion: false,
    };
  },

  'p5-retire-date': (f) => {
    if (!f.goal) return null;
    return {
      tone: 'informs',
      statement: `Your investment goal already assumes a ${plural(f.goal.horizonYears, 'year')} horizon.`,
      offersCompletion: false,
    };
  },
};

export function evidenceFor(milestoneId: string, facts: RoadmapFacts | null): MilestoneEvidence | null {
  if (!facts) return null;
  return EVIDENCE[milestoneId]?.(facts) ?? null;
}

// ── Contribution reconciliation ───────────────────────────────────────────────

/**
 * The roadmap derives a savings capacity from the snapshot; the investment goal
 * carries a monthly contribution the user set separately. Nothing reconciled
 * them, so two surfaces could quote different numbers for the same intent.
 */
export interface ContributionCheck {
  /** From the snapshot: take-home minus expenses. */
  capacityUsd: number;
  /** From the investment goal. */
  committedUsd: number;
  /** committed − capacity. Positive means the goal outruns the snapshot. */
  differenceUsd: number;
  status: 'aligned' | 'goal_exceeds_capacity' | 'capacity_unused';
  message: string;
}

/** Below this the two numbers are saying the same thing. */
const RECONCILE_TOLERANCE_PCT = 10;

export function reconcileContribution(
  monthlyCapacityUsd: number | null,
  facts: RoadmapFacts | null,
): ContributionCheck | null {
  const committed = facts?.goal?.monthlyContributionUsd;
  if (monthlyCapacityUsd == null || committed == null) return null;
  // A zero-capacity snapshot makes every percentage infinite; there is nothing
  // to reconcile against.
  if (monthlyCapacityUsd <= 0) return null;

  const difference = committed - monthlyCapacityUsd;
  const driftPct = Math.abs(difference / monthlyCapacityUsd) * 100;

  if (driftPct <= RECONCILE_TOLERANCE_PCT) {
    return {
      capacityUsd: monthlyCapacityUsd,
      committedUsd: committed,
      differenceUsd: difference,
      status: 'aligned',
      message: `Your goal's ${usd(committed)}/month matches what your snapshot says you can save.`,
    };
  }

  if (difference > 0) {
    return {
      capacityUsd: monthlyCapacityUsd,
      committedUsd: committed,
      differenceUsd: difference,
      status: 'goal_exceeds_capacity',
      message:
        `Your goal assumes ${usd(committed)}/month, but your snapshot leaves ${usd(monthlyCapacityUsd)} ` +
        `after expenses — a gap of ${usd(Math.abs(difference))}. The roadmap's timings use the snapshot.`,
    };
  }

  return {
    capacityUsd: monthlyCapacityUsd,
    committedUsd: committed,
    differenceUsd: difference,
    status: 'capacity_unused',
    message:
      `Your snapshot leaves ${usd(monthlyCapacityUsd)}/month but your goal only allocates ` +
      `${usd(committed)} — ${usd(Math.abs(difference))} is unassigned.`,
  };
}

// ── Loading ───────────────────────────────────────────────────────────────────

/**
 * Assembles the bundle from live sources.
 *
 * Every source is optional in practice — a user may have no portfolio, no
 * broker, or no goal — so each failure degrades to "we don't know" rather than
 * taking the roadmap down with it. A roadmap that renders without evidence is
 * the old behaviour; a roadmap that throws is worse than the bug this fixes.
 */
export async function loadRoadmapFacts(userId: string): Promise<RoadmapFacts> {
  const [portfolios, connections, goal] = await Promise.all([
    listPortfolios(userId).catch(() => [] as Portfolio[]),
    listActiveUserSchwabConnections().catch(() => []),
    getActiveInvestmentGoal(userId).catch(() => null),
  ]);

  const primary = portfolios.find((p) => p.is_default) ?? portfolios[0] ?? null;
  const holdings = primary
    ? await listHoldings(primary.id).catch(() => [] as PortfolioHolding[])
    : [];

  return buildRoadmapFacts({
    holdings,
    brokerageConnected: connections.length > 0,
    goal,
  });
}
