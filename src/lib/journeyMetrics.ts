import type { JourneyDef, JourneyId } from '@/components/somatech/journey/journeyConfig';
import { projectInvestmentGoal } from '@/lib/investmentGoalEngine';
import { formatMoney } from '@/lib/journeyMoney';

export type MetricDirection = 'higher' | 'lower' | 'target' | 'neutral';
export type MetricStatus = 'good' | 'watch' | 'risk' | 'neutral';

export interface JourneyMetric {
  id: string;
  label: string;
  value: string;
  numericValue: number | null;
  unit: 'currency' | 'percent' | 'months' | 'date' | 'text';
  betterWhen: MetricDirection;
  status: MetricStatus;
  sub?: string;
  highlight?: boolean;
  sourceQuestionIds: string[];
  assumptionIds?: string[];
}

export interface JourneyAssumption {
  id: string;
  label: string;
  value: string;
  version: string;
}

export interface JourneyAnalysis {
  journeyId: JourneyId;
  metrics: JourneyMetric[];
  assumptions: JourneyAssumption[];
  errors: string[];
  monthlyCommitment: number;
  primaryTargetDate: string | null;
}

const HOME_ASSUMPTION_VERSION = 'home-us-2026.1';

const numberAnswer = (answers: Record<string, string | number>, key: string, fallback = 0) => {
  const value = Number(answers[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
};

function addCalendarMonths(months: number): Date {
  const now = new Date();
  const day = now.getDate();
  const target = new Date(now.getFullYear(), now.getMonth() + Math.max(0, months), 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return target;
}

export interface DebtProjection {
  months: number | null;
  interestPaid: number | null;
  minimumProgressPayment: number;
}

/** Month-by-month amortisation avoids zero-rate division and partial-final-payment errors. */
export function projectDebt(balance: number, annualRatePct: number, monthlyPayment: number): DebtProjection {
  const monthlyRate = Math.max(0, annualRatePct) / 100 / 12;
  const minimumProgressPayment = monthlyRate > 0 ? balance * monthlyRate + 0.01 : 0.01;
  if (balance <= 0 || monthlyPayment <= 0 || monthlyPayment < minimumProgressPayment) {
    return { months: null, interestPaid: null, minimumProgressPayment };
  }

  let remaining = balance;
  let interestPaid = 0;
  let months = 0;
  while (remaining > 0.005 && months < 600) {
    const interest = remaining * monthlyRate;
    interestPaid += interest;
    remaining = Math.max(0, remaining + interest - monthlyPayment);
    months += 1;
  }
  return {
    months: remaining <= 0.005 ? months : null,
    interestPaid: remaining <= 0.005 ? interestPaid : null,
    minimumProgressPayment,
  };
}

function analyzeDebt(answers: Record<string, string | number>): JourneyAnalysis {
  const debt = numberAnswer(answers, 'totalDebt');
  const payment = numberAnswer(answers, 'monthlyPayment');
  const currentMinimum = numberAnswer(answers, 'currentMinimumPayment');
  const annualRate = numberAnswer(answers, 'interestRate');
  const takeHome = numberAnswer(answers, 'monthlyIncome');
  const projection = projectDebt(debt, annualRate, payment);
  const sources = ['totalDebt', 'currentMinimumPayment', 'monthlyPayment', 'interestRate'];
  const incrementalCommitment = Math.max(0, payment - currentMinimum);

  if (debt <= 0 || payment <= 0 || currentMinimum < 0 || payment < currentMinimum) {
    return {
      journeyId: 'debt-freedom', assumptions: [], monthlyCommitment: incrementalCommitment, primaryTargetDate: null,
      errors: [payment < currentMinimum
        ? 'The planned total payment cannot be lower than the current required minimums.'
        : 'Enter a debt balance and monthly payment greater than zero.'], metrics: [],
    };
  }
  if (projection.months === null) {
    return {
      journeyId: 'debt-freedom', assumptions: [], monthlyCommitment: incrementalCommitment, primaryTargetDate: null,
      errors: ['The payment does not clear the monthly interest within the 50-year model window.'],
      metrics: [{
        id: 'minimum-progress-payment', label: 'Minimum payment to reduce principal',
        value: `${formatMoney(Math.ceil(projection.minimumProgressPayment))}/mo`, numericValue: projection.minimumProgressPayment,
        unit: 'currency', betterWhen: 'lower', status: 'risk', highlight: true,
        sub: 'This only starts reducing principal; a practical payoff plan should be higher.', sourceQuestionIds: sources,
      }],
    };
  }

  const target = addCalendarMonths(projection.months);
  const paymentShare = takeHome > 0 ? payment / takeHome * 100 : null;
  return {
    journeyId: 'debt-freedom', assumptions: [], errors: [], monthlyCommitment: incrementalCommitment,
    primaryTargetDate: target.toISOString().slice(0, 10),
    metrics: [
      {
        id: 'debt-free-date', label: 'Projected debt-free date',
        value: target.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), numericValue: projection.months,
        unit: 'date', betterWhen: 'lower', status: projection.months <= 36 ? 'good' : projection.months <= 84 ? 'watch' : 'risk',
        sub: `${projection.months} months at the entered average APR and payment`, highlight: true, sourceQuestionIds: sources,
      },
      {
        id: 'interest-paid', label: 'Projected interest paid', value: formatMoney(projection.interestPaid ?? 0),
        numericValue: projection.interestPaid, unit: 'currency', betterWhen: 'lower', status: 'neutral',
        sub: 'Aggregate estimate; itemized debts are required for a true avalanche schedule.', sourceQuestionIds: sources,
      },
      {
        id: 'take-home-payment-share', label: 'Payment share of take-home',
        value: paymentShare === null ? 'N/A' : `${paymentShare.toFixed(1)}%`, numericValue: paymentShare,
        unit: 'percent', betterWhen: 'target', status: paymentShare === null ? 'neutral' : paymentShare > 25 ? 'watch' : 'good',
        sub: 'This is not lender DTI, which normally uses gross income and all required debt payments.',
        sourceQuestionIds: ['monthlyPayment', 'monthlyIncome'],
      },
      {
        id: 'additional-payoff-commitment', label: 'New monthly commitment from surplus',
        value: formatMoney(incrementalCommitment), numericValue: incrementalCommitment,
        unit: 'currency', betterWhen: 'neutral', status: 'neutral',
        sub: `${formatMoney(payment)} planned total less ${formatMoney(currentMinimum)} of current required minimums.`,
        sourceQuestionIds: ['currentMinimumPayment', 'monthlyPayment'],
      },
    ],
  };
}

function analyzeBudget(answers: Record<string, string | number>): JourneyAnalysis {
  const income = numberAnswer(answers, 'monthlyIncome');
  const fixed = numberAnswer(answers, 'fixedExpenses');
  const variable = numberAnswer(answers, 'variableExpenses');
  const savingsGoal = numberAnswer(answers, 'savingsGoal');
  const expenses = fixed + variable;
  const surplus = income - expenses;
  const savingsRate = income > 0 ? surplus / income * 100 : null;
  const gap = surplus - savingsGoal;
  const errors = income <= 0 ? ['Enter monthly take-home income greater than zero.'] : [];

  return {
    journeyId: 'budget-clarity', assumptions: [], errors, monthlyCommitment: Math.max(0, savingsGoal), primaryTargetDate: null,
    metrics: errors.length ? [] : [
      {
        id: 'monthly-surplus', label: 'Monthly surplus', value: formatMoney(surplus), numericValue: surplus,
        unit: 'currency', betterWhen: 'higher', status: surplus < 0 ? 'risk' : surplus === 0 ? 'watch' : 'good', highlight: true,
        sub: surplus < 0 ? 'Spending exceeds income.' : 'Available before assigning goal contributions.',
        sourceQuestionIds: ['monthlyIncome', 'fixedExpenses', 'variableExpenses'],
      },
      {
        id: 'savings-rate', label: 'Current savings rate', value: `${(savingsRate ?? 0).toFixed(1)}%`, numericValue: savingsRate,
        unit: 'percent', betterWhen: 'higher', status: (savingsRate ?? -1) >= 20 ? 'good' : (savingsRate ?? -1) >= 10 ? 'watch' : 'risk',
        sub: 'Calculated from total spending. Fixed does not automatically mean “need,” and variable does not mean “want.”',
        sourceQuestionIds: ['monthlyIncome', 'fixedExpenses', 'variableExpenses'],
      },
      {
        id: 'savings-goal-gap', label: 'Capacity versus savings target',
        value: gap >= 0 ? `${formatMoney(gap)} available` : `${formatMoney(Math.abs(gap))} short`, numericValue: gap,
        unit: 'currency', betterWhen: 'higher', status: gap >= 0 ? 'good' : 'risk',
        sub: gap >= 0 ? 'The target fits inside the current surplus.' : 'Adjust the target, spending, or income before activation.',
        sourceQuestionIds: ['savingsGoal', 'monthlyIncome', 'fixedExpenses', 'variableExpenses'],
      },
    ],
  };
}

function analyzeInvestor(answers: Record<string, string | number>): JourneyAnalysis {
  const goal = numberAnswer(answers, 'investmentGoal');
  const current = numberAnswer(answers, 'currentSavings');
  const monthly = numberAnswer(answers, 'monthlyContribution');
  const horizon = numberAnswer(answers, 'investmentHorizonYears');
  const risk = String(answers.riskTolerance ?? 'moderate');
  const errors = goal <= 0 || current < 0 || monthly < 0 || horizon < 1 || horizon > 50
    ? ['Enter a valid goal, current balance, contribution, and 1–50 year horizon.'] : [];
  if (errors.length) return { journeyId: 'investor-starter', metrics: [], assumptions: [], errors, monthlyCommitment: Math.max(0, monthly), primaryTargetDate: null };

  const projection = projectInvestmentGoal({
    targetAmount: goal, currentBalance: current, monthlyContribution: monthly, horizonYears: horizon,
    riskProfile: risk === 'conservative' || risk === 'growth' ? risk : 'moderate',
  });
  const expected = projection.scenarios.find(s => s.name === 'Expected');
  const target = addCalendarMonths(horizon * 12);
  const sources = ['investmentGoal', 'currentSavings', 'monthlyContribution', 'investmentHorizonYears', 'riskTolerance'];
  return {
    journeyId: 'investor-starter', errors: [], monthlyCommitment: monthly, primaryTargetDate: target.toISOString().slice(0, 10),
    assumptions: [{ id: 'investment-model', label: 'Projection model', value: projection.assumptions.version, version: projection.assumptions.version }],
    metrics: [
      {
        id: 'goal-likelihood', label: `Modeled likelihood of reaching ${formatMoney(goal)}`,
        value: `${projection.expectedGoalProbabilityPct.toFixed(0)}%`, numericValue: projection.expectedGoalProbabilityPct,
        unit: 'percent', betterWhen: 'higher', status: projection.status === 'on_track' ? 'good' : projection.status === 'close' ? 'watch' : 'risk',
        sub: 'A model estimate, not a guarantee.', highlight: true, sourceQuestionIds: sources, assumptionIds: ['investment-model'],
      },
      {
        id: 'required-contribution', label: 'Expected-case required contribution',
        value: `${formatMoney(Math.ceil(projection.requiredMonthlyContribution))}/mo`, numericValue: projection.requiredMonthlyContribution,
        unit: 'currency', betterWhen: 'lower', status: projection.monthlyContributionGap >= 0 ? 'good' : 'risk',
        sub: projection.monthlyContributionGap >= 0
          ? `${formatMoney(projection.monthlyContributionGap)}/mo above the modeled requirement.`
          : `${formatMoney(Math.abs(projection.monthlyContributionGap))}/mo additional contribution modeled as necessary.`,
        sourceQuestionIds: sources, assumptionIds: ['investment-model'],
      },
      {
        id: 'expected-ending-value', label: 'Expected ending value', value: formatMoney(expected?.endingBalance ?? 0),
        numericValue: expected?.endingBalance ?? null, unit: 'currency', betterWhen: 'higher', status: 'neutral',
        sub: `Modeled 10th–90th percentile: ${formatMoney(projection.percentile10)}–${formatMoney(projection.percentile90)}.`,
        sourceQuestionIds: sources, assumptionIds: ['investment-model'],
      },
    ],
  };
}

function analyzeHome(answers: Record<string, string | number>): JourneyAnalysis {
  const price = numberAnswer(answers, 'targetHomePrice');
  const saved = numberAnswer(answers, 'currentSavings');
  const monthlySavings = numberAnswer(answers, 'monthlySavings');
  const takeHome = numberAnswer(answers, 'monthlyIncome');
  const mortgageRate = numberAnswer(answers, 'mortgageRate', 6.5);
  const depositPct = numberAnswer(answers, 'depositPercent', 20);
  const errors = price <= 0 || monthlySavings <= 0 || depositPct <= 0 || depositPct >= 100 || mortgageRate < 0
    ? ['Enter a valid home price, monthly savings amount, deposit percentage, and mortgage rate.'] : [];
  if (errors.length) return { journeyId: 'home-buying', metrics: [], assumptions: [], errors, monthlyCommitment: Math.max(0, monthlySavings), primaryTargetDate: null };

  const depositTarget = price * depositPct / 100;
  const remaining = Math.max(0, depositTarget - saved);
  const months = remaining === 0 ? 0 : Math.ceil(remaining / monthlySavings);
  const target = addCalendarMonths(months);
  const loan = Math.max(0, price - Math.max(saved, depositTarget));
  const monthlyRate = mortgageRate / 100 / 12;
  const term = 360;
  const mortgage = loan === 0 ? 0 : monthlyRate === 0 ? loan / term
    : loan * monthlyRate * Math.pow(1 + monthlyRate, term) / (Math.pow(1 + monthlyRate, term) - 1);
  const propertyTax = price * 0.01 / 12;
  const insurance = price * 0.005 / 12;
  const maintenance = price * 0.01 / 12;
  const ownershipCost = mortgage + propertyTax + insurance + maintenance;
  const paymentShare = takeHome > 0 ? ownershipCost / takeHome * 100 : null;
  const sources = ['targetHomePrice', 'currentSavings', 'monthlySavings', 'monthlyIncome', 'mortgageRate', 'depositPercent'];
  const assumptions: JourneyAssumption[] = [
    { id: 'property-tax', label: 'Property tax', value: '1.0%/year', version: HOME_ASSUMPTION_VERSION },
    { id: 'home-insurance', label: 'Home insurance', value: '0.5%/year', version: HOME_ASSUMPTION_VERSION },
    { id: 'maintenance', label: 'Maintenance reserve', value: '1.0%/year', version: HOME_ASSUMPTION_VERSION },
    { id: 'mortgage-term', label: 'Mortgage term', value: '30 years', version: HOME_ASSUMPTION_VERSION },
  ];
  return {
    journeyId: 'home-buying', errors: [], assumptions, monthlyCommitment: monthlySavings,
    primaryTargetDate: target.toISOString().slice(0, 10),
    metrics: [
      {
        id: 'deposit-date', label: months === 0 ? 'Deposit ready' : 'Projected deposit date',
        value: months === 0 ? 'Ready now' : target.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        numericValue: months, unit: 'date', betterWhen: 'lower', status: months <= 60 ? 'good' : months <= 120 ? 'watch' : 'risk',
        sub: `${formatMoney(depositTarget)} target (${depositPct}% of price).`, highlight: true, sourceQuestionIds: sources,
      },
      {
        id: 'ownership-cost', label: 'Illustrative monthly ownership cost', value: formatMoney(ownershipCost), numericValue: ownershipCost,
        unit: 'currency', betterWhen: 'lower', status: paymentShare !== null && paymentShare > 35 ? 'risk' : 'neutral',
        sub: `Mortgage ${formatMoney(mortgage)} + modeled tax, insurance, and maintenance. Excludes closing costs and HOA.`,
        sourceQuestionIds: sources, assumptionIds: assumptions.map(a => a.id),
      },
      {
        id: 'ownership-take-home-share', label: 'Ownership cost share of take-home',
        value: paymentShare === null ? 'N/A' : `${paymentShare.toFixed(1)}%`, numericValue: paymentShare,
        unit: 'percent', betterWhen: 'lower', status: paymentShare === null ? 'neutral' : paymentShare > 35 ? 'risk' : paymentShare > 28 ? 'watch' : 'good',
        sub: 'Planning ratio only; lender underwriting normally uses gross income and full debt obligations.', sourceQuestionIds: sources,
      },
    ],
  };
}

function analyzeBusiness(answers: Record<string, string | number>): JourneyAnalysis {
  const revenue = numberAnswer(answers, 'monthlyRevenue');
  const expenses = numberAnswer(answers, 'monthlyExpenses');
  const targetPay = numberAnswer(answers, 'targetOwnerSalary');
  const reserves = numberAnswer(answers, 'cashReserves');
  const errors = revenue < 0 || expenses < 0 || targetPay < 0 || reserves < 0
    ? ['Business inputs cannot be negative.'] : [];
  const operatingProfit = revenue - expenses;
  const cashAfterOwnerPay = revenue - expenses - targetPay;
  const netBurn = Math.max(0, -cashAfterOwnerPay);
  const runway = netBurn > 0 ? reserves / netBurn : null;
  const requiredRevenue = expenses + targetPay;
  const margin = revenue > 0 ? operatingProfit / revenue * 100 : null;
  const sources = ['monthlyRevenue', 'monthlyExpenses', 'targetOwnerSalary', 'cashReserves'];
  return {
    journeyId: 'business-owner', assumptions: [], errors, monthlyCommitment: 0, primaryTargetDate: null,
    metrics: errors.length ? [] : [
      {
        id: 'operating-profit', label: 'Operating profit before owner pay', value: formatMoney(operatingProfit), numericValue: operatingProfit,
        unit: 'currency', betterWhen: 'higher', status: operatingProfit > 0 ? 'good' : operatingProfit === 0 ? 'watch' : 'risk', highlight: true,
        sub: margin === null ? 'Add revenue to calculate operating margin.' : `${margin.toFixed(1)}% operating margin.`, sourceQuestionIds: sources,
      },
      {
        id: 'cash-after-owner-pay', label: 'Cash flow after target owner pay', value: formatMoney(cashAfterOwnerPay), numericValue: cashAfterOwnerPay,
        unit: 'currency', betterWhen: 'higher', status: cashAfterOwnerPay >= 0 ? 'good' : 'risk',
        sub: cashAfterOwnerPay >= 0 ? 'Current revenue covers expenses and target owner pay.' : `${formatMoney(netBurn)}/mo would be drawn from reserves.`,
        sourceQuestionIds: sources,
      },
      {
        id: 'business-runway', label: 'Runway at current net burn',
        value: runway === null ? 'Cash-flow positive' : `${runway.toFixed(1)} months`, numericValue: runway,
        unit: 'months', betterWhen: 'higher', status: runway === null ? 'good' : runway < 3 ? 'risk' : runway < 6 ? 'watch' : 'good',
        sub: runway === null ? 'Revenue covers expenses and target owner pay.' : 'Reserves divided by the monthly shortfall after revenue.', sourceQuestionIds: sources,
      },
      {
        id: 'required-revenue', label: 'Revenue needed for target owner pay', value: `${formatMoney(requiredRevenue)}/mo`, numericValue: requiredRevenue,
        unit: 'currency', betterWhen: 'lower', status: revenue >= requiredRevenue ? 'good' : 'watch',
        sub: 'Assumes entered operating expenses remain fixed as revenue changes.', sourceQuestionIds: sources,
      },
    ],
  };
}

export function analyzeJourney(journey: JourneyDef, answers: Record<string, string | number>): JourneyAnalysis {
  switch (journey.id) {
    case 'debt-freedom': return analyzeDebt(answers);
    case 'budget-clarity': return analyzeBudget(answers);
    case 'investor-starter': return analyzeInvestor(answers);
    case 'home-buying': return analyzeHome(answers);
    case 'business-owner': return analyzeBusiness(answers);
  }
}

export function metricDelta(baseline: JourneyMetric, scenario: JourneyMetric): number | null {
  if (baseline.numericValue === null || scenario.numericValue === null) return null;
  return scenario.numericValue - baseline.numericValue;
}

export interface JourneyMetricDelta {
  value: number;
  label: string;
  favorable: boolean | null;
}

export function describeMetricDelta(baseline: JourneyMetric, scenario: JourneyMetric): JourneyMetricDelta | null {
  const value = metricDelta(baseline, scenario);
  if (value === null) return null;
  const favorable = value === 0 || scenario.betterWhen === 'neutral' || scenario.betterWhen === 'target'
    ? null
    : scenario.betterWhen === 'higher' ? value > 0 : value < 0;
  if (value === 0) return { value, label: 'No change', favorable };

  const magnitude = Math.abs(value);
  let label: string;
  if (scenario.unit === 'currency') {
    label = `${formatMoney(magnitude)} ${value > 0 ? 'higher' : 'lower'}`;
  } else if (scenario.unit === 'percent') {
    label = `${magnitude.toFixed(1)} percentage points ${value > 0 ? 'higher' : 'lower'}`;
  } else if (scenario.unit === 'months' || scenario.unit === 'date') {
    label = `${Math.round(magnitude)} ${Math.round(magnitude) === 1 ? 'month' : 'months'} ${value > 0 ? 'later' : 'sooner'}`;
  } else {
    label = `${magnitude.toFixed(1)} ${value > 0 ? 'higher' : 'lower'}`;
  }
  return { value, label, favorable };
}
