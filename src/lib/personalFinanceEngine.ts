/**
 * Personal Finance Insight Engine
 *
 * Pure, deterministic functions — no React, no AI, no side effects.
 * All functions accept raw data arrays and return structured insight objects.
 * Safe for unit testing and usable in any context.
 *
 * Edge cases handled throughout:
 *  - Division by zero on income / expenses / assets
 *  - Missing previous month data (no false MoM comparisons)
 *  - All-zeros snapshot (treated as no data, not zero net worth)
 *  - Mortgage / real estate offset in debt scoring
 *  - Negative surplus (milestone dates suppressed)
 *  - Negative net worth (percentage change suppressed)
 *  - Single snapshot (no trend analysis)
 */

import { NetWorthSnapshot, MonthlyCashFlow, ScenarioModel, computeNetWorth, computeCashFlow } from '@/hooks/usePersonalFinance';
import { format, parseISO, differenceInMonths } from 'date-fns';

// ── Shared formatters ─────────────────────────────────────────────────────────

const $n = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const pct = (n: number, decimals = 1) => `${n.toFixed(decimals)}%`;

function clamp(val: number, min: number, max: number) {
  return Math.min(max, Math.max(min, val));
}

// Detect all-zeros snapshot (user created a row but filled nothing in)
function isEmptySnapshot(s: NetWorthSnapshot): boolean {
  return s.checking === 0 && s.savings === 0 && s.investments === 0 &&
    s.real_estate === 0 && s.other_assets === 0 &&
    s.credit_cards === 0 && s.student_loans === 0 &&
    s.mortgage === 0 && s.car_loans === 0 && s.other_liabilities === 0;
}

