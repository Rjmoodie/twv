import type { JourneyId } from '@/components/somatech/journey/journeyConfig';
import { normalizeInvestmentRiskProfile, projectInvestmentGoal } from '@/lib/investmentGoalEngine';
import { calendarDayInTimeZone } from '@/lib/calendarDate';
import { projectDebt } from '@/lib/journeyMetrics';

export interface CalendarSeed {
  title:       string;
  description: string;
  event_date:  string;  // ISO date YYYY-MM-DD
  event_type:  'journey_milestone' | 'check_in' | 'coach_reminder' | 'savings_target';
  category:    'savings' | 'debt' | 'investment' | 'home' | 'business' | 'general';
  journey_id:  string;
  metadata:    Record<string, unknown>;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(base: Date, n: number): Date {
  const day = base.getUTCDate();
  const target = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + n, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// ── Debt Freedom ──────────────────────────────────────────────────────────────

function debtFreedomSeeds(
  answers: Record<string, string | number>,
  now: Date,
): CalendarSeed[] {
  const principal    = Number(answers.totalDebt ?? 0);
  const payment      = Number(answers.monthlyPayment ?? 0);
  const rateAnnualPct = Number(answers.interestRate ?? 18);

  if (principal <= 0 || payment <= 0) return [];

  const projection = projectDebt(principal, rateAnnualPct, payment);
  if (projection.months === null) return [];
  const months = Math.min(projection.months, 600);

  const seeds: CalendarSeed[] = [];

  // Monthly check-ins (first 12 months)
  const checkInCount = Math.min(12, months);
  for (let i = 1; i <= checkInCount; i++) {
    seeds.push({
      title:       `Debt check-in — month ${i}`,
      description: 'Review your balance, confirm payment went through, and track momentum.',
      event_date:  isoDate(addMonths(now, i)),
      event_type:  'check_in',
      category:    'debt',
      journey_id:  'debt-freedom',
      metadata:    { month: i, amount: payment, commitmentType: 'total_debt_payment' },
    });
  }

  // Quarterly milestones — label and date computed together to stay in sync
  const quarterDefs = [
    { pct: 0.25, label: '25% debt eliminated', desc: "You're a quarter of the way to debt freedom. Celebrate the progress." },
    { pct: 0.50, label: '50% debt eliminated', desc: "Halfway there — your balance is falling fast." },
    { pct: 0.75, label: '75% debt eliminated', desc: "Almost done. The finish line is in sight." },
  ];
  const seenMonths = new Set<number>();
  for (const { pct, label, desc } of quarterDefs) {
    const m = Math.round(months * pct);
    if (m > 0 && m < months && !seenMonths.has(m)) {
      seenMonths.add(m);
      seeds.push({
        title:       label,
        description: desc,
        event_date:  isoDate(addMonths(now, m)),
        event_type:  'journey_milestone',
        category:    'debt',
        journey_id:  'debt-freedom',
        metadata:    { quarter: pct, targetMonth: m },
      });
    }
  }

  // Payoff day
  seeds.push({
    title:       '🎉 Debt-free day',
    description: `Projected final payoff — ${months} months of consistent payments.`,
    event_date:  isoDate(addMonths(now, months)),
    event_type:  'journey_milestone',
    category:    'debt',
    journey_id:  'debt-freedom',
    metadata:    { payoffMonth: months },
  });

  return seeds;
}

// ── Budget Clarity ────────────────────────────────────────────────────────────

function budgetClaritySeeds(now: Date): CalendarSeed[] {
  const seeds: CalendarSeed[] = [];
  // Monthly budget review for 12 months
  for (let i = 1; i <= 12; i++) {
    seeds.push({
      title:       `Monthly budget review`,
      description: 'Compare actual spend to your plan. Adjust any category that drifted.',
      event_date:  isoDate(addMonths(now, i)),
      event_type:  'check_in',
      category:    'savings',
      journey_id:  'budget-clarity',
      metadata:    { month: i },
    });
  }
  // Quarterly deep-dives
  for (const m of [3, 6, 9, 12]) {
    seeds.push({
      title:       `Quarterly spending deep-dive`,
      description: 'Look at 3-month trends, renegotiate subscriptions, spot new savings.',
      event_date:  isoDate(addDays(addMonths(now, m), 1)),
      event_type:  'journey_milestone',
      category:    'savings',
      journey_id:  'budget-clarity',
      metadata:    { quarter: m / 3 },
    });
  }
  return seeds;
}

// ── Investor Starter ──────────────────────────────────────────────────────────

function investorStarterSeeds(
  answers: Record<string, string | number>,
  now: Date,
): CalendarSeed[] {
  const goal         = Number(answers.investmentGoal ?? 10000);
  const current      = Number(answers.currentSavings ?? 0);
  const monthly      = Number(answers.monthlyContribution ?? 200);
  const horizonYears = Number(answers.investmentHorizonYears ?? 20);
  const riskTolerance = String(answers.riskTolerance ?? 'moderate');
  const projection = projectInvestmentGoal({
    targetAmount: goal,
    currentBalance: current,
    monthlyContribution: monthly,
    horizonYears,
    riskProfile: normalizeInvestmentRiskProfile(riskTolerance),
  });
  const months = Math.round(horizonYears * 12);

  const seeds: CalendarSeed[] = [];

  // Monthly contribution reminders (first 6)
  const reminderCount = Math.min(6, months);
  for (let i = 1; i <= reminderCount; i++) {
    seeds.push({
      title:       `Monthly investment — add $${monthly.toLocaleString()}`,
      description: 'Transfer your scheduled monthly contribution to your investment account.',
      event_date:  isoDate(addMonths(now, i)),
      event_type:  'check_in',
      category:    'investment',
      journey_id:  'investor-starter',
      metadata:    { month: i, amount: monthly },
    });
  }

  // Quarterly portfolio reviews
  for (const m of [3, 6, 9, 12].filter(m => m <= months)) {
    seeds.push({
      title:       `Quarterly portfolio review`,
      description: 'Check allocation drift, rebalance if needed, review performance vs benchmark.',
      event_date:  isoDate(addDays(addMonths(now, m), 2)),
      event_type:  'journey_milestone',
      category:    'investment',
      journey_id:  'investor-starter',
      metadata:    { quarter: m / 3 },
    });
  }

  // Target-date review — avoid claiming the goal will definitely be reached.
  if (months > 0) {
    seeds.push({
      title:       `Review $${goal.toLocaleString()} investment goal`,
      description: `${projection.expectedGoalProbabilityPct.toFixed(0)}% modeled likelihood at setup. Compare actual progress with the required $${Math.ceil(projection.requiredMonthlyContribution).toLocaleString()}/month path.`,
      event_date:  isoDate(addMonths(now, months)),
      event_type:  'savings_target',
      category:    'investment',
      journey_id:  'investor-starter',
      metadata:    { goalAmount: goal, months, assumptionVersion: projection.assumptions.version },
    });
  }

  return seeds;
}

// ── Home Buying ───────────────────────────────────────────────────────────────

function homeBuyingSeeds(
  answers: Record<string, string | number>,
  now: Date,
): CalendarSeed[] {
  const homePrice      = Number(answers.targetHomePrice ?? 400000);
  const currentSavings = Number(answers.currentSavings ?? 0);
  const monthlySavings = Number(answers.monthlySavings ?? 500);
  const depositTarget  = homePrice * (Number(answers.depositPercent ?? 20) / 100);
  const remaining      = Math.max(0, depositTarget - currentSavings);
  const months         = monthlySavings > 0 ? Math.ceil(remaining / monthlySavings) : 120;

  const seeds: CalendarSeed[] = [];

  // Monthly deposit reminders (first 12)
  const reminderCount = Math.min(12, months);
  for (let i = 1; i <= reminderCount; i++) {
    seeds.push({
      title:       `Deposit savings — add $${monthlySavings.toLocaleString()}`,
      description: 'Transfer this month\'s deposit contribution to your dedicated savings account.',
      event_date:  isoDate(addMonths(now, i)),
      event_type:  'check_in',
      category:    'home',
      journey_id:  'home-buying',
      metadata:    { month: i, amount: monthlySavings },
    });
  }

  // Halfway-to-deposit milestone, based on the user's chosen deposit target.
  const halfwayMonths = Math.ceil((depositTarget * 0.5 - currentSavings) / (monthlySavings || 1));
  if (halfwayMonths > 0 && halfwayMonths <= months) {
    seeds.push({
      title:       `Halfway to your deposit target`,
      description: `You have reached 50% of the deposit target used in this plan. Review current lender requirements before relying on it.`,
      event_date:  isoDate(addMonths(now, halfwayMonths)),
      event_type:  'journey_milestone',
      category:    'home',
      journey_id:  'home-buying',
      metadata:    { milestone: 'half_deposit' },
    });
  }

  // Full deposit
  if (months > 0 && months < 480) {
    seeds.push({
      title:       `🏠 Planned deposit target reached`,
      description: `$${depositTarget.toLocaleString()} projected. Review closing costs, emergency reserves, and current lender requirements before pre-approval.`,
      event_date:  isoDate(addMonths(now, months)),
      event_type:  'savings_target',
      category:    'home',
      journey_id:  'home-buying',
      metadata:    { depositTarget, months },
    });
  }

  // Quarterly market checks
  for (const m of [3, 6, 9, 12].filter(m => m <= months)) {
    seeds.push({
      title:       `Property market check`,
      description: 'Review median prices in your target area and adjust your deposit target if needed.',
      event_date:  isoDate(addDays(addMonths(now, m), 3)),
      event_type:  'coach_reminder',
      category:    'home',
      journey_id:  'home-buying',
      metadata:    { quarter: m / 3 },
    });
  }

  return seeds;
}

// ── Business Owner ────────────────────────────────────────────────────────────

function businessOwnerSeeds(
  answers: Record<string, string | number>,
  now: Date,
): CalendarSeed[] {
  const revenue      = Number(answers.monthlyRevenue ?? 0);
  const expenses     = Number(answers.monthlyExpenses ?? 0);
  const ownerSalary  = Number(answers.targetOwnerSalary ?? 0);
  const reserves     = Number(answers.cashReserves ?? 0);
  const cashAfterOwnerPay = revenue - expenses - ownerSalary;
  const netBurn = Math.max(0, -cashAfterOwnerPay);
  const runwayMonths = netBurn > 0 ? Math.floor(reserves / netBurn) : null;

  const seeds: CalendarSeed[] = [];

  // Monthly P&L review
  for (let i = 1; i <= 6; i++) {
    seeds.push({
      title:       `Monthly P&L review`,
      description: 'Compare revenue vs expenses, check runway, and spot emerging trends.',
      event_date:  isoDate(addMonths(now, i)),
      event_type:  'check_in',
      category:    'business',
      journey_id:  'business-owner',
      metadata:    { month: i },
    });
  }

  // Runway warning
  if (runwayMonths !== null && runwayMonths > 0 && runwayMonths < 24) {
    seeds.push({
      title:       `Runway review — ${runwayMonths} months left`,
      description: 'Your reserves cover ~' + runwayMonths + ' months of the shortfall after revenue, expenses, and target owner pay.',
      event_date:  isoDate(addMonths(now, Math.max(1, runwayMonths - 1))),
      event_type:  'coach_reminder',
      category:    'business',
      journey_id:  'business-owner',
      metadata:    { runwayMonths },
    });
  }

  // Quarterly strategy reviews
  for (const m of [3, 6, 9, 12]) {
    seeds.push({
      title:       `Quarterly strategy review`,
      description: 'Assess goals, pricing, team, and pipeline. Adjust your 90-day plan.',
      event_date:  isoDate(addDays(addMonths(now, m), 4)),
      event_type:  'journey_milestone',
      category:    'business',
      journey_id:  'business-owner',
      metadata:    { quarter: m / 3 },
    });
  }

  return seeds;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function generateJourneyCalendarSeeds(
  journeyId: JourneyId,
  answers: Record<string, string | number>,
): CalendarSeed[] {
  const now = new Date(`${calendarDayInTimeZone()}T12:00:00Z`);
  switch (journeyId) {
    case 'debt-freedom':    return debtFreedomSeeds(answers, now);
    case 'budget-clarity':  return budgetClaritySeeds(now);
    case 'investor-starter':return investorStarterSeeds(answers, now);
    case 'home-buying':     return homeBuyingSeeds(answers, now);
    case 'business-owner':  return businessOwnerSeeds(answers, now);
    default:                return [];
  }
}
