/**
 * Deterministic financial insight engine.
 * Computes specific, numbered observations from net worth + cash flow + transaction data.
 * No AI call — instant, free, always consistent.
 */

import { NetWorthSnapshot, MonthlyCashFlow, computeNetWorth, computeCashFlow } from '@/hooks/usePersonalFinance';
import { PlaidTransaction } from '@/hooks/useTransactions';
import {
  detectRecurringCharges,
  totalRecurringPerMonth,
  opportunityCost,
} from '@/lib/recurringCharges';

export type InsightSeverity = 'positive' | 'warning' | 'info';

export interface FinancialInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  coachPrompt: string;
}

const $n = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const pct = (n: number) => `${n.toFixed(1)}%`;

export function computeInsights(
  snapshots: NetWorthSnapshot[],
  cashFlows: MonthlyCashFlow[],
  /** Last 90 days of Plaid transactions — optional; enables subscription + merchant insights */
  allTransactions?: PlaidTransaction[]
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];

  const latestSnap  = snapshots[snapshots.length - 1];
  const prevSnap    = snapshots[snapshots.length - 2];
  const latestFlow  = cashFlows[cashFlows.length - 1];
  const prevFlow    = cashFlows[cashFlows.length - 2];

  if (!latestSnap && !latestFlow) return insights;

  // ── Net worth momentum ────────────────────────────────────────────────────
  if (latestSnap && prevSnap) {
    const { netWorth: curNw } = computeNetWorth(latestSnap);
    const { netWorth: prevNw } = computeNetWorth(prevSnap);
    const change = curNw - prevNw;
    const changePct = prevNw !== 0 ? (change / Math.abs(prevNw)) * 100 : 0;

    if (change > 0) {
      insights.push({
        id: 'nw-growing',
        severity: 'positive',
        title: `Net worth up ${$n(change)} this month`,
        detail: `${pct(Math.abs(changePct))} month-over-month increase. You're building momentum.`,
        coachPrompt: `My net worth grew ${$n(change)} last month. How should I be deploying this growth to accelerate further?`,
      });
    } else if (change < 0) {
      insights.push({
        id: 'nw-declining',
        severity: 'warning',
        title: `Net worth down ${$n(Math.abs(change))} this month`,
        detail: `${pct(Math.abs(changePct))} decline. Let's understand what's driving this.`,
        coachPrompt: `My net worth declined ${$n(Math.abs(change))} last month. What's likely causing this and how do I reverse it?`,
      });
    }
  }

  // ── Savings rate ──────────────────────────────────────────────────────────
  if (latestFlow) {
    const { savingsRate, surplus, totalIncome } = computeCashFlow(latestFlow);

    if (savingsRate >= 20) {
      insights.push({
        id: 'savings-rate-good',
        severity: 'positive',
        title: `Savings rate ${pct(savingsRate)} — above target`,
        detail: `You're saving ${$n(surplus)}/mo. At this rate you add ${$n(surplus * 12)}/year to your wealth.`,
        coachPrompt: `My savings rate is ${pct(savingsRate)}. How should I be allocating this surplus between investments, debt payoff, and emergency fund?`,
      });
    } else if (savingsRate > 0 && savingsRate < 20) {
      const gap = totalIncome * 0.20 - surplus;
      insights.push({
        id: 'savings-rate-low',
        severity: 'warning',
        title: `Savings rate ${pct(savingsRate)} — below 20% target`,
        detail: `You're ${$n(gap)}/mo away from the 20% target. That's ${$n(gap * 12)}/year in compounding power you're leaving behind.`,
        coachPrompt: `My savings rate is ${pct(savingsRate)}, which is below the 20% target. I need to find ${$n(gap)} more per month — what should I cut or earn more of?`,
      });
    } else if (savingsRate <= 0) {
      insights.push({
        id: 'savings-rate-deficit',
        severity: 'warning',
        title: 'Spending more than you earn this month',
        detail: `Monthly deficit of ${$n(Math.abs(surplus))}. This is eroding your net worth and emergency fund.`,
        coachPrompt: `I'm running a monthly deficit of ${$n(Math.abs(surplus))}. Help me identify what's driving this and build a plan to break even.`,
      });
    }

    // Savings rate trend
    if (prevFlow) {
      const { savingsRate: prevRate } = computeCashFlow(prevFlow);
      const delta = savingsRate - prevRate;
      if (delta < -5) {
        insights.push({
          id: 'savings-rate-declining',
          severity: 'warning',
          title: `Savings rate dropped ${pct(Math.abs(delta))} from last month`,
          detail: `Down from ${pct(prevRate)} to ${pct(savingsRate)}. Something changed — let's find it.`,
          coachPrompt: `My savings rate dropped from ${pct(prevRate)} to ${pct(savingsRate)} last month. Help me figure out what changed and how to correct it.`,
        });
      }
    }
  }

  // ── Cash runway ───────────────────────────────────────────────────────────
  if (latestSnap && latestFlow) {
    const { totalExpenses } = computeCashFlow(latestFlow);
    const liquid = latestSnap.checking + latestSnap.savings;
    if (totalExpenses > 0) {
      const runway = liquid / totalExpenses;
      if (runway < 3) {
        insights.push({
          id: 'runway-critical',
          severity: 'warning',
          title: `Only ${runway.toFixed(1)} months of cash runway`,
          detail: `${$n(liquid)} liquid vs ${$n(totalExpenses)}/mo expenses. Below the 3-month minimum — one emergency could force debt.`,
          coachPrompt: `I only have ${runway.toFixed(1)} months of emergency fund (${$n(liquid)}). What's the fastest realistic path to 3 months, and should I pause investing to get there?`,
        });
      } else if (runway < 6) {
        insights.push({
          id: 'runway-building',
          severity: 'info',
          title: `${runway.toFixed(1)} months runway — building toward 6`,
          detail: `${$n(liquid)} covers ${runway.toFixed(1)} months. You need ${$n((6 - runway) * totalExpenses)} more to hit the 6-month target.`,
          coachPrompt: `I have ${runway.toFixed(1)} months emergency fund. Should I prioritize building to 6 months or is it better to start investing now?`,
        });
      }
    }
  }

  // ── High-interest debt ────────────────────────────────────────────────────
  if (latestSnap?.credit_cards > 0) {
    const cc = latestSnap.credit_cards;
    const increasing = prevSnap && cc > prevSnap.credit_cards;
    insights.push({
      id: 'cc-debt',
      severity: increasing ? 'warning' : 'info',
      title: `${$n(cc)} in credit card debt${increasing ? ' — and increasing' : ''}`,
      detail: increasing
        ? `Balance grew ${$n(cc - (prevSnap?.credit_cards ?? cc))} last month. At 20%+ APR this compounds against you faster than any investment compounds for you.`
        : `At a typical 20% APR this costs ~${$n(cc * 0.20 / 12)}/month in interest. Paying this down is a guaranteed 20% return.`,
      coachPrompt: `I have ${$n(cc)} in credit card debt${increasing ? ' and it\'s growing' : ''}. Help me build an aggressive payoff plan using the avalanche method.`,
    });
  }

  // ── Housing % of income ───────────────────────────────────────────────────
  if (latestFlow) {
    const { totalIncome } = computeCashFlow(latestFlow);
    const housingPct = totalIncome > 0 ? (latestFlow.housing / totalIncome) * 100 : 0;
    if (housingPct > 35) {
      insights.push({
        id: 'housing-high',
        severity: 'warning',
        title: `Housing is ${pct(housingPct)} of your income`,
        detail: `${$n(latestFlow.housing)}/mo on housing vs ${$n(totalIncome)}/mo income. The healthy ceiling is 30%. Every % above that is compounding capacity lost.`,
        coachPrompt: `My housing costs ${pct(housingPct)} of my income (${$n(latestFlow.housing)}/mo). The rule of thumb is 30%. What are my realistic options to improve this ratio?`,
      });
    }
  }

  // ── Month-over-month expense spikes ───────────────────────────────────────
  if (latestFlow && prevFlow) {
    type CfKey = keyof typeof latestFlow;
    const cats: [CfKey, string][] = [
      ['food', 'Food'], ['entertainment', 'Entertainment'],
      ['travel', 'Travel'], ['subscriptions', 'Subscriptions'],
      ['transport', 'Transport'],
    ];
    for (const [key, label] of cats) {
      const cur = latestFlow[key] as number;
      const prev = prevFlow[key] as number;
      if (prev > 50 && cur > prev * 1.30) {
        const increase = cur - prev;
        const increasePct = ((cur - prev) / prev) * 100;
        insights.push({
          id: `spike-${key}`,
          severity: 'info',
          title: `${label} spending up ${pct(increasePct)} this month`,
          detail: `${$n(cur)} vs ${$n(prev)} last month — ${$n(increase)} more. That's ${$n(increase * 12)} annualised.`,
          coachPrompt: `My ${label.toLowerCase()} spending jumped from ${$n(prev)} to ${$n(cur)} last month. Is this a problem, and if so what's a realistic target?`,
        });
        break; // surface at most one spike insight to avoid noise
      }
    }
  }

  // ── Investment momentum ───────────────────────────────────────────────────
  if (latestSnap && latestSnap.investments > 0) {
    const { netWorth } = computeNetWorth(latestSnap);
    const investmentShare = netWorth > 0 ? (latestSnap.investments / netWorth) * 100 : 0;
    if (investmentShare < 30 && latestSnap.investments > 0) {
      insights.push({
        id: 'invest-low-share',
        severity: 'info',
        title: `Investments are ${pct(investmentShare)} of net worth`,
        detail: `${$n(latestSnap.investments)} invested. Low-cost index funds should typically make up 50–70%+ of long-term net worth. The rest is either cash (holding cost) or real estate.`,
        coachPrompt: `My investments are only ${pct(investmentShare)} of my net worth. How do I think about the right allocation between cash, investments, and debt paydown at my stage?`,
      });
    }
  }

  // ── Transaction-level insights (requires Plaid data) ─────────────────────
  if (allTransactions && allTransactions.length > 0) {
    const recurring = detectRecurringCharges(allTransactions);
    const activeRecurring = recurring.filter(c => !c.possiblyCancelled);
    const recurringTotal  = totalRecurringPerMonth(recurring);

    // Subscription list — surfaces named recurring charges
    if (activeRecurring.length > 0) {
      const top3 = activeRecurring.slice(0, 3).map(c => `${c.merchant} ${$n(c.amount)}`).join(', ');
      const oc10yr = opportunityCost(recurringTotal, 10);
      insights.push({
        id: 'subscription-list',
        severity: recurringTotal > 200 ? 'warning' : 'info',
        title: `${activeRecurring.length} recurring charges — ${$n(recurringTotal)}/mo`,
        detail: `Top charges: ${top3}${activeRecurring.length > 3 ? ` +${activeRecurring.length - 3} more` : ''}. At 7% growth that's ${$n(oc10yr)} in 10 years.`,
        coachPrompt: `I have ${activeRecurring.length} recurring charges totalling ${$n(recurringTotal)}/mo: ${activeRecurring.map(c => `${c.merchant} ${$n(c.amount)}`).join(', ')}. Help me audit which ones are worth keeping and which I should cut.`,
      });
    }

    // Subscription creep — growing month over month in the category total
    if (latestFlow && prevFlow) {
      const subGrowth = latestFlow.subscriptions - prevFlow.subscriptions;
      const subGrowthPct = prevFlow.subscriptions > 0
        ? (subGrowth / prevFlow.subscriptions) * 100 : 0;
      if (subGrowthPct > 20 && subGrowth > 20) {
        insights.push({
          id: 'subscription-creep',
          severity: 'warning',
          title: `Subscription spend grew ${pct(subGrowthPct)} last month`,
          detail: `Up from ${$n(prevFlow.subscriptions)} to ${$n(latestFlow.subscriptions)} — that's ${$n(subGrowth * 12)} more per year quietly compounding against you.`,
          coachPrompt: `My subscription spending grew from ${$n(prevFlow.subscriptions)} to ${$n(latestFlow.subscriptions)} last month. Which recurring charges should I cut first?`,
        });
      }
    }

    // Discretionary opportunity cost
    if (latestFlow) {
      const { totalIncome } = computeCashFlow(latestFlow);
      const discretionary = latestFlow.entertainment + latestFlow.subscriptions +
        latestFlow.travel + latestFlow.clothing;
      const discretionaryPct = totalIncome > 0 ? (discretionary / totalIncome) * 100 : 0;
      if (discretionaryPct > 25 && discretionary > 300) {
        const oc10yr = opportunityCost(discretionary * 0.20, 10); // if they cut 20%
        insights.push({
          id: 'discretionary-oc',
          severity: 'info',
          title: `Discretionary is ${pct(discretionaryPct)} of income`,
          detail: `Entertainment, subscriptions, travel, and clothing total ${$n(discretionary)}/mo. Redirecting 20% (${$n(discretionary * 0.20)}/mo) to index funds would be worth ${$n(oc10yr)} in 10 years.`,
          coachPrompt: `My discretionary spending (entertainment, subscriptions, travel, clothing) is ${$n(discretionary)}/mo — ${pct(discretionaryPct)} of income. Help me find the cuts with the least impact on my quality of life.`,
        });
      }
    }

    // Top merchant insight — the single biggest non-recurring spender this month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonthDebits = allTransactions.filter(
      tx => !tx.pending && tx.amount > 0 && tx.date.startsWith(currentMonth)
    );
    if (thisMonthDebits.length > 0) {
      const merchantTotals = new Map<string, number>();
      for (const tx of thisMonthDebits) {
        const key = tx.merchant_name ?? tx.name;
        merchantTotals.set(key, (merchantTotals.get(key) ?? 0) + tx.amount);
      }
      const top5 = [...merchantTotals.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      if (top5.length >= 3) {
        const list = top5.map(([m, v]) => `${m} ${$n(v)}`).join(', ');
        insights.push({
          id: 'top-merchants',
          severity: 'info',
          title: `Top ${top5.length} merchants this month`,
          detail: list,
          coachPrompt: `My top merchants this month are: ${list}. What does this spending pattern tell you and what would you change?`,
        });
      }
    }

    // Possibly-cancelled subscriptions — still worth reviewing
    const maybeCancelled = recurring.filter(c => c.possiblyCancelled);
    if (maybeCancelled.length > 0) {
      const total = maybeCancelled.reduce((s, c) => s + c.amount, 0);
      const names = maybeCancelled.slice(0, 3).map(c => c.merchant).join(', ');
      insights.push({
        id: 'possibly-cancelled',
        severity: 'info',
        title: `${maybeCancelled.length} charge${maybeCancelled.length > 1 ? 's' : ''} not seen this month`,
        detail: `${names}${maybeCancelled.length > 3 ? ` +${maybeCancelled.length - 3} more` : ''} — ${$n(total)}/mo historically. Cancelled or just delayed?`,
        coachPrompt: `These recurring charges haven't appeared this month: ${maybeCancelled.map(c => c.merchant).join(', ')}. Were these intentionally cancelled? Should I redirect the ${$n(total)}/mo they freed up?`,
      });
    }
  }

  // Return the 6 most impactful insights (warnings first, then positives, then info)
  return insights
    .sort((a, b) => {
      const order: Record<InsightSeverity, number> = { warning: 0, positive: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 6);
}