function isEmptyCashFlow(cf: MonthlyCashFlow): boolean {
  return cf.primary_income === 0 && cf.side_income === 0 &&
    cf.housing === 0 && cf.food === 0 && cf.other_expenses === 0;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type HealthStatus = 'Critical' | 'Needs Attention' | 'Stable' | 'Strong' | 'Excellent';
export type FinancialStage = 'Stabilize' | 'Build' | 'Optimize' | 'Grow' | 'Protect';
export type RiskSeverity = 'critical' | 'warning' | 'info';
export type ActionPriority = 'high' | 'medium' | 'low';
export type MilestoneStatus = 'achieved' | 'on_track' | 'behind' | 'not_possible';
export type BenchmarkStatus = 'good' | 'watch' | 'risk';

export interface HealthScoreComponent {
  score: number;       // 0–max
  maxScore: number;
  weight: number;      // percentage weight in total
  label: string;       // e.g. "Strong", "Needs Work"
  explanation: string;
}

export interface FinancialHealthScore {
  totalScore: number;
  status: HealthStatus;
  summary: string;
  isPartial: boolean;  // true when some components had no data
  components: {
    cashRunway:     HealthScoreComponent;
    savingsRate:    HealthScoreComponent;
    debtBurden:     HealthScoreComponent;
    netWorthTrend:  HealthScoreComponent;
    expenseControl: HealthScoreComponent;
  };
}

export interface FinancialStageSummary {
  stage: FinancialStage;
  title: string;
  explanation: string;
  priority: string;
  color: string;
}

export interface NetWorthDriver {
  key: string;
  label: string;
  amount: number;   // always positive — sign is conveyed by topPositive / topNegative
}

export interface NetWorthChangeAnalysis {
  netWorthChange: number;
  assetChange: number;
  liabilityChange: number;
  topPositiveDrivers: NetWorthDriver[];
  topNegativeDrivers: NetWorthDriver[];
  explanation: string;
}

export interface MonthlyMoneyStory {
  title: string;
  summary: string;
  incomeSentence: string;
  spendingSentence: string;
  savingsSentence: string;
  netWorthSentence: string;
  notableChanges: string[];
  closingInsight: string;
}

export interface MetricBenchmark {
  metric: string;
  value: number;
  displayValue: string;
  targetRange: string;
  status: BenchmarkStatus;
  explanation: string;
}

export interface FinancialRiskAlert {
  id: string;
  severity: RiskSeverity;
  category: string;
  title: string;
  explanation: string;
  recommendedAction: string;
}

export interface FinancialOpportunity {
  id: string;
  category: string;
  title: string;
  explanation: string;
  estimatedImpact?: string;
}

export interface NextBestAction {
  priority: ActionPriority;
  category: string;
  title: string;
  explanation: string;
  estimatedImpact?: string;
  suggestedAmount?: number;
}

export interface FinancialMilestone {
  id: string;
  title: string;
  currentValue: number;
  targetValue: number;
  progressPct: number;   // 0–100
  estimatedMonths: number | null;
  estimatedDate: string | null;
  status: MilestoneStatus;
  explanation: string;
}

export interface FinancialPictureSummary {
  headline: string;
  narrative: string;
  currentNetWorth: number;
  netWorthChange: number | null;
  totalIncome: number;
  totalExpenses: number;
  monthlySurplus: number;
  savingsRate: number;
  cashRunwayMonths: number | null;
  mainStrength: string | null;
  mainRisk: string | null;
  bestNextMove: string | null;
  hasData: boolean;
}

export interface FinancialInsights {
  summary:         FinancialPictureSummary;
  healthScore:     FinancialHealthScore;
  stage:           FinancialStageSummary;
  netWorthChange:  NetWorthChangeAnalysis | null;
  moneyStory:      MonthlyMoneyStory | null;
  benchmarks:      MetricBenchmark[];
  risks:           FinancialRiskAlert[];
  opportunities:   FinancialOpportunity[];
  nextBestAction:  NextBestAction | null;
  milestones:      FinancialMilestone[];
}

// ── 1. Financial Health Score ─────────────────────────────────────────────────

export function computeHealthScore(
  latestSnap:  NetWorthSnapshot | undefined,
  prevSnap:    NetWorthSnapshot | undefined,
  latestFlow:  MonthlyCashFlow  | undefined,
  prevFlow:    MonthlyCashFlow  | undefined,
): FinancialHealthScore {
  let isPartial = false;

  // ── Cash Runway (25 pts) ──────────────────────────────────────────────────
  let crScore = 10; // neutral when no data
  let crLabel = 'No data';
  let crExplanation = 'Connect your bank or log balances to track runway.';

  if (latestSnap && latestFlow && !isEmptySnapshot(latestSnap)) {
    const { totalExpenses } = computeCashFlow(latestFlow);
    const liquid = latestSnap.checking + latestSnap.savings;
    if (totalExpenses > 0) {
      const runway = liquid / totalExpenses;
      if (runway < 1) {
        crScore = 2; crLabel = 'Critical';
        crExplanation = `${runway.toFixed(1)} months runway — one unexpected expense could force debt.`;
      } else if (runway < 3) {
        crScore = 10; crLabel = 'Below target';
        crExplanation = `${runway.toFixed(1)} months runway. The common target is 3–6 months of expenses.`;
      } else if (runway < 6) {
        crScore = 20; crLabel = 'Building';
        crExplanation = `${runway.toFixed(1)} months runway. Good progress — aim for 6 months for full stability.`;
      } else {
        crScore = 25; crLabel = 'Strong';
        crExplanation = `${runway.toFixed(1)} months of expenses covered. You have a solid safety net.`;
      }
    } else {
      isPartial = true;
    }
  } else {
    isPartial = true;
  }

  // ── Savings Rate (25 pts) ─────────────────────────────────────────────────
  let srScore = 10;
  let srLabel = 'No data';
  let srExplanation = 'Log income and expenses to track your savings rate.';

  if (latestFlow && !isEmptyCashFlow(latestFlow)) {
    const { savingsRate } = computeCashFlow(latestFlow);
    if (savingsRate < 0) {
      srScore = 0; srLabel = 'Deficit';
      srExplanation = `Spending exceeds income by ${pct(Math.abs(savingsRate))}. This is the highest priority to address.`;
    } else if (savingsRate < 5) {
      srScore = 5; srLabel = 'Very low';
      srExplanation = `${pct(savingsRate)} savings rate. A healthy target is 15–25%.`;
    } else if (savingsRate < 15) {
      srScore = 12; srLabel = 'Building';
      srExplanation = `${pct(savingsRate)} savings rate. Getting closer — 15% is a good milestone.`;
    } else if (savingsRate < 25) {
      srScore = 20; srLabel = 'Healthy';
      srExplanation = `${pct(savingsRate)} savings rate — above the 15% threshold. Keep it up.`;
    } else if (savingsRate < 35) {
      srScore = 23; srLabel = 'Strong';
      srExplanation = `${pct(savingsRate)} savings rate — well above average. You are building wealth quickly.`;
    } else {
      srScore = 25; srLabel = 'Excellent';
      srExplanation = `${pct(savingsRate)} savings rate — exceptional. Consider whether this pace is sustainable long-term.`;
    }
  } else {
    isPartial = true;
  }

  // ── Debt Burden (20 pts) ──────────────────────────────────────────────────
  // Exclude mortgage when offset by real estate (net mortgage exposure)
  let dbScore = 10;
  let dbLabel = 'No data';
  let dbExplanation = 'Log your balance sheet to assess debt burden.';

  if (latestSnap && !isEmptySnapshot(latestSnap)) {
    const { totalAssets } = computeNetWorth(latestSnap);
    // Net mortgage exposure (mortgage minus real estate equity)
    const realEstateEquity = Math.max(0, latestSnap.real_estate - latestSnap.mortgage);
    const consumerDebt = latestSnap.credit_cards + latestSnap.student_loans +
      latestSnap.car_loans + latestSnap.other_liabilities;
    const netMortgageExposure = Math.max(0, latestSnap.mortgage - latestSnap.real_estate);
    const adjustedDebt = consumerDebt + netMortgageExposure;
    const debtToAssetRatio = totalAssets > 0 ? (adjustedDebt / totalAssets) * 100 : (adjustedDebt > 0 ? 100 : 0);

    if (adjustedDebt === 0) {
      dbScore = 20; dbLabel = 'Debt-free';
      dbExplanation = 'No consumer debt — outstanding. This unlocks significant compounding capacity.';
    } else if (debtToAssetRatio < 15) {
      dbScore = 17; dbLabel = 'Low';
      dbExplanation = `Debt is ${pct(debtToAssetRatio)} of assets. Well-managed.`;
    } else if (debtToAssetRatio < 35) {
      dbScore = 12; dbLabel = 'Manageable';
      dbExplanation = `Debt is ${pct(debtToAssetRatio)} of assets. Manageable, but worth reducing.`;
    } else if (debtToAssetRatio < 60) {
      dbScore = 6; dbLabel = 'Elevated';
      dbExplanation = `Debt is ${pct(debtToAssetRatio)} of assets. Reducing consumer debt should be a priority.`;
    } else {
      dbScore = 2; dbLabel = 'High pressure';
      dbExplanation = `Debt is ${pct(debtToAssetRatio)} of assets — significant. Focus on debt reduction before investing.`;
    }
    // Penalise for increasing credit card debt — use relative threshold so
    // the check scales with balance size (5% growth or $25 minimum, whichever is larger)
    if (prevSnap && latestSnap.credit_cards > prevSnap.credit_cards + Math.max(prevSnap.credit_cards * 0.05, 25)) {
      dbScore = Math.max(0, dbScore - 3);
      dbExplanation += ` Credit card balance is increasing month-over-month — address this first.`;
    }
    dbScore = clamp(dbScore, 0, 20);
  } else {
    isPartial = true;
  }

  // ── Net Worth Trend (20 pts) ──────────────────────────────────────────────
  let nwtScore = 10; // neutral = no prev data
  let nwtLabel = 'No history yet';
  let nwtExplanation = 'Need at least 2 months of data to assess trend.';

  if (latestSnap && prevSnap && !isEmptySnapshot(latestSnap) && !isEmptySnapshot(prevSnap)) {
    const { netWorth: cur }  = computeNetWorth(latestSnap);
    const { netWorth: prev } = computeNetWorth(prevSnap);
    const change = cur - prev;
    const changePct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;

    if (changePct > 3) {
      nwtScore = 20; nwtLabel = 'Improving fast';
      nwtExplanation = `Net worth up ${pct(Math.abs(changePct))} this month — strong upward momentum.`;
    } else if (change > 0) {
      nwtScore = 16; nwtLabel = 'Improving';
      nwtExplanation = `Net worth up ${$n(change)} — moving in the right direction.`;
    } else if (change === 0) {
      nwtScore = 12; nwtLabel = 'Flat';
      nwtExplanation = 'Net worth unchanged month-over-month.';
    } else if (changePct > -3) {
      nwtScore = 6; nwtLabel = 'Slight decline';
      nwtExplanation = `Net worth down ${$n(Math.abs(change))} — small decline, worth investigating.`;
    } else {
      nwtScore = 2; nwtLabel = 'Declining';
      nwtExplanation = `Net worth down ${pct(Math.abs(changePct))} — significant decline. Identify and address the drivers.`;
    }
  } else if (!prevSnap) {
    isPartial = true;
  }

  // ── Expense Control (10 pts) ──────────────────────────────────────────────
  let ecScore = 5; // neutral = no prev data
  let ecLabel = 'No history yet';
  let ecExplanation = 'Need 2 months of cash flow data to assess expense control.';

  if (latestFlow && prevFlow && !isEmptyCashFlow(latestFlow) && !isEmptyCashFlow(prevFlow)) {
    const { totalExpenses: cur } = computeCashFlow(latestFlow);
    const { totalExpenses: prev } = computeCashFlow(prevFlow);
    const { totalIncome: curInc }  = computeCashFlow(latestFlow);
    const { totalIncome: prevInc } = computeCashFlow(prevFlow);
    const expenseGrowth = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
    const incomeGrowth  = prevInc > 0 ? ((curInc - prevInc) / prevInc) * 100 : 0;

    if (cur < prev) {
      ecScore = 10; ecLabel = 'Improving';
      ecExplanation = `Expenses decreased ${$n(prev - cur)} this month — good discipline.`;
    } else if (expenseGrowth < 5) {
      ecScore = 8; ecLabel = 'Stable';
      ecExplanation = 'Expenses are stable month-over-month.';
    } else if (expenseGrowth < 10 || expenseGrowth <= incomeGrowth + 3) {
      ecScore = 5; ecLabel = 'Watch';
      ecExplanation = `Expenses up ${pct(expenseGrowth)}. Acceptable if income grew similarly.`;
    } else {
      ecScore = 2; ecLabel = 'Growing faster than income';
      ecExplanation = `Expenses growing ${pct(expenseGrowth)} while income grew ${pct(incomeGrowth)}. This gap erodes surplus.`;
    }
  } else {
    isPartial = true;
  }

  // ── Compose total ─────────────────────────────────────────────────────────
  const totalScore = Math.round(crScore + srScore + dbScore + nwtScore + ecScore);

  let status: HealthStatus;
  if (totalScore < 30)      status = 'Critical';
  else if (totalScore < 50) status = 'Needs Attention';
  else if (totalScore < 65) status = 'Stable';
  else if (totalScore < 80) status = 'Strong';
  else                      status = 'Excellent';

  const partialNote = isPartial ? ' (based on available data)' : '';
  const summaryMap: Record<HealthStatus, string> = {
    'Critical':        `Your financial position needs immediate attention${partialNote}. Focus on stabilising cash flow and building a safety net.`,
    'Needs Attention': `Some areas need work${partialNote}. Addressing the lowest-scoring components will have the biggest impact.`,
    'Stable':          `Your finances are on reasonable footing${partialNote}. There are clear opportunities to strengthen your position.`,
    'Strong':          `Your finances are in good shape${partialNote}. Continue building on your strengths while addressing any gaps.`,
    'Excellent':       `Excellent financial health${partialNote}. Your position is strong across all key dimensions.`,
  };

  return {
    totalScore,
    status,
    summary: summaryMap[status],
    isPartial,
    components: {
      cashRunway:     { score: crScore,  maxScore: 25, weight: 25, label: crLabel,  explanation: crExplanation  },
      savingsRate:    { score: srScore,  maxScore: 25, weight: 25, label: srLabel,  explanation: srExplanation  },
      debtBurden:     { score: dbScore,  maxScore: 20, weight: 20, label: dbLabel,  explanation: dbExplanation  },
      netWorthTrend:  { score: nwtScore, maxScore: 20, weight: 20, label: nwtLabel, explanation: nwtExplanation },
      expenseControl: { score: ecScore,  maxScore: 10, weight: 10, label: ecLabel,  explanation: ecExplanation  },
    },
  };
}

// ── 2. Financial Stage ────────────────────────────────────────────────────────

export function classifyStage(
  latestSnap: NetWorthSnapshot | undefined,
  latestFlow: MonthlyCashFlow  | undefined,
): FinancialStageSummary {
  if (!latestSnap && !latestFlow) {
    return {
      stage: 'Stabilize',
      title: 'Getting Started',
      explanation: 'Connect your bank or log your first month of data to get a personalised stage assessment.',
      priority: 'Add your first snapshot or connect Plaid.',
      color: '#9ca3af',
    };
  }

  const { surplus = 0, totalIncome = 0 }    = latestFlow ? computeCashFlow(latestFlow) : {};
  const { netWorth = 0, totalLiabilities = 0, totalAssets = 0 } = latestSnap ? computeNetWorth(latestSnap) : {};
  const liquid   = latestSnap ? latestSnap.checking + latestSnap.savings : 0;
  const { totalExpenses = 0 } = latestFlow ? computeCashFlow(latestFlow) : {};
  const runway   = totalExpenses > 0 ? liquid / totalExpenses : 99;
  const ccDebt   = latestSnap?.credit_cards ?? 0;
  const consumerDebt = latestSnap
    ? latestSnap.credit_cards + latestSnap.student_loans + latestSnap.car_loans + latestSnap.other_liabilities
    : 0;

  // Protect: substantial net worth + strong runway
  if (netWorth > 500_000 && runway >= 6) {
    return {
      stage: 'Protect',
      title: 'Protect & Preserve',
      explanation: 'You have built significant wealth. The focus shifts to protecting what you have built, optimising asset allocation, tax efficiency, and long-term preservation.',
      priority: 'Review investment diversification, tax strategy, and insurance coverage.',
      color: '#8b5cf6',
    };
  }

  // Grow: strong surplus, solid runway, manageable debt
  if (surplus > 0 && runway >= 6 && consumerDebt < totalIncome) {
    return {
      stage: 'Grow',
      title: 'Grow Your Wealth',
      explanation: 'Your foundation is solid. You have positive cash flow, a healthy emergency fund, and manageable debt. Now is the time to accelerate wealth building through consistent investing.',
      priority: 'Maximise investment contributions and explore tax-advantaged accounts.',
      color: '#10b981',
    };
  }

  // Optimize: positive surplus, runway 3–6 months
  if (surplus > 0 && runway >= 3) {
    return {
      stage: 'Optimize',
      title: 'Optimize Your Position',
      explanation: 'You have a solid base with positive cash flow and a meaningful emergency fund. The focus now is on improving efficiency — reducing high-interest debt and growing your runway to 6 months.',
      priority: 'Pay down consumer debt and build runway to 6 months before increasing investments.',
      color: '#3b82f6',
    };
  }

  // Build: positive surplus but runway below 3 months
  if (surplus > 0) {
    return {
      stage: 'Build',
      title: 'Build Your Foundation',
      explanation: 'Your income exceeds your expenses — that is the critical first step. The priority now is building a 3-month emergency fund before any significant investing.',
      priority: 'Direct your monthly surplus toward liquid savings until you reach 3 months of expenses.',
      color: '#f59e0b',
    };
  }

  // Stabilize: negative or zero surplus
  return {
    stage: 'Stabilize',
    title: 'Stabilize First',
    explanation: 'Your expenses are meeting or exceeding your income. Stabilising your cash flow is the only sustainable priority right now.',
    priority: 'Identify the largest controllable expense and reduce it. Every dollar of surplus unlocks the next stage.',
    color: '#ef4444',
  };
}

// ── 3. Net Worth Change Analysis ──────────────────────────────────────────────

const ASSET_LABELS: Record<string, string> = {
  checking:    'Checking account',
  savings:     'Savings account',
  investments: 'Investments',
  real_estate: 'Real estate',
  other_assets:'Other assets',
};

const LIABILITY_LABELS: Record<string, string> = {
  credit_cards:       'Credit card debt',
  student_loans:      'Student loans',
  mortgage:           'Mortgage',
  car_loans:          'Car loans',
  other_liabilities:  'Other debt',
};

export function analyzeNetWorthChange(
  current:  NetWorthSnapshot,
  previous: NetWorthSnapshot,
): NetWorthChangeAnalysis {
  const { netWorth: curNw, totalAssets: curAssets, totalLiabilities: curLiab } = computeNetWorth(current);
  const { netWorth: prevNw, totalAssets: prevAssets, totalLiabilities: prevLiab } = computeNetWorth(previous);

  const netWorthChange  = curNw    - prevNw;
  const assetChange     = curAssets - prevAssets;
  const liabilityChange = curLiab  - prevLiab;

  const positiveDrivers: NetWorthDriver[] = [];
  const negativeDrivers: NetWorthDriver[] = [];

  // Assets: increase = positive, decrease = negative
  for (const key of Object.keys(ASSET_LABELS) as (keyof NetWorthSnapshot)[]) {
    const delta = (current[key] as number) - (previous[key] as number);
    if (delta > 50) {
      positiveDrivers.push({ key: key as string, label: ASSET_LABELS[key as string], amount: delta });
    } else if (delta < -50) {
      negativeDrivers.push({ key: key as string, label: ASSET_LABELS[key as string], amount: Math.abs(delta) });
    }
  }

  // Liabilities: decrease = positive, increase = negative
  for (const key of Object.keys(LIABILITY_LABELS) as (keyof NetWorthSnapshot)[]) {
    const delta = (current[key] as number) - (previous[key] as number);
    if (delta < -50) {
      positiveDrivers.push({ key: key as string, label: LIABILITY_LABELS[key as string], amount: Math.abs(delta) });
    } else if (delta > 50) {
      negativeDrivers.push({ key: key as string, label: LIABILITY_LABELS[key as string], amount: delta });
    }
  }

  // Sort by amount descending, take top 3
  positiveDrivers.sort((a, b) => b.amount - a.amount);
  negativeDrivers.sort((a, b) => b.amount - a.amount);
  const topPos = positiveDrivers.slice(0, 3);
  const topNeg = negativeDrivers.slice(0, 3);

  // Build explanation
  let explanation: string;
  if (netWorthChange === 0) {
    explanation = 'Your net worth was unchanged this month.';
    if (topPos.length > 0 || topNeg.length > 0) {
      explanation += ' Some individual balances shifted but offset each other.';
    }
  } else {
    const dir = netWorthChange > 0 ? 'increased' : 'decreased';
    explanation = `Your net worth ${dir} by ${$n(Math.abs(netWorthChange))} this month.`;
    if (topPos.length > 0) {
      const top = topPos[0];
      const verb = ASSET_LABELS[top.key] ? 'grew by' : 'was reduced by';
      explanation += ` The biggest positive was ${top.label.toLowerCase()}, which ${verb} ${$n(top.amount)}.`;
    }
    if (topNeg.length > 0) {
      const top = topNeg[0];
      const verb = LIABILITY_LABELS[top.key] ? 'increased by' : 'fell by';
      explanation += ` The main drag was ${top.label.toLowerCase()}, which ${verb} ${$n(top.amount)}.`;
    }
  }

  return { netWorthChange, assetChange, liabilityChange, topPositiveDrivers: topPos, topNegativeDrivers: topNeg, explanation };
}

// ── 4. Monthly Money Story ────────────────────────────────────────────────────

export function generateMonthlyMoneyStory(
  flow:      MonthlyCashFlow,
  prevFlow:  MonthlyCashFlow | undefined,
  snap:      NetWorthSnapshot | undefined,
  prevSnap:  NetWorthSnapshot | undefined,
): MonthlyMoneyStory {
  const { totalIncome, totalExpenses, surplus, savingsRate } = computeCashFlow(flow);

  // Month name from flow_month (YYYY-MM-01)
  let monthName = 'This month';
  try {
    monthName = format(parseISO(flow.flow_month), 'MMMM');
  } catch {
    // Unparseable flow_month — keep the default month name.
  }

  const title = `Your ${monthName} Money Story`;

  const summary = totalIncome > 0
    ? `You earned ${$n(totalIncome)}, spent ${$n(totalExpenses)}, and kept ${$n(Math.max(0, surplus))}.`
    : `No income recorded for ${monthName}.`;

  // Income sentence
  const incomeSentence = (() => {
    if (totalIncome === 0) return 'No income was recorded this month.';
    const parts: string[] = [`Primary income ${$n(flow.primary_income)}`];
    if (flow.side_income > 0)       parts.push(`side income ${$n(flow.side_income)}`);
    if (flow.investment_income > 0) parts.push(`investment income ${$n(flow.investment_income)}`);
    return `Total income: ${$n(totalIncome)} (${parts.join(', ')}).`;
  })();

  // Spending sentence — biggest category
  const expenseFields: [keyof MonthlyCashFlow, string][] = [
    ['housing', 'housing'], ['food', 'food'], ['transport', 'transport'],
    ['healthcare', 'healthcare'], ['entertainment', 'entertainment'],
    ['subscriptions', 'subscriptions'], ['clothing', 'clothing'],
    ['education', 'education'], ['travel', 'travel'], ['other_expenses', 'other expenses'],
  ];
  const biggestExpense = expenseFields
    .map(([key, label]) => ({ label, amount: flow[key] as number }))
    .filter(e => e.amount > 0)
    .sort((a, b) => b.amount - a.amount)[0];

  const biggestPct = biggestExpense && totalExpenses > 0
    ? ((biggestExpense.amount / totalExpenses) * 100).toFixed(0)
    : '0';

  const spendingSentence = totalExpenses > 0
    ? `Total spending: ${$n(totalExpenses)}. Your biggest expense was ${biggestExpense?.label ?? 'unknown'} at ${biggestPct}% of total spending.`
    : 'No expenses recorded this month.';

  // Savings sentence
  const savingsSentence = (() => {
    if (totalIncome === 0) return 'Savings rate could not be calculated without income data.';
    if (savingsRate < 0) return `You ran a deficit of ${$n(Math.abs(surplus))} — spending exceeded income by ${pct(Math.abs(savingsRate))}.`;
    if (savingsRate < 10) return `Savings rate: ${pct(savingsRate)} — below the 10% baseline. There is room to improve.`;
    if (savingsRate < 20) return `Savings rate: ${pct(savingsRate)} — building toward the 20% target.`;
    if (savingsRate < 30) return `Savings rate: ${pct(savingsRate)} — healthy. You are building wealth consistently.`;
    return `Savings rate: ${pct(savingsRate)} — excellent. You are in strong savings mode.`;
  })();

  // Net worth sentence
  const netWorthSentence = (() => {
    if (!snap) return 'No balance sheet data available this month.';
    const { netWorth } = computeNetWorth(snap);
    if (!prevSnap) return `Current net worth: ${$n(netWorth)}.`;
    const { netWorth: prev } = computeNetWorth(prevSnap);
    const change = netWorth - prev;
    if (change === 0) return `Net worth held steady at ${$n(netWorth)}.`;
    const dir = change > 0 ? 'up' : 'down';
    return `Net worth ${dir} ${$n(Math.abs(change))} to ${$n(netWorth)}.`;
  })();

  // Notable changes vs previous month
  const notableChanges: string[] = [];
  if (prevFlow) {
    for (const [key, label] of expenseFields) {
      const cur  = flow[key] as number;
      const prev = prevFlow[key] as number;
      if (prev > 30 && Math.abs(cur - prev) > 50 && Math.abs((cur - prev) / prev) > 0.15) {
        const dir    = cur > prev ? 'up' : 'down';
        const delta  = Math.abs(cur - prev);
        notableChanges.push(`${label.charAt(0).toUpperCase() + label.slice(1)} ${dir} ${$n(delta)}.`);
        if (notableChanges.length >= 3) break;
      }
    }
  }

  // Closing insight
  const closingInsight = (() => {
    if (surplus < 0) return 'Reducing the largest discretionary category this month would be the single highest-impact change.';
    if (savingsRate >= 20 && (snap && (snap.checking + snap.savings) / Math.max(1, totalExpenses) < 3)) {
      return 'Your savings rate is strong. Consider directing the surplus toward your emergency fund until you reach 3 months of expenses.';
    }
    if (savingsRate >= 20) return 'Your savings rate is strong. Consider increasing your investment contributions.';
    const gap = totalIncome * 0.20 - surplus;
    return `Increasing your savings rate to 20% would require finding ${$n(gap)} more per month — either by reducing discretionary spending or growing income.`;
  })();

  return { title, summary, incomeSentence, spendingSentence, savingsSentence, netWorthSentence, notableChanges, closingInsight };
}

// ── 5. Benchmarks ─────────────────────────────────────────────────────────────

export function computeBenchmarks(
  snap: NetWorthSnapshot | undefined,
  flow: MonthlyCashFlow  | undefined,
): MetricBenchmark[] {
  const benchmarks: MetricBenchmark[] = [];
  if (!snap && !flow) return benchmarks;

  const { totalIncome = 0, totalExpenses = 0, surplus = 0, savingsRate = 0 } = flow ? computeCashFlow(flow) : {};
  const liquid = snap ? snap.checking + snap.savings : 0;
  const runway = totalExpenses > 0 ? liquid / totalExpenses : null;

  // Savings rate
  if (flow && !isEmptyCashFlow(flow)) {
    benchmarks.push({
      metric: 'Savings Rate',
      value: savingsRate,
      displayValue: pct(savingsRate),
      targetRange: '15–25%',
      status: savingsRate >= 15 ? 'good' : savingsRate >= 5 ? 'watch' : 'risk',
      explanation: savingsRate >= 25
        ? 'Excellent savings rate. You are building wealth rapidly.'
        : savingsRate >= 15
          ? 'Healthy savings rate — above the common 15% baseline.'
          : savingsRate >= 5
            ? `${pct(savingsRate)} savings rate. A healthy target is 15–25%. You are ${$n(totalIncome * 0.15 - surplus)}/mo away.`
            : `Very low savings rate. Prioritise increasing your surplus.`,
    });
  }

  // Cash runway
  if (snap && flow && !isEmptySnapshot(snap) && !isEmptyCashFlow(flow) && runway !== null) {
    benchmarks.push({
      metric: 'Cash Runway',
      value: runway,
      displayValue: `${runway.toFixed(1)} mo`,
      targetRange: '3–6 months',
      status: runway >= 3 ? 'good' : runway >= 1 ? 'watch' : 'risk',
      explanation: runway >= 6
        ? `${runway.toFixed(1)} months of expenses covered — strong safety net.`
        : runway >= 3
          ? `${runway.toFixed(1)} months runway. Building toward 6 months would provide full stability.`
          : `${runway.toFixed(1)} months runway — below the 3-month minimum. An unexpected expense could force debt.`,
    });
  }

  // Housing ratio
  if (flow && totalIncome > 0 && flow.housing > 0) {
    const housingRatio = (flow.housing / totalIncome) * 100;
    benchmarks.push({
      metric: 'Housing Ratio',
      value: housingRatio,
      displayValue: pct(housingRatio),
      targetRange: 'Under 30%',
      status: housingRatio <= 30 ? 'good' : housingRatio <= 40 ? 'watch' : 'risk',
      explanation: housingRatio <= 30
        ? `Housing is ${pct(housingRatio)} of income — within the comfortable range.`
        : housingRatio <= 40
          ? `Housing is ${pct(housingRatio)} of income — manageable but above the 30% guideline.`
          : `Housing is ${pct(housingRatio)} of income — elevated. This limits financial flexibility significantly.`,
    });
  }

  // Debt-to-income (monthly consumer debt payments are unknown, use balance as proxy)
  if (snap && flow && totalIncome > 0 && !isEmptySnapshot(snap)) {
    const annualIncome = totalIncome * 12;
    const consumerDebt = snap.credit_cards + snap.student_loans + snap.car_loans + snap.other_liabilities;
    if (consumerDebt > 0) {
      const dti = (consumerDebt / annualIncome) * 100;
      benchmarks.push({
        metric: 'Consumer Debt / Annual Income',
        value: dti,
        displayValue: pct(dti),
        targetRange: 'Under 35%',
        status: dti < 20 ? 'good' : dti < 50 ? 'watch' : 'risk',
        explanation: dti < 20
          ? `Consumer debt is ${pct(dti)} of annual income — low and manageable.`
          : dti < 50
            ? `Consumer debt is ${pct(dti)} of annual income — worth reducing before increasing investments.`
            : `Consumer debt is ${pct(dti)} of annual income — high. Debt reduction should be the primary focus.`,
      });
    }
  }

  return benchmarks;
}

// ── 6. Risk Alerts ────────────────────────────────────────────────────────────

export function generateRiskAlerts(
  snapshots:     NetWorthSnapshot[],
  cashFlows:     MonthlyCashFlow[],
  lastSyncedAt?: string | null,
): FinancialRiskAlert[] {
  const alerts: FinancialRiskAlert[] = [];

  const latest  = snapshots[snapshots.length - 1];
  const prev    = snapshots[snapshots.length - 2];
  const prev2   = snapshots[snapshots.length - 3];
  const latestFlow = cashFlows[cashFlows.length - 1];
  const prevFlow   = cashFlows[cashFlows.length - 2];

  if (!latest && !latestFlow) return alerts;

  // Deficit spending
  if (latestFlow && !isEmptyCashFlow(latestFlow)) {
    const { surplus } = computeCashFlow(latestFlow);
    if (surplus < 0) {
      alerts.push({
        id: 'deficit',
        severity: 'critical',
        category: 'spending',
        title: 'Spending exceeds income',
        explanation: `You are spending ${$n(Math.abs(surplus))} more than you earn each month. This depletes savings and increases debt.`,
        recommendedAction: 'Identify the 2–3 largest discretionary categories and set immediate reduction targets.',
      });
    }
  }

  // Critical cash runway
  if (latest && latestFlow && !isEmptySnapshot(latest) && !isEmptyCashFlow(latestFlow)) {
    const { totalExpenses } = computeCashFlow(latestFlow);
    const liquid = latest.checking + latest.savings;
    if (totalExpenses > 0) {
      const runway = liquid / totalExpenses;
      if (runway < 1) {
        alerts.push({
          id: 'runway-critical',
          severity: 'critical',
          category: 'cash_runway',
          title: 'Less than 1 month of cash runway',
          explanation: `${$n(liquid)} in liquid savings covers only ${runway.toFixed(1)} months of expenses. A single unexpected bill could force debt.`,
          recommendedAction: `Build liquid savings to at least ${$n(totalExpenses * 3)} (3 months of expenses) before any other financial goals.`,
        });
      } else if (runway < 2) {
        alerts.push({
          id: 'runway-low',
          severity: 'warning',
          category: 'cash_runway',
          title: `Only ${runway.toFixed(1)} months of emergency cover`,
          explanation: 'Below the 3-month minimum. Financial resilience is limited.',
          recommendedAction: `Allocate your monthly surplus toward liquid savings until you reach ${$n(totalExpenses * 3)}.`,
        });
      }
    }
  }

  // Rising credit card debt
  if (latest && prev && !isEmptySnapshot(latest) && !isEmptySnapshot(prev)) {
    const ccGrowth = latest.credit_cards - prev.credit_cards;
    if (ccGrowth > 100) {
      const isAccelerating = prev2 && prev.credit_cards > prev2.credit_cards + 100;
      alerts.push({
        id: 'cc-rising',
        severity: isAccelerating ? 'critical' : 'warning',
        category: 'debt',
        title: isAccelerating ? 'Credit card debt rising for 2+ months' : 'Credit card balance increased this month',
        explanation: `Balance grew ${$n(ccGrowth)} this month${isAccelerating ? ', continuing a multi-month trend' : ''}. At 20%+ APR, this compounds quickly.`,
        recommendedAction: 'Stop adding to the balance and direct surplus toward paying it down. Avalanche method (highest rate first) minimises total interest.',
      });
    }
  }

  // Expenses growing faster than income
  if (latestFlow && prevFlow && !isEmptyCashFlow(latestFlow) && !isEmptyCashFlow(prevFlow)) {
    const { totalExpenses: curExp, totalIncome: curInc } = computeCashFlow(latestFlow);
    const { totalExpenses: prevExp, totalIncome: prevInc } = computeCashFlow(prevFlow);
    const expGrowth = prevExp > 0 ? ((curExp - prevExp) / prevExp) * 100 : 0;
    const incGrowth = prevInc > 0 ? ((curInc - prevInc) / prevInc) * 100 : 0;
    if (expGrowth > incGrowth + 5 && expGrowth > 8) {
      alerts.push({
        id: 'expense-drift',
        severity: 'warning',
        category: 'spending',
        title: 'Expenses growing faster than income',
        explanation: `Expenses up ${pct(expGrowth)} while income grew ${pct(incGrowth)}. This gap will erode your surplus over time.`,
        recommendedAction: 'Review which categories drove the increase and set category-level spending targets.',
      });
    }
  }

  // Stale Plaid data
  if (lastSyncedAt) {
    const hoursSince = (Date.now() - new Date(lastSyncedAt).getTime()) / 36e5;
    if (hoursSince > 72) {
      alerts.push({
        id: 'stale-data',
        severity: 'info',
        category: 'data_quality',
        title: 'Financial data may be outdated',
        explanation: `Last synced ${Math.floor(hoursSince / 24)} days ago. Balances and insights may not reflect recent transactions.`,
        recommendedAction: 'Sync your bank connection to refresh balances and transactions.',
      });
    }
  }

  // Sort: critical first, then warning, then info
  const order: Record<RiskSeverity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

// ── 7. Opportunities ──────────────────────────────────────────────────────────

export function generateOpportunities(
  snap:      NetWorthSnapshot | undefined,
  flow:      MonthlyCashFlow  | undefined,
  scenarios: ScenarioModel[],
): FinancialOpportunity[] {
  const opportunities: FinancialOpportunity[] = [];
  if (!snap && !flow) return opportunities;

  const { surplus = 0, totalIncome = 0, totalExpenses = 0 } = flow ? computeCashFlow(flow) : {};
  const { netWorth = 0 } = snap ? computeNetWorth(snap) : {};
  const liquid = snap ? snap.checking + snap.savings : 0;
  const runway  = totalExpenses > 0 ? liquid / totalExpenses : 0;

  // Strong surplus — invest it
  if (surplus >= 500) {
    const investable = Math.floor(surplus * 0.6 / 100) * 100; // 60% of surplus, rounded to $100
    opportunities.push({
      id: 'invest-surplus',
      category: 'investing',
      title: `${$n(investable)}/month could be working for you`,
      explanation: `You have a monthly surplus of ${$n(surplus)}. Directing ${$n(investable)}/month into a low-cost index fund would compound significantly over time.`,
      estimatedImpact: `${$n(investable * 12 * 5 * 1.07)} estimated value in 5 years at a 7% annual return.`,
    });
  }

  // Discretionary spend reduction
  if (flow) {
    const discretionary = (flow.food + flow.entertainment + flow.subscriptions + flow.clothing + flow.travel);
    if (discretionary > 200) {
      const tenPct = Math.round(discretionary * 0.1);
      opportunities.push({
        id: 'discretionary-trim',
        category: 'expense_reduction',
        title: `Small cuts in discretionary spending could free ${$n(tenPct)}/month`,
        explanation: `You spend ${$n(discretionary)}/month on food, entertainment, subscriptions, clothing, and travel combined. A 10% reduction would free ${$n(tenPct)}/month — ${$n(tenPct * 12)}/year.`,
        estimatedImpact: `${$n(tenPct * 12)} more per year to save or invest.`,
      });
    }
  }

  // Overbuilt emergency fund — start investing
  if (runway > 9 && netWorth > 0 && surplus > 0) {
    opportunities.push({
      id: 'excess-cash',
      category: 'investing',
      title: 'Your emergency fund may be larger than needed',
      explanation: `You have ${runway.toFixed(1)} months of cash runway — above the 6-month target. Cash above that threshold earns less than inflation. Consider directing the excess toward investments.`,
      estimatedImpact: 'Moving 3 months of expenses from savings to investments could meaningfully improve long-term returns.',
    });
  }

  // Scenario comparison — best improvement vs baseline
  // Use is_preset=true as baseline signal rather than name matching (user may rename)
  if (scenarios.length >= 2) {
    const baselineScenario = scenarios.find(s => s.is_preset) ?? scenarios[0];
    const bestScenario = scenarios
      .filter(s => s !== baselineScenario)
      .sort((a, b) => {
        // Compare 5-year projected NW improvement vs baseline
        const baseNw = netWorth + surplus * 60 * 1.005;
        const aNw = netWorth + (surplus * (1 + a.income_change_pct/100) - surplus * (a.expense_change_pct/100) + a.extra_monthly_savings) * 60 * 1.005;
        const bNw = netWorth + (surplus * (1 + b.income_change_pct/100) - surplus * (b.expense_change_pct/100) + b.extra_monthly_savings) * 60 * 1.005;
        return bNw - aNw;
      })[0];

    if (bestScenario && bestScenario !== baselineScenario) {
      opportunities.push({
        id: 'best-scenario',
        category: 'goal_acceleration',
        title: `"${bestScenario.name}" is your strongest projected path`,
        explanation: `Based on your current numbers, the "${bestScenario.name}" scenario projects the most improvement to your 5-year financial position. Review it in the Scenarios tab.`,
      });
    }
  }

  return opportunities.slice(0, 3);
}

// ── 8. Next Best Action ───────────────────────────────────────────────────────

export function generateNextBestAction(
  snap:      NetWorthSnapshot | undefined,
  flow:      MonthlyCashFlow  | undefined,
  snapshots: NetWorthSnapshot[],
  cashFlows: MonthlyCashFlow[],
): NextBestAction | null {
  if (!snap && !flow) return null;

  const { surplus = 0, totalIncome = 0, totalExpenses = 0, savingsRate = 0 } = flow ? computeCashFlow(flow) : {};
  const { netWorth = 0, totalLiabilities = 0 } = snap ? computeNetWorth(snap) : {};
  const liquid  = snap ? snap.checking + snap.savings : 0;
  const runway  = totalExpenses > 0 ? liquid / totalExpenses : 99;
  const ccDebt  = snap?.credit_cards ?? 0;
  const prevFlow = cashFlows[cashFlows.length - 2];
  const prevSnap = snapshots[snapshots.length - 2];
  const ccRising = prevSnap && ccDebt > (prevSnap.credit_cards + 100);

  // Priority 1: stop deficit spending
  if (surplus < 0) {
    const deficit = Math.abs(surplus);
    return {
      priority: 'high',
      category: 'spending',
      title: 'Stop the monthly deficit first',
      explanation: `You are spending ${$n(deficit)} more than you earn each month. Until this is reversed, every other financial goal moves further away.`,
      estimatedImpact: `Breaking even would stop ${$n(deficit * 12)}/year in net worth erosion.`,
      suggestedAmount: deficit,
    };
  }

  // Priority 2: critical runway
  if (runway < 1 && totalExpenses > 0) {
    const target = totalExpenses * 3;
    const gap = target - liquid;
    const months = surplus > 0 ? Math.ceil(gap / surplus) : null;
    return {
      priority: 'high',
      category: 'cash_runway',
      title: 'Build emergency cash immediately',
      explanation: `With less than 1 month of cash runway, a single unexpected expense could force you into debt. Build to ${$n(target)} (3 months of expenses) before anything else.`,
      estimatedImpact: months ? `At your current surplus, estimated ${months} months to reach 3-month runway.` : undefined,
      suggestedAmount: Math.min(surplus, gap),
    };
  }

  // Priority 3: rising credit card debt
  if (ccRising && ccDebt > 500) {
    return {
      priority: 'high',
      category: 'debt',
      title: 'Stop growing credit card debt',
      explanation: `Your credit card balance increased last month and continues to grow. At 20%+ APR, this compounds against you faster than most investments compound for you.`,
      estimatedImpact: `Clearing ${$n(ccDebt)} in credit card debt is equivalent to a guaranteed 20% annual return.`,
      suggestedAmount: Math.min(surplus, ccDebt),
    };
  }

  // Priority 4: build runway to 3 months
  if (runway < 3 && totalExpenses > 0) {
    const target = totalExpenses * 3;
    const gap = target - liquid;
    const months = surplus > 0 ? Math.ceil(gap / surplus) : null;
    return {
      priority: 'high',
      category: 'cash_runway',
      title: `Build emergency fund to ${$n(target)}`,
      explanation: `Your cash runway is ${runway.toFixed(1)} months — below the 3-month minimum. Direct your surplus here before increasing investment contributions.`,
      estimatedImpact: months ? `Estimated ${months} months at your current savings rate.` : undefined,
      // Direct full surplus toward the emergency fund until it's reached
      suggestedAmount: Math.min(surplus, gap),
    };
  }

  // Priority 5: pay off credit card debt
  if (ccDebt > 200 && surplus > 0) {
    const months = Math.ceil(ccDebt / surplus);
    return {
      priority: 'medium',
      category: 'debt',
      title: `Pay off ${$n(ccDebt)} in credit card debt`,
      explanation: `You have a solid emergency fund. Eliminating credit card debt is your highest guaranteed return — about 20% annually on every dollar repaid.`,
      estimatedImpact: `Estimated ${months} months to pay off at current surplus.`,
      suggestedAmount: Math.min(surplus * 0.8, ccDebt),
    };
  }

  // Priority 6: invest — runway is good, debt is low
  if (runway >= 3 && ccDebt === 0 && surplus > 0) {
    const investAmount = Math.floor(surplus * 0.7 / 50) * 50;
    return {
      priority: surplus >= 500 ? 'medium' : 'low',
      category: 'investing',
      title: `Start investing ${$n(investAmount)}/month`,
      explanation: `Your emergency fund is healthy and consumer debt is low. The next highest-value move is consistent investing. Even ${$n(investAmount)}/month compounds significantly over time.`,
      estimatedImpact: `${$n(investAmount)}/month for 10 years at 7% = approximately ${$n(investAmount * 12 * 14.78)}.`,
      suggestedAmount: investAmount,
    };
  }

  // Priority 7: improve savings rate
  if (savingsRate < 15 && totalIncome > 0) {
    const gap = totalIncome * 0.15 - surplus;
    return {
      priority: 'medium',
      category: 'spending',
      title: `Find ${$n(gap)}/month to reach 15% savings rate`,
      explanation: `Your current savings rate is ${pct(savingsRate)}. Reaching 15% requires finding ${$n(gap)}/month — achievable through small reductions across discretionary categories.`,
      suggestedAmount: gap,
    };
  }

  return null;
}

// ── 9. Milestones ─────────────────────────────────────────────────────────────

function estimateMonthsToTarget(
  current: number,
  target:  number,
  monthlyProgress: number,
): { months: number | null; status: MilestoneStatus } {
  if (current >= target) return { months: 0, status: 'achieved' };
  if (monthlyProgress <= 0) return { months: null, status: 'not_possible' };
  const months = Math.ceil((target - current) / monthlyProgress);
  if (months > 600) return { months: null, status: 'not_possible' }; // > 50 years
  const status: MilestoneStatus = months <= 24 ? 'on_track' : 'behind';
  return { months, status };
}

function monthsToDateString(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return format(d, 'MMM yyyy');
}

export function computeMilestones(
  snap: NetWorthSnapshot | undefined,
  flow: MonthlyCashFlow  | undefined,
): FinancialMilestone[] {
  if (!snap && !flow) return [];

  const { surplus = 0, totalExpenses = 0 } = flow ? computeCashFlow(flow) : {};
  const { netWorth = 0 } = snap ? computeNetWorth(snap) : {};
  const liquid = snap ? snap.checking + snap.savings : 0;
  const ccDebt = snap?.credit_cards ?? 0;
  const milestones: FinancialMilestone[] = [];

  const addMilestone = (
    id: string,
    title: string,
    current: number,
    target: number,
    monthlyProgress: number,
    explanation: (months: number | null, date: string | null) => string,
  ) => {
    const progressPct = target > 0 ? clamp((current / target) * 100, 0, 100) : 100;
    const { months, status } = estimateMonthsToTarget(current, target, monthlyProgress);
    const date = months !== null && months > 0 ? monthsToDateString(months) : null;
    milestones.push({ id, title, currentValue: current, targetValue: target, progressPct, estimatedMonths: months, estimatedDate: date, status, explanation: explanation(months, date) });
  };

  // 3-month emergency fund
  if (totalExpenses > 0) {
    const target3 = totalExpenses * 3;
    addMilestone('runway-3mo', '3-Month Emergency Fund', liquid, target3, Math.max(0, surplus),
      (months, date) => months === 0
        ? 'You have reached the 3-month emergency fund milestone.'
        : months === null
          ? 'Not reachable at the current pace — address the monthly deficit first.'
          : `Estimated to reach ${$n(target3)} by ${date} (${months} months at current surplus).`
    );
  }

  // 6-month emergency fund (only if 3-month is close or achieved)
  if (totalExpenses > 0 && liquid >= totalExpenses * 2) {
    const target6 = totalExpenses * 6;
    addMilestone('runway-6mo', '6-Month Emergency Fund', liquid, target6, Math.max(0, surplus),
      (months, date) => months === 0
        ? 'Strong — you have 6 months of expenses in liquid savings.'
        : months === null
          ? 'Not reachable at the current pace.'
          : `Estimated ${months} months to reach full 6-month runway (${date}).`
    );
  }

  // $50K net worth
  if (netWorth < 50_000) {
    addMilestone('nw-50k', '$50K Net Worth', netWorth, 50_000, Math.max(0, surplus),
      (months, date) => months === 0
        ? 'You have surpassed $50K net worth.'
        : months === null
          ? 'Increase monthly surplus to make this milestone achievable.'
          : `Projected to reach $50K net worth by ${date} (${months} months).`
    );
  }

  // $100K net worth
  if (netWorth < 100_000) {
    addMilestone('nw-100k', '$100K Net Worth', netWorth, 100_000, Math.max(0, surplus),
      (months, date) => months === 0
        ? 'You have crossed the $100K net worth milestone.'
        : months === null
          ? 'Not achievable at current surplus — work on increasing income or reducing expenses.'
          : `Projected to reach $100K net worth by ${date} (${months} months).`
    );
  }

  // $250K net worth (only show if $100K is close or achieved)
  if (netWorth >= 75_000) {
    addMilestone('nw-250k', '$250K Net Worth', netWorth, 250_000, Math.max(0, surplus),
      (months, date) => months === 0
        ? 'You have reached $250K net worth.'
        : months === null
          ? 'Not reachable at current pace.'
          : `Projected ${months} months to $250K (${date}).`
    );
  }

  // Pay off credit card debt
  if (ccDebt > 0) {
    addMilestone('cc-free', 'Credit Card Debt-Free', ccDebt, ccDebt, Math.max(0, surplus),
      (months, date) => {
        const remaining = ccDebt;
        if (surplus <= 0) return 'Not achievable while spending exceeds income.';
        const m = Math.ceil(remaining / surplus);
        if (m > 120) return 'At current pace this would take over 10 years — consider a debt payoff plan.';
        return `Estimated ${m} months to clear ${$n(ccDebt)} in credit card debt (${monthsToDateString(m)}).`;
      }
    );
    // Paydown milestone: model as "amount still owed" shrinking toward $0.
    // currentValue = ccDebt (what's owed now), targetValue = 0 (goal), progressPct inverted.
    const idx = milestones.findIndex(m => m.id === 'cc-free');
    if (idx >= 0) {
      const months = surplus > 0 ? Math.ceil(ccDebt / surplus) : null;
      milestones[idx] = {
        ...milestones[idx],
        currentValue: 0,            // amount paid off so far (starts at $0)
        targetValue:  ccDebt,       // total to clear
        progressPct:  0,            // will grow as debt is paid off each month
        estimatedMonths: months == null || months > 120 ? null : months,
        estimatedDate:   months == null || months > 120 ? null : monthsToDateString(months),
        status: months == null ? 'not_possible'
          : months > 120 ? 'not_possible'
          : months <= 24  ? 'on_track'
          : 'behind',
        explanation: months == null
          ? 'Not achievable while spending exceeds income.'
          : months > 120
          ? 'At current pace this would take over 10 years — a dedicated payoff plan would accelerate this significantly.'
          : `Estimated ${months} months to clear ${$n(ccDebt)} in credit card debt (${monthsToDateString(months)}).`,
      };
    }
  }

  return milestones;
}

// ── 10. Financial Picture Summary ─────────────────────────────────────────────

export function generatePictureSummary(
  snap:     NetWorthSnapshot | undefined,
  prevSnap: NetWorthSnapshot | undefined,
  flow:     MonthlyCashFlow  | undefined,
  prevFlow: MonthlyCashFlow  | undefined,
): FinancialPictureSummary {
  const hasSnap = !!snap && !isEmptySnapshot(snap);
  const hasFlow = !!flow && !isEmptyCashFlow(flow);
  const hasData = hasSnap || hasFlow;

  if (!hasData) {
    return {
      headline: 'Your financial picture is ready when you are.',
      narrative: 'Connect your bank with Plaid or log your first month of balances and cash flow to see personalised insights.',
      currentNetWorth: 0, netWorthChange: null,
      totalIncome: 0, totalExpenses: 0, monthlySurplus: 0, savingsRate: 0,
      cashRunwayMonths: null, mainStrength: null, mainRisk: null, bestNextMove: null,
      hasData: false,
    };
  }

  const { netWorth = 0, totalAssets = 0, totalLiabilities = 0 } = hasSnap ? computeNetWorth(snap!) : {};
  const { totalIncome = 0, totalExpenses = 0, surplus = 0, savingsRate = 0 } = hasFlow ? computeCashFlow(flow!) : {};
  const liquid = hasSnap ? snap!.checking + snap!.savings : 0;
  const runway = totalExpenses > 0 ? liquid / totalExpenses : null;

  // MoM change — only when previous data exists and is non-empty
  const netWorthChange = (hasSnap && prevSnap && !isEmptySnapshot(prevSnap))
    ? netWorth - computeNetWorth(prevSnap).netWorth
    : null;

  // Headline — describe overall trajectory
  let headline: string;
  if (!hasFlow) {
    headline = netWorth > 0 ? `Your net worth stands at ${$n(netWorth)}.` : 'Add cash flow data to complete your financial picture.';
  } else if (surplus < 0) {
    headline = 'Your spending is currently exceeding your income.';
  } else if (netWorthChange !== null && netWorthChange > 0) {
    headline = 'Your financial picture is improving.';
  } else if (netWorthChange !== null && netWorthChange < 0) {
    headline = 'Your net worth dipped this month — here is what happened.';
  } else if (savingsRate >= 20) {
    headline = 'You are saving well and building momentum.';
  } else {
    headline = 'Here is where you stand financially.';
  }

  // Narrative — 2–3 sentence summary
  const nwLine = hasSnap
    ? netWorthChange !== null
      ? `You have a net worth of ${$n(netWorth)}, ${netWorthChange >= 0 ? 'up' : 'down'} ${$n(Math.abs(netWorthChange))} from last month.`
      : `Your current net worth is ${$n(netWorth)}.`
    : '';

  const flowLine = hasFlow
    ? `You saved ${pct(savingsRate)} of your income this month${runway !== null ? ` and have ${runway.toFixed(1)} months of cash runway` : ''}.`
    : '';

  const narrative = [nwLine, flowLine].filter(Boolean).join(' ');

  // Main strength
  let mainStrength: string | null = null;
  if (hasFlow && savingsRate >= 20) mainStrength = `Your savings rate of ${pct(savingsRate)} is above the 20% target.`;
  else if (hasFlow && surplus > 0 && totalIncome > 0) mainStrength = 'Your income comfortably exceeds your expenses.';
  else if (hasSnap && totalLiabilities === 0) mainStrength = 'You carry no debt — giving you maximum financial flexibility.';
  else if (runway !== null && runway >= 6) mainStrength = `You have ${runway.toFixed(1)} months of emergency fund — a strong safety net.`;

  // Main risk
  let mainRisk: string | null = null;
  if (hasFlow && surplus < 0) mainRisk = `Monthly deficit of ${$n(Math.abs(surplus))} — expenses exceed income.`;
  else if (runway !== null && runway < 3) mainRisk = `Cash runway of ${runway.toFixed(1)} months is below the 3-month minimum.`;
  else if (hasSnap && snap!.credit_cards > 0) mainRisk = `${$n(snap!.credit_cards)} in credit card debt at 20%+ APR.`;
  else if (hasFlow && savingsRate < 10) mainRisk = `Savings rate of ${pct(savingsRate)} — below the 10% baseline.`;

  // Best next move
  let bestNextMove: string | null = null;
  const action = generateNextBestAction(snap, flow, hasSnap ? [snap!] : [], hasFlow ? [flow!] : []);
  if (action) bestNextMove = action.title;

  return {
    headline, narrative,
    currentNetWorth: netWorth, netWorthChange,
    totalIncome, totalExpenses, monthlySurplus: surplus, savingsRate,
    cashRunwayMonths: runway,
    mainStrength, mainRisk, bestNextMove,
    hasData: true,
  };
}

// ── 11. Composed Entry Point ──────────────────────────────────────────────────

export function generateFinancialInsights(
  snapshots:    NetWorthSnapshot[],
  cashFlows:    MonthlyCashFlow[],
  scenarios:    ScenarioModel[],
  lastSyncedAt?: string | null,
): FinancialInsights {
  const latest   = snapshots[snapshots.length - 1];
  const prev     = snapshots[snapshots.length - 2];
  const latestFlow = cashFlows[cashFlows.length - 1];
  const prevFlow   = cashFlows[cashFlows.length - 2];

  return {
    summary:        generatePictureSummary(latest, prev, latestFlow, prevFlow),
    healthScore:    computeHealthScore(latest, prev, latestFlow, prevFlow),
    stage:          classifyStage(latest, latestFlow),
    netWorthChange: (latest && prev) ? analyzeNetWorthChange(latest, prev) : null,
    moneyStory:     latestFlow ? generateMonthlyMoneyStory(latestFlow, prevFlow, latest, prev) : null,
    benchmarks:     computeBenchmarks(latest, latestFlow),
    risks:          generateRiskAlerts(snapshots, cashFlows, lastSyncedAt),
    opportunities:  generateOpportunities(latest, latestFlow, scenarios),
    nextBestAction: generateNextBestAction(latest, latestFlow, snapshots, cashFlows),
    milestones:     computeMilestones(latest, latestFlow),
  };
}
