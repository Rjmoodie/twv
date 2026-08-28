export type InvestmentRiskProfile = 'conservative' | 'moderate' | 'growth';

export interface InvestmentGoalInputs {
  targetAmount: number;
  currentBalance: number;
  monthlyContribution: number;
  horizonYears: number;
  riskProfile: InvestmentRiskProfile;
  annualContributionGrowthPct?: number;
  inflationPct?: number;
}

export interface InvestmentScenario {
  name: 'Downside' | 'Expected' | 'Strong';
  annualReturnPct: number;
  endingBalance: number;
  goalCoveragePct: number;
  reachesGoal: boolean;
}

export interface InvestmentGoalProjection {
  inputs: InvestmentGoalInputs;
  scenarios: InvestmentScenario[];
  requiredMonthlyContribution: number;
  monthlyContributionGap: number;
  expectedGoalProbabilityPct: number;
  projectedRealValue: number;
  totalContributions: number;
  expectedInvestmentGrowth: number;
  percentile10: number;
  percentile50: number;
  percentile90: number;
  status: 'on_track' | 'close' | 'off_track';
  assumptions: {
    version: string;
    inflationPct: number;
    volatilityPct: number;
    simulationCount: number;
  };
}

const RETURN_ASSUMPTIONS: Record<InvestmentRiskProfile, { downside: number; expected: number; strong: number; volatility: number }> = {
  conservative: { downside: 0.02, expected: 0.045, strong: 0.065, volatility: 0.07 },
  moderate:     { downside: 0.025, expected: 0.065, strong: 0.09, volatility: 0.12 },
  growth:       { downside: 0.02, expected: 0.08, strong: 0.11, volatility: 0.18 },
};

export function normalizeInvestmentRiskProfile(value: unknown): InvestmentRiskProfile {
  return value === 'conservative' || value === 'growth' ? value : 'moderate';
}

const finiteNonNegative = (value: number): number => Number.isFinite(value) && value >= 0 ? value : 0;

export function validateInvestmentGoal(inputs: InvestmentGoalInputs): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(inputs.targetAmount) || inputs.targetAmount <= 0) errors.push('Enter a goal greater than zero.');
  if (!Number.isFinite(inputs.currentBalance) || inputs.currentBalance < 0) errors.push('Current investments cannot be negative.');
  if (!Number.isFinite(inputs.monthlyContribution) || inputs.monthlyContribution < 0) errors.push('Monthly contribution cannot be negative.');
  if (!Number.isFinite(inputs.horizonYears) || inputs.horizonYears < 1 || inputs.horizonYears > 50) errors.push('Choose a horizon from 1 to 50 years.');
  if (!Object.hasOwn(RETURN_ASSUMPTIONS, inputs.riskProfile)) errors.push('Choose a valid risk profile.');
  if (inputs.annualContributionGrowthPct != null && (!Number.isFinite(inputs.annualContributionGrowthPct) || inputs.annualContributionGrowthPct < -99 || inputs.annualContributionGrowthPct > 100)) errors.push('Contribution growth must be between -99% and 100%.');
  if (inputs.inflationPct != null && (!Number.isFinite(inputs.inflationPct) || inputs.inflationPct <= -100 || inputs.inflationPct > 100)) errors.push('Inflation must be between -100% and 100%.');
  return errors;
}

export function projectBalance(
  currentBalance: number,
  monthlyContribution: number,
  horizonYears: number,
  annualReturn: number,
  annualContributionGrowthPct = 0,
): { endingBalance: number; totalContributions: number } {
  const months = Math.max(0, Math.round(horizonYears * 12));
  const monthlyRate = annualReturn / 12;
  const annualGrowth = Math.max(-0.99, annualContributionGrowthPct / 100);
  let balance = finiteNonNegative(currentBalance);
  let contribution = finiteNonNegative(monthlyContribution);
  let totalContributions = balance;

  for (let month = 0; month < months; month += 1) {
    if (month > 0 && month % 12 === 0) contribution *= 1 + annualGrowth;
    balance = balance * (1 + monthlyRate) + contribution;
    totalContributions += contribution;
  }
  return { endingBalance: balance, totalContributions };
}

