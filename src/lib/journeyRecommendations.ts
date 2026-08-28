/**
 * journeyRecommendations.ts
 *
 * Pure functions — no side effects, no imports from React.
 *
 * deriveJourneyRecommendations  — reads PF data, returns ordered journey suggestions with
 *                                  specific reasoning grounded in the user's real numbers.
 *
 * mapPFDataToJourneyAnswers      — maps PF data to journey intake answer records so the
 *                                  intake form opens pre-filled rather than blank.
 *
 * Edge cases handled:
 *   - isDemo → returns [] (never derive from fake data)
 *   - all-zero snapshot → treated as no data (snapshotHasData guard)
 *   - income === 0 → skips savings-rate recommendations (avoids NaN/Infinity)
 *   - debt ratio with zero assets → uses absolute debt amount instead
 *   - single month of cash flow data → still works, but no smoothing
 *   - mortgage excluded from debt-freedom target (different user intent)
 *   - contradictory signals → priority ordering resolves (debt > budget > invest > home > business)
 *   - pre-fill zeros → skipped (set() helper guards val > 0)
 */

import type { JourneyId } from '@/components/somatech/journey/journeyConfig';
import {
  type NetWorthSnapshot,
  type MonthlyCashFlow,
  computeNetWorth,
  computeCashFlow,
} from '@/hooks/usePersonalFinance';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecommendationPriority = 'critical' | 'moderate' | 'opportunity';