export function requiredMonthlyContribution(inputs: InvestmentGoalInputs, annualReturn: number): number {
  if (inputs.currentBalance >= inputs.targetAmount) return 0;
  const withoutContributions = projectBalance(inputs.currentBalance, 0, inputs.horizonYears, annualReturn).endingBalance;
  if (withoutContributions >= inputs.targetAmount) return 0;

  let low = 0;
  let high = Math.max(100, inputs.targetAmount / (inputs.horizonYears * 12));
  while (projectBalance(inputs.currentBalance, high, inputs.horizonYears, annualReturn, inputs.annualContributionGrowthPct).endingBalance < inputs.targetAmount) {
    high *= 2;
  }
  for (let i = 0; i < 60; i += 1) {
    const midpoint = (low + high) / 2;
    const ending = projectBalance(inputs.currentBalance, midpoint, inputs.horizonYears, annualReturn, inputs.annualContributionGrowthPct).endingBalance;
    if (ending >= inputs.targetAmount) high = midpoint;
    else low = midpoint;
  }
  return high;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function normalSample(random: () => number): number {
  const u1 = Math.max(random(), Number.EPSILON);
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function simulationSeed(inputs: InvestmentGoalInputs): number {
  const text = `${inputs.targetAmount}|${inputs.currentBalance}|${inputs.monthlyContribution}|${inputs.horizonYears}|${inputs.riskProfile}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

// ─── Projection path ──────────────────────────────────────────────────────────
//
// projectInvestmentGoal answers "where do I end up". Charting progress needs
// "where should I be along the way", so this runs the same simulation and keeps
// the monthly distribution instead of only the terminal one.

export interface ProjectionPoint {
  /** Months from the projection's start. 0 is the starting balance. */
  month: number;
  /** ISO date for that month, derived from the baseline start date. */
  date: string;
  p10: number;
  p50: number;
  p90: number;
  /** Balance with contributions but zero return — separates deposits from growth. */
  contributionsOnly: number;
}

export interface ProjectionPath {
  startedAt: string;
  targetAmount: number;
  points: ProjectionPoint[];
}

const PATH_SIMULATIONS = 1000;

/**
 * Monthly p10/p50/p90 for the goal, plus a zero-return contributions line.
 *
 * Uses the same seeded generator as projectInvestmentGoal, so a given set of
 * inputs always produces the same path — a baseline that shifts on reload would
 * be worse than no baseline at all.
 */
export function projectInvestmentGoalPath(
  inputs: InvestmentGoalInputs,
  startedAt: string = new Date().toISOString(),
): ProjectionPath {
  const errors = validateInvestmentGoal(inputs);
  if (errors.length) throw new Error(errors[0]);

  const assumption = RETURN_ASSUMPTIONS[inputs.riskProfile];
  const months = Math.max(0, Math.round(inputs.horizonYears * 12));
  const monthlyMean = assumption.expected / 12;
  const monthlyVolatility = assumption.volatility / Math.sqrt(12);
  const growth = (inputs.annualContributionGrowthPct ?? 0) / 100;
  const random = seededRandom(simulationSeed(inputs));

  // balancesByMonth[m] holds every simulation's balance at month m.
  const balancesByMonth: number[][] = Array.from({ length: months + 1 }, () => []);

  for (let simulation = 0; simulation < PATH_SIMULATIONS; simulation += 1) {
    let balance = finiteNonNegative(inputs.currentBalance);
    let contribution = finiteNonNegative(inputs.monthlyContribution);
    balancesByMonth[0].push(balance);
    for (let month = 1; month <= months; month += 1) {
      if (month > 1 && (month - 1) % 12 === 0) contribution *= 1 + growth;
      const monthlyReturn = Math.max(-0.95, monthlyMean + monthlyVolatility * normalSample(random));
      balance = Math.max(0, balance * (1 + monthlyReturn) + contribution);
      balancesByMonth[month].push(balance);
    }
  }

  // Zero-return line: the same contribution schedule with no market movement.
  const contributionsOnly: number[] = [];
  {
    let balance = finiteNonNegative(inputs.currentBalance);
    let contribution = finiteNonNegative(inputs.monthlyContribution);
    contributionsOnly.push(balance);
    for (let month = 1; month <= months; month += 1) {
      if (month > 1 && (month - 1) % 12 === 0) contribution *= 1 + growth;
      balance += contribution;
      contributionsOnly.push(balance);
    }
  }

  const start = new Date(startedAt);
  const at = (values: number[], pct: number) =>
    values[Math.min(values.length - 1, Math.floor(values.length * pct))];

  const points = balancesByMonth.map((values, month) => {
    values.sort((a, b) => a - b);
    const date = new Date(start);
    date.setMonth(date.getMonth() + month);
    return {
      month,
      date: date.toISOString().slice(0, 10),
      p10: at(values, 0.1),
      p50: at(values, 0.5),
      p90: at(values, 0.9),
      contributionsOnly: contributionsOnly[month],
    };
  });

  return { startedAt, targetAmount: inputs.targetAmount, points };
}

/** Where an actual balance sits against the baseline for the same month. */
export interface ProjectionComparison {
  month: number;
  expected: number;
  actual: number;
  /** actual − p50. Positive is ahead of plan. */
  varianceUsd: number;
  variancePct: number;
  /** Below p10, inside the band, or above p90. */
  band: 'below' | 'within' | 'above';
}

export function compareToProjection(
  path: ProjectionPath,
  asOf: string,
  actualValue: number,
): ProjectionComparison | null {
  if (!path.points.length) return null;
  const start = new Date(path.startedAt).getTime();
  const elapsed = new Date(asOf).getTime() - start;
  if (!Number.isFinite(elapsed)) return null;

  // Average month length; exact calendar months are not meaningful here because
  // the projection is monthly-stepped rather than date-anchored.
  const month = Math.max(0, Math.min(path.points.length - 1, Math.round(elapsed / 2_629_800_000)));
  const point = path.points[month];
  const variance = actualValue - point.p50;

  return {
    month,
    expected: point.p50,
    actual: actualValue,
    varianceUsd: variance,
    variancePct: point.p50 === 0 ? 0 : (variance / point.p50) * 100,
    band: actualValue < point.p10 ? 'below' : actualValue > point.p90 ? 'above' : 'within',
  };
}

export function projectInvestmentGoal(inputs: InvestmentGoalInputs): InvestmentGoalProjection {
  const errors = validateInvestmentGoal(inputs);
  if (errors.length) throw new Error(errors[0]);

  const assumption = RETURN_ASSUMPTIONS[inputs.riskProfile];
  const scenarioRates = [assumption.downside, assumption.expected, assumption.strong];
  const scenarioNames: InvestmentScenario['name'][] = ['Downside', 'Expected', 'Strong'];
  const scenarios = scenarioRates.map((rate, index) => {
    const { endingBalance } = projectBalance(inputs.currentBalance, inputs.monthlyContribution, inputs.horizonYears, rate, inputs.annualContributionGrowthPct);
    return {
      name: scenarioNames[index],
      annualReturnPct: rate * 100,
      endingBalance,
      goalCoveragePct: (endingBalance / inputs.targetAmount) * 100,
      reachesGoal: endingBalance >= inputs.targetAmount,
    };
  });

  const required = requiredMonthlyContribution(inputs, assumption.expected);
  const expected = projectBalance(inputs.currentBalance, inputs.monthlyContribution, inputs.horizonYears, assumption.expected, inputs.annualContributionGrowthPct);
  const simulationCount = 2000;
  const random = seededRandom(simulationSeed(inputs));
  const outcomes: number[] = [];
  const months = Math.round(inputs.horizonYears * 12);
  const monthlyMean = assumption.expected / 12;
  const monthlyVolatility = assumption.volatility / Math.sqrt(12);

  for (let simulation = 0; simulation < simulationCount; simulation += 1) {
    let balance = inputs.currentBalance;
    let contribution = inputs.monthlyContribution;
    for (let month = 0; month < months; month += 1) {
      if (month > 0 && month % 12 === 0) contribution *= 1 + (inputs.annualContributionGrowthPct ?? 0) / 100;
      const monthlyReturn = Math.max(-0.95, monthlyMean + monthlyVolatility * normalSample(random));
      balance = balance * (1 + monthlyReturn) + contribution;
    }
    outcomes.push(Math.max(0, balance));
  }
  outcomes.sort((a, b) => a - b);
  const percentile = (pct: number) => outcomes[Math.min(outcomes.length - 1, Math.floor(outcomes.length * pct))];
  const successes = outcomes.filter(value => value >= inputs.targetAmount).length;
  const probability = (successes / simulationCount) * 100;
  const inflationPct = inputs.inflationPct ?? 2.5;
  const projectedRealValue = expected.endingBalance / Math.pow(1 + inflationPct / 100, inputs.horizonYears);

  return {
    inputs,
    scenarios,
    requiredMonthlyContribution: required,
    monthlyContributionGap: inputs.monthlyContribution - required,
    expectedGoalProbabilityPct: probability,
    projectedRealValue,
    totalContributions: expected.totalContributions,
    expectedInvestmentGrowth: expected.endingBalance - expected.totalContributions,
    percentile10: percentile(0.10),
    percentile50: percentile(0.50),
    percentile90: percentile(0.90),
    status: probability >= 70 ? 'on_track' : probability >= 40 ? 'close' : 'off_track',
    assumptions: {
      version: '2026.1-static-capital-market-assumptions',
      inflationPct,
      volatilityPct: assumption.volatility * 100,
      simulationCount,
    },
  };
}