export interface JourneyRecommendation {
  journeyId:  JourneyId;
  priority:   RecommendationPriority;
  headline:   string;
  reason:     string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** True only when the snapshot has at least one non-zero field. */
function snapshotHasData(s: NetWorthSnapshot): boolean {
  return (
    s.checking + s.savings + s.investments + s.real_estate + s.other_assets +
    s.credit_cards + s.student_loans + s.mortgage + s.car_loans + s.other_liabilities
  ) > 0;
}

function avgField(flows: MonthlyCashFlow[], field: keyof MonthlyCashFlow): number {
  if (flows.length === 0) return 0;
  return flows.reduce((sum, cf) => sum + (cf[field] as number), 0) / flows.length;
}

// ── deriveJourneyRecommendations ──────────────────────────────────────────────

export function deriveJourneyRecommendations(
  snapshots:  NetWorthSnapshot[],
  cashFlows:  MonthlyCashFlow[],
  isDemo:     boolean,
): JourneyRecommendation[] {
  if (isDemo) return [];

  const realSnapshots = snapshots.filter(snapshotHasData);
  const latest        = realSnapshots[realSnapshots.length - 1] ?? null;

  // Use last 3 months for averages — smooths seasonal spikes
  const recentFlows = cashFlows.slice(-3);

  if (!latest && recentFlows.length === 0) return [];

  // ── Computed aggregates ────────────────────────────────────────────────────

  const { totalAssets } = latest ? computeNetWorth(latest) : { totalAssets: 0 };

  // Exclude mortgage from payoff debt — different user intent
  const nonMortgageDebt = latest
    ? latest.credit_cards + latest.student_loans + latest.car_loans + latest.other_liabilities
    : 0;

  const avgIncome =
    avgField(recentFlows, 'primary_income') +
    avgField(recentFlows, 'side_income')    +
    avgField(recentFlows, 'investment_income') +
    avgField(recentFlows, 'other_income');

  const avgExpenses = recentFlows.length > 0
    ? recentFlows.reduce((sum, cf) => sum + computeCashFlow(cf).totalExpenses, 0) / recentFlows.length
    : 0;

  const avgSurplus     = avgIncome - avgExpenses;
  // Only compute savings rate when income is present — guards NaN / Infinity
  const avgSavingsRate = avgIncome > 0 ? (avgSurplus / avgIncome) * 100 : null;

  const liquidAssets = latest ? latest.checking + latest.savings : 0;
  const cashRunway   = avgExpenses > 0 && liquidAssets > 0
    ? liquidAssets / avgExpenses
    : null;

  // Require side/other income in at least 2 of the last 3 months — filters out one-time
  // bonuses, tax refunds, or gifts that would otherwise falsely trigger business-owner.
  const sideIncomeMonths = recentFlows.filter(
    cf => cf.side_income > 0 || cf.other_income > cf.primary_income * 0.2,
  ).length;
  const hasSideIncome = sideIncomeMonths >= Math.min(2, recentFlows.length);

  const recommendations: JourneyRecommendation[] = [];

  // ── 1. debt-freedom ────────────────────────────────────────────────────────
  // Only surface for meaningful debt — small balances (< $2,000) are easily cleared
  // without a dedicated journey and produce misleading payoff-year estimates.
  // Also suppress when surplus alone covers the debt within 4 months — not a real problem.
  const monthsToPayDebt = avgSurplus > 0 ? nonMortgageDebt / avgSurplus : Infinity;
  if (nonMortgageDebt >= 2_000 && monthsToPayDebt > 4) {
    const isCritical =
      (avgSavingsRate !== null && avgSavingsRate < 5) ||
      (totalAssets > 0 ? nonMortgageDebt / totalAssets > 0.5 : nonMortgageDebt > 5_000) ||
      avgSurplus < 0;

    // Minimum payment model: 2% of balance OR $35 floor (whichever is higher).
    // The $35 floor prevents the payoff timeline from inflating absurdly on small balances
    // where 2% drops below real card minimums.
    const monthlyMin   = Math.max(nonMortgageDebt * 0.02, 35);
    const monthlyInt   = nonMortgageDebt * (0.18 / 12);
    const netPrincipal = monthlyMin - monthlyInt;
    const payoffYears  = netPrincipal > 0
      ? Math.round((nonMortgageDebt / netPrincipal) / 12 * 10) / 10
      : null;

    // Only quote payoff years when the estimate is plausible (< 30 years)
    const yearsStr = payoffYears !== null && payoffYears < 30 ? payoffYears : null;

    recommendations.push({
      journeyId: 'debt-freedom',
      priority:  isCritical ? 'critical' : 'moderate',
      headline:  'Debt Freedom Plan',
      reason:    yearsStr !== null
        ? `You have ${fmt(nonMortgageDebt)} in non-mortgage debt. At minimum payments that's roughly ${yearsStr} years and significant interest — a focused plan cuts both.`
        : `You have ${fmt(nonMortgageDebt)} in non-mortgage debt. A structured payoff plan shows your fastest route out and how much interest you'll save.`,
    });
  }

  // ── 2. budget-clarity ──────────────────────────────────────────────────────
  if (recentFlows.length > 0 && avgIncome > 0) {
    if (avgSurplus < 0) {
      recommendations.push({
        journeyId: 'budget-clarity',
        priority:  'critical',
        headline:  'Budget Clarity',
        reason:    `Your spending has exceeded income by ${fmt(Math.abs(avgSurplus))}/month on average. Getting clarity now stops the gap from compounding into debt.`,
      });
    } else if (avgSavingsRate !== null && avgSavingsRate < 15) {
      const gap = avgIncome * 0.20 - avgSurplus;
      recommendations.push({
        journeyId: 'budget-clarity',
        priority:  'moderate',
        headline:  'Budget Clarity',
        reason:    `Your savings rate of ${avgSavingsRate.toFixed(0)}% is below the 20% target — about ${fmt(Math.max(0, gap))}/month uncaptured. A budget review usually finds it fast.`,
      });
    }
  }

  // ── 3. investor-starter ────────────────────────────────────────────────────
  // Only surface when debt and budget aren't critical
  const debtCritical   = recommendations.some(r => r.journeyId === 'debt-freedom' && r.priority === 'critical');
  const budgetNegative = avgSurplus < 0;

  if (!debtCritical && !budgetNegative && avgIncome > 0) {
    const lowInvestments = latest
      ? latest.investments < (latest.checking + latest.savings) * 0.5
      : true;
    const savingsRateGood = avgSavingsRate !== null && avgSavingsRate >= 15;
    const runwayGood      = cashRunway !== null && cashRunway >= 3;

    if (savingsRateGood && lowInvestments) {
      recommendations.push({
        journeyId: 'investor-starter',
        priority:  runwayGood ? 'opportunity' : 'moderate',
        headline:  'Start Investing',
        reason:    avgSurplus > 0
          ? `You're saving ${fmt(avgSurplus)}/month with ${fmt(liquidAssets)} sitting in low-yield cash. Putting even part of it to work compounds meaningfully over time.`
          : `Your savings rate of ${avgSavingsRate?.toFixed(0)}% gives you room to start investing. Consistent contributions beat trying to time the market.`,
      });
    }
  }

  // ── 4. home-buying ─────────────────────────────────────────────────────────
  const alreadyHasMortgage   = latest ? latest.mortgage > 0 : false;
  const anyCriticalSignal    = recommendations.some(r => r.priority === 'critical');

  if (!alreadyHasMortgage && !anyCriticalSignal && avgIncome > 0) {
    const runwayAdequate    = cashRunway !== null && cashRunway >= 3;
    const hasMeaningfulSavings = liquidAssets > avgExpenses * 2 || (avgSavingsRate !== null && avgSavingsRate >= 10);

    if (runwayAdequate && hasMeaningfulSavings) {
      // Rough deposit timeline: 20% of 3× annual income as proxy target home price
      const depositTarget  = avgIncome * 12 * 3 * 0.2;
      const alreadySaved   = liquidAssets;
      const remaining      = Math.max(0, depositTarget - alreadySaved);
      const monthsAway     = avgSurplus > 0 ? Math.ceil(remaining / avgSurplus) : null;

      recommendations.push({
        journeyId: 'home-buying',
        priority:  'opportunity',
        headline:  'Buy a Home',
        reason:    monthsAway !== null && monthsAway > 0
          ? `At your current savings rate, a 20% deposit could be ~${monthsAway} months away. A plan makes that timeline concrete and stress-tests what a mortgage adds to your cash flow.`
          : `You have no mortgage, ${fmt(liquidAssets)} saved, and a stable financial picture. Now is a good time to model what home ownership would cost.`,
      });
    }
  }

  // ── 5. business-owner ──────────────────────────────────────────────────────
  if (hasSideIncome) {
    const avgSide = avgField(recentFlows, 'side_income') + avgField(recentFlows, 'other_income');
    recommendations.push({
      journeyId: 'business-owner',
      priority:  'opportunity',
      headline:  'Business Owner',
      reason:    `You have ~${fmt(avgSide)}/month in side or other income. Understanding your runway and breakeven turns that income into a plan, not just a number.`,
    });
  }

  // ── Sort: critical → moderate → opportunity, cap at 3 ─────────────────────
  const ORDER: Record<RecommendationPriority, number> = { critical: 0, moderate: 1, opportunity: 2 };
  return recommendations
    .sort((a, b) => ORDER[a.priority] - ORDER[b.priority])
    .slice(0, 3);
}

// ── mapPFDataToJourneyAnswers ─────────────────────────────────────────────────

export function mapPFDataToJourneyAnswers(
  journeyId:  JourneyId,
  snapshots:  NetWorthSnapshot[],
  cashFlows:  MonthlyCashFlow[],
): Record<string, number | string> {
  const realSnapshots = snapshots.filter(snapshotHasData);
  const latest        = realSnapshots[realSnapshots.length - 1] ?? null;
  const recentFlows   = cashFlows.slice(-3);

  // Averages — last 3 months smooths one-off payments
  const avgIncome = recentFlows.length > 0
    ? recentFlows.reduce((sum, cf) => sum + computeCashFlow(cf).totalIncome, 0) / recentFlows.length
    : 0;

  const avgExpenses = recentFlows.length > 0
    ? recentFlows.reduce((sum, cf) => sum + computeCashFlow(cf).totalExpenses, 0) / recentFlows.length
    : 0;

  const avgSurplus = avgIncome - avgExpenses;

  const answers: Record<string, number | string> = {};

  // Only write values that are meaningfully non-zero — avoids pre-filling $0 (confusing)
  const set = (key: string, val: number) => {
    if (val > 0) answers[key] = Math.round(val);
  };

  if (journeyId === 'debt-freedom') {
    set('monthlyIncome', avgIncome);
    if (latest) {
      // Exclude mortgage — different user intent from a payoff journey
      const nonMortgage = latest.credit_cards + latest.student_loans + latest.car_loans + latest.other_liabilities;
      set('totalDebt', nonMortgage);
    }
    // Suggest 50% of surplus as payment — conservative so user consciously increases it
    if (avgSurplus > 0) set('monthlyPayment', avgSurplus * 0.5);
  }

  else if (journeyId === 'budget-clarity') {
    set('monthlyIncome', avgIncome);

    if (recentFlows.length > 0) {
      // Fixed expense items — categories that recur at a predictable amount
      const fixedCats: Array<{ name: string; key: keyof MonthlyCashFlow }> = [
        { name: 'Housing',       key: 'housing'       },
        { name: 'Subscriptions', key: 'subscriptions' },
        { name: 'Education',     key: 'education'     },
      ];
      const fixedItems = fixedCats
        .map(c => ({ id: `pf_${c.key}`, name: c.name, amount: Math.round(avgField(recentFlows, c.key)) }))
        .filter(i => i.amount > 0);

      if (fixedItems.length > 0) {
        answers['fixedExpenses']       = fixedItems.reduce((s, i) => s + i.amount, 0);
        answers['fixedExpenses_items'] = JSON.stringify(fixedItems);
      }

      // Variable expense items — categories that fluctuate month to month
      const varCats: Array<{ name: string; key: keyof MonthlyCashFlow }> = [
        { name: 'Food',          key: 'food'          },
        { name: 'Transport',     key: 'transport'     },
        { name: 'Healthcare',    key: 'healthcare'    },
        { name: 'Entertainment', key: 'entertainment' },
        { name: 'Clothing',      key: 'clothing'      },
        { name: 'Travel',        key: 'travel'        },
        { name: 'Other',         key: 'other_expenses'},
      ];
      const varItems = varCats
        .map(c => ({ id: `pf_${c.key}`, name: c.name, amount: Math.round(avgField(recentFlows, c.key)) }))
        .filter(i => i.amount > 0);

      if (varItems.length > 0) {
        answers['variableExpenses']       = varItems.reduce((s, i) => s + i.amount, 0);
        answers['variableExpenses_items'] = JSON.stringify(varItems);
      }
    }

    // 80% of current surplus as savings goal — leaves headroom for realism
    if (avgSurplus > 0) set('savingsGoal', avgSurplus * 0.8);
  }

  else if (journeyId === 'investor-starter') {
    // Savings account (not checking) is the investment-ready pool
    if (latest) set('currentSavings', latest.savings);
    // 50% of surplus — conservative; user sets their real comfort level
    if (avgSurplus > 0) set('monthlyContribution', avgSurplus * 0.5);
  }

  else if (journeyId === 'home-buying') {
    set('monthlyIncome', avgIncome);
    if (latest) {
      set('currentSavings', latest.savings);
      // 70% of surplus toward deposit — leaves buffer for living costs
      if (avgSurplus > 0) set('monthlySavings', avgSurplus * 0.7);
    }
  }

  else if (journeyId === 'business-owner') {
    const avgSide = avgField(recentFlows, 'side_income') + avgField(recentFlows, 'other_income');
    set('monthlyRevenue',  avgSide);
    set('monthlyExpenses', avgExpenses);
    if (latest) set('cashReserves', latest.checking + latest.savings);
  }

  return answers;
}
