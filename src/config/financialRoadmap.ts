import type { FinancialProfile } from '@/services/coachService';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  phase: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  order: number;
  title: string;
  shortTitle: string;
  description: string;
  why: string;                          // Ben Felix principle behind it
  typicalWeeks: [number, number];       // [min, max] at median US income
  coachPrompt: string;                  // pre-seeded question for "Ask Coach"
  completionCheck: (profile: FinancialProfile) => boolean;
  /**
   * Set when skipCondition reads a snapshot column. Those columns are unknown
   * until the user fills the snapshot in, and a skip inferred from an unknown
   * hides the milestone entirely — so the roadmap holds off until it has facts.
   * Conditions reading intake fields (age, dependents) leave this unset.
   */
  skipNeedsSnapshot?: boolean;
  skipCondition?: (profile: FinancialProfile) => boolean;
  requiresSnapshot: boolean;            // whether personalised timeline needs snapshot numbers
  isFork?: boolean;                     // milestone only appears for certain profiles
  forkCondition?: (profile: FinancialProfile) => boolean;
}

export interface PhaseDefinition {
  id: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  subtitle: string;
  colorClass: string;   // tailwind bg color for accent
  textClass: string;    // tailwind text color
}

// ── Phase definitions ─────────────────────────────────────────────────────────

export const PHASES: PhaseDefinition[] = [
  {
    id: 0,
    title: 'Stabilize',
    subtitle: 'Stop the bleeding before building',
    colorClass: 'bg-destructive',
    textClass: 'text-destructive',
  },
  {
    id: 1,
    title: 'Foundation',
    subtitle: 'The non-negotiable base layer',
    colorClass: 'bg-warning',
    textClass: 'text-warning',
  },
  {
    id: 2,
    title: 'Optimize',
    subtitle: 'Eliminate drag, maximise tax advantage',
    colorClass: 'bg-yellow-500',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    id: 3,
    title: 'Accelerate',
    subtitle: 'All surplus into compounding engines',
    colorClass: 'bg-accent',
    textClass: 'text-accent',
  },
  {
    id: 4,
    title: 'Build Wealth',
    subtitle: 'Optimise and diversify at scale',
    colorClass: 'bg-primary',
    textClass: 'text-primary',
  },
  {
    id: 5,
    title: 'Pre-Retirement',
    subtitle: 'Protect what you\'ve built',
    colorClass: 'bg-coach',
    textClass: 'text-coach',
  },
  {
    id: 6,
    title: 'Retirement',
    subtitle: 'Make it last and leave a legacy',
    colorClass: 'bg-muted-foreground',
    textClass: 'text-muted-foreground',
  },
];

// ── Milestones ────────────────────────────────────────────────────────────────

export const MILESTONES: Milestone[] = [

  // ── PHASE 0: Stabilize ────────────────────────────────────────────────────

  {
    id: 'p0-stop-debt',
    phase: 0,
    order: 1,
    title: 'Commit to no new high-interest debt',
    shortTitle: 'Stop new high-cost debt',
    description: 'Make a firm decision to stop adding to credit cards or high-interest loans. This is psychological — the first step is intent.',
    why: 'High-interest debt compounds against you at the same rate investments compound for you. Until you stop adding to it, everything else is a leaky bucket.',
    typicalWeeks: [0, 1],
    coachPrompt: 'Help me understand what\'s causing me to keep adding to my debt so we can stop it at the source.',
    completionCheck: () => false, // manual — user must acknowledge
    requiresSnapshot: false,
  },
  {
    id: 'p0-buffer',
    phase: 0,
    order: 2,
    title: 'Build a 1-month expense buffer',
    shortTitle: '1-month buffer',
    description: 'Keep at least one month of expenses in a savings account. This prevents debt from growing every time an irregular expense hits.',
    why: 'Without a buffer, every car repair or medical bill goes back onto the credit card. The cycle never breaks.',
    typicalWeeks: [4, 16],
    coachPrompt: 'Help me figure out how long it will take me to build a 1-month expense buffer given my current situation.',
    completionCheck: (p) => {
      if (p.liquid_savings != null && p.monthly_expenses != null && p.monthly_expenses > 0) {
        return p.liquid_savings >= p.monthly_expenses;
      }
      return false;
    },
    requiresSnapshot: true,
  },

  // ── PHASE 1: Foundation ───────────────────────────────────────────────────

  {
    id: 'p1-employer-match',
    phase: 1,
    order: 1,
    title: 'Capture your full employer 401k match',
    shortTitle: 'Full employer match',
    description: 'Contribute exactly enough to your 401k to capture 100% of your employer\'s match — not a dollar more for now.',
    why: 'An employer match is a 50–100% instant return on investment. Nothing in finance competes with it. Skipping it is leaving guaranteed money on the table.',
    typicalWeeks: [1, 2],
    coachPrompt: 'Walk me through exactly how to set up my 401k contribution to capture my full employer match.',
    completionCheck: () => false, // manual — we can't verify contribution rate from profile data alone
    skipCondition: (p) => p.employer_match_pct === 0 || p.employment_type === 'self-employed',
    skipNeedsSnapshot: true,
    requiresSnapshot: false,
  },
  {
    id: 'p1-kill-highcost-debt',
    phase: 1,
    order: 2,
    title: 'Eliminate all debt above 20% APR',
    shortTitle: 'Kill >20% debt',
    description: 'Attack credit cards and payday loans aggressively using the avalanche method (highest rate first).',
    why: 'No investment reliably returns 20%+. Every dollar held at 20% APR is a guaranteed 20% loss compounding against you.',
    typicalWeeks: [8, 52],
    coachPrompt: 'Help me build a payoff plan for my high-interest debt using the avalanche method.',
    completionCheck: (p) => p.high_interest_debt === 0,
    requiresSnapshot: true,
  },
  {
    id: 'p1-emergency-3mo',
    phase: 1,
    order: 3,
    title: 'Build a 3-month emergency fund',
    shortTitle: '3-month emergency fund',
    description: 'Save 3 months of total expenses in a high-yield savings account (HYSA). Keep it boring and liquid.',
    why: 'An emergency fund is not an investment — it\'s insurance against liquidating investments at the worst possible time. The psychological cost of investing without one is enormous.',
    typicalWeeks: [12, 36],
    coachPrompt: 'Help me calculate exactly how much I need for a 3-month emergency fund and the fastest realistic path to get there.',
    completionCheck: (p) => {
      // Only auto-complete when we have snapshot numbers — has_emergency_fund alone doesn't
      // tell us whether savings covers 3 months, so we don't fall back to it
      if (p.liquid_savings != null && p.monthly_expenses != null && p.monthly_expenses > 0) {
        return p.liquid_savings >= p.monthly_expenses * 3;
      }
      return false;
    },
    requiresSnapshot: true,
  },
  {
    id: 'p1-insurance',
    phase: 1,
    order: 4,
    title: 'Secure term life and disability insurance',
    shortTitle: 'Term life + disability',
    description: 'If anyone depends on your income, get 10–12× annual income in term life insurance. Disability insurance protects your most valuable asset — your ability to earn.',
    why: 'Your human capital (future earning potential) is your largest asset when you\'re young. Losing it without insurance can undo decades of financial progress overnight.',
    typicalWeeks: [2, 6],
    coachPrompt: 'Help me figure out how much term life and disability insurance I actually need.',
    completionCheck: () => false, // manual
    skipCondition: (p) => p.dependents === 0 && p.marital_status === 'single',
    requiresSnapshot: false,
  },

  // ── PHASE 2: Optimize ─────────────────────────────────────────────────────

  {
    id: 'p2-midcost-debt',
    phase: 2,
    order: 1,
    title: 'Pay off 8–20% interest debt',
    shortTitle: 'Clear 8–20% debt',
    description: 'Student loans, personal loans, and store cards in this range — attack them in rate order.',
    why: 'Paying off 10% debt is a guaranteed 10% return. The S&P 500 returns ~7% after inflation. Debt payoff wins until you\'re below the expected market return.',
    typicalWeeks: [12, 104],
    coachPrompt: 'Help me decide whether to pay off my remaining debt or invest, and build a plan either way.',
    // Manual: the snapshot has no 8–20% bucket. This previously reused
    // `high_interest_debt === 0` — the >20% predicate — so paying off credit
    // cards silently marked student loans cleared. Add a mid_interest_debt
    // column and an intake field to make this checkable.
    completionCheck: () => false,
    requiresSnapshot: true,
  },
  {
    id: 'p2-hsa',
    phase: 2,
    order: 2,
    title: 'Max your HSA contribution',
    shortTitle: 'Max HSA',
    description: 'If you have a high-deductible health plan, max your HSA ($4,300 individual / $8,550 family in 2025). Invest the balance in index funds — don\'t keep it as cash.',
    why: 'The HSA has a triple tax advantage: contributions are pre-tax, growth is tax-free, withdrawals for medical expenses are tax-free. No other account in the US tax code offers this.',
    typicalWeeks: [4, 12],
    coachPrompt: 'Help me understand how to set up and invest my HSA for maximum long-term benefit.',
    completionCheck: () => false, // manual
    // Explicit false only. `!p.has_hsa_access` also skipped on null, hiding the
    // milestone from everyone who simply hasn't answered yet.
    skipCondition: (p) => p.has_hsa_access === false,
    requiresSnapshot: false,
  },
  {
    id: 'p2-ira',
    phase: 2,
    order: 3,
    title: 'Max your IRA contribution',
    shortTitle: 'Max IRA ($7,000)',
    description: 'Contribute the annual maximum to a Roth IRA if your income allows ($161k single / $240k married in 2025), or a Traditional IRA if it doesn\'t. High earners: use the backdoor Roth strategy.',
    why: 'Tax-advantaged accounts compound without drag. An extra 0.3–0.5% annual tax drag on a 30-year investment cuts your final balance by 8–14%. The IRA eliminates this.',
    typicalWeeks: [4, 26],
    coachPrompt: 'Help me decide between a Roth IRA, Traditional IRA, or backdoor Roth based on my income and tax situation.',
    completionCheck: () => false, // manual
    requiresSnapshot: false,
  },
  {
    id: 'p2-emergency-6mo',
    phase: 2,
    order: 4,
    title: 'Extend emergency fund to 6 months',
    shortTitle: '6-month emergency fund',
    description: 'Grow your HYSA to cover 6 full months of expenses. Self-employed or single-income households should target 9–12 months.',
    why: 'With a 6-month buffer, you can weather a job loss or major life disruption without touching investments — keeping the compounding engine intact.',
    typicalWeeks: [12, 36],
    coachPrompt: 'Help me calculate how long it will take to extend my emergency fund to 6 months at my current savings rate.',
    completionCheck: (p) => {
      // `monthly_expenses > 0` matters: at 0 the test becomes `savings >= 0`,
      // which completes a 6-month emergency fund for someone with no savings.
      if (p.liquid_savings != null && p.monthly_expenses != null && p.monthly_expenses > 0) {
        const target = p.employment_type === 'self-employed' ? 9 : 6;
        return p.liquid_savings >= p.monthly_expenses * target;
      }
      return false;
    },
    requiresSnapshot: true,
  },
  {
    id: 'p2-will',
    phase: 2,
    order: 5,
    title: 'Create a basic will and assign beneficiaries',
    shortTitle: 'Will + beneficiaries',
    description: 'Draft a will, assign beneficiaries on all accounts, and designate a healthcare proxy. This takes one afternoon and protects everything you\'ve built.',
    why: 'Dying without a will (intestate) hands control of your assets to the state. Beneficiary designations override a will — many people have ex-spouses still listed on retirement accounts.',
    typicalWeeks: [1, 3],
    coachPrompt: 'Walk me through the essentials of a basic will and what beneficiary assignments I need to update.',
    completionCheck: () => false, // manual
    requiresSnapshot: false,
  },

  // ── PHASE 3: Accelerate ───────────────────────────────────────────────────

  {
    id: 'p3-401k-max',
    phase: 3,
    order: 1,
    title: 'Max your 401k / 403b contribution',
    shortTitle: 'Max 401k ($23,000)',
    description: 'Raise your 401k contribution to the annual IRS limit ($23,000 in 2025, $30,500 if age 50+). Every dollar here reduces your taxable income today and grows tax-deferred.',
    why: 'Tax-advantaged space is use-it-or-lose-it — you can\'t go back and contribute for years you missed. Maxing your 401k also reduces your AGI, potentially unlocking other tax benefits.',
    typicalWeeks: [4, 24],
    coachPrompt: 'Help me figure out how to max my 401k without cutting my take-home pay too drastically.',
    completionCheck: () => false, // manual
    requiresSnapshot: false,
  },
  {
    id: 'p3-lowcost-debt',
    phase: 3,
    order: 2,
    title: 'Decide on 4–8% debt: pay off or invest',
    shortTitle: '4–8% debt decision',
    description: 'For debt in the 4–8% range (mortgages, federal student loans), the math is genuinely close to a coin flip. Your risk tolerance and psychology should decide.',
    why: 'At 4–8% the guaranteed return of debt payoff nearly matches expected equity returns (~7%). Neither choice is wrong — consistency matters more than optimisation here.',
    typicalWeeks: [4, 8],
    coachPrompt: 'Help me run the math on whether I should pay off my remaining debt or invest the difference.',
    completionCheck: () => false, // manual
    skipCondition: (p) => p.low_interest_debt === 0,
    skipNeedsSnapshot: true,
    requiresSnapshot: true,
  },
  {
    id: 'p3-goal-savings',
    phase: 3,
    order: 3,
    title: 'Save for your primary financial goal',
    shortTitle: 'Goal savings (home / education)',
    description: 'If you\'re buying a home, target a 20% down payment to avoid PMI. If funding education, open a 529. Both goals have specific vehicles that matter.',
    why: 'Buying a home with less than 20% down adds PMI (~0.5–1% annually on the loan) — a pure cost with no asset-building value. Using the right account type (529) adds tax-free growth for education.',
    typicalWeeks: [24, 156],
    coachPrompt: 'Help me build a savings plan for my down payment / education goal with a realistic timeline.',
    completionCheck: () => false, // manual
    forkCondition: (p) => p.primary_concern === 'buying-home' || (p.dependents != null && p.dependents > 0),
    isFork: true,
    requiresSnapshot: true,
  },
  {
    id: 'p3-taxable',
    phase: 3,
    order: 4,
    title: 'Open a taxable brokerage and invest in index funds',
    shortTitle: 'Taxable brokerage',
    description: 'After maxing tax-advantaged accounts, open a taxable brokerage at Fidelity, Schwab, or Vanguard. Invest in total market index funds (VTI, FSKAX, or equivalent).',
    why: 'Once you\'ve exhausted tax-advantaged space, taxable accounts are the next best vehicle. Low-cost index funds minimise taxable events through low turnover.',
    typicalWeeks: [1, 2],
    coachPrompt: 'Help me choose between Fidelity, Schwab, and Vanguard and pick the right index funds for a taxable account.',
    completionCheck: () => false, // manual
    requiresSnapshot: false,
  },
  {
    id: 'p3-portfolio-audit',
    phase: 3,
    order: 5,
    title: 'Audit your portfolio: index fund % check',
    shortTitle: 'Portfolio composition audit',
    description: 'Review every account. Flag anything that isn\'t a diversified index fund. Individual stocks should be <5% of your total portfolio if you hold them at all.',
    why: 'Research consistently shows that individual stock picking underperforms the index after costs and taxes. People who know just enough (index funds work) outperform those who know enough to hurt themselves.',
    typicalWeeks: [1, 2],
    coachPrompt: 'Review my current portfolio with me and tell me if my allocation is aligned with index fund principles.',
    completionCheck: () => false, // manual
    requiresSnapshot: false,
  },

  // ── PHASE 4: Build Wealth ─────────────────────────────────────────────────

  {
    id: 'p4-debt-clear',
    phase: 4,
    order: 1,
    title: 'Clear remaining <4% debt (optional)',
    shortTitle: 'Clear <4% debt',
    description: 'Paying off sub-4% debt (e.g. some mortgages, older federal student loans) is mathematically optional — the market likely beats it. But the psychological freedom of debt-free living has real value.',
    why: 'At sub-4%, expected equity returns clearly beat guaranteed debt payoff. This is a pure psychology call — both choices are defensible. The important thing is making it consciously.',
    typicalWeeks: [26, 260],
    coachPrompt: 'Help me decide whether to aggressively pay off my remaining low-interest debt or let it ride while investing.',
    completionCheck: (p) => p.low_interest_debt === 0,
    skipCondition: (p) => p.low_interest_debt === 0,
    skipNeedsSnapshot: true,
    requiresSnapshot: true,
  },
  {
    id: 'p4-asset-location',
    phase: 4,
    order: 2,
    title: 'Optimise asset location across accounts',
    shortTitle: 'Asset location',
    description: 'Place bonds and REITs in tax-deferred accounts (401k, IRA). Hold equities in taxable accounts. This structural tax efficiency adds meaningful long-run returns.',
    why: 'Asset location is tax-loss harvesting\'s quieter cousin. Placing high-yield assets in tax-sheltered accounts prevents annual tax drag without requiring any trades.',
    typicalWeeks: [1, 4],
    coachPrompt: 'Walk me through how to optimise where I hold different asset types across my accounts.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },
  {
    id: 'p4-cost-conservatism',
    phase: 4,
    order: 3,
    title: 'Review allocation for cost of conservatism',
    shortTitle: 'Cost of conservatism check',
    description: 'Run a cost-of-conservatism audit: if you\'re more than 20% in cash/bonds relative to your age-appropriate target, calculate the annual drag and decide consciously.',
    why: 'Being too conservative is itself a financial risk. 7% (stocks) – 2% (cash) = 5% per year foregone, compounded. A portfolio that\'s 40% cash at age 35 loses ~$1M+ over 30 years vs. the index.',
    typicalWeeks: [1, 2],
    coachPrompt: 'Run the cost-of-conservatism analysis on my current allocation.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },
  {
    id: 'p4-tax-harvest',
    phase: 4,
    order: 4,
    title: 'Set up tax-loss harvesting',
    shortTitle: 'Tax-loss harvesting',
    description: 'Review your taxable account each December for positions at a loss. Sell them to realise the loss (reducing your tax bill), then immediately buy a similar-but-not-identical fund.',
    why: 'Tax-loss harvesting is a free return — you capture the loss today while maintaining your market exposure. It\'s one of the few reliable alpha sources available to retail investors.',
    typicalWeeks: [1, 2],
    coachPrompt: 'Walk me through how tax-loss harvesting works and whether I have positions where I should use it.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },

  // ── PHASE 5: Pre-Retirement ───────────────────────────────────────────────

  {
    id: 'p5-retire-date',
    phase: 5,
    order: 1,
    title: 'Lock in your target retirement age',
    shortTitle: 'Target retirement age',
    description: 'Commit to a target retirement age and calculate your number: how much you need saved (25× annual spending, per the 4% rule). This anchors all subsequent planning.',
    why: 'The 4% rule gives you a tangible number to work towards. Without a target, you\'re optimising for nothing. With one, every financial decision has a measurable impact.',
    typicalWeeks: [1, 4],
    coachPrompt: 'Help me calculate my retirement number and what age I can realistically retire at my current savings rate.',
    completionCheck: () => false,
    requiresSnapshot: true,
  },
  {
    id: 'p5-sequence-risk',
    phase: 5,
    order: 2,
    title: 'Reduce sequence-of-returns risk',
    shortTitle: 'Sequence risk management',
    description: 'Gradually shift your allocation toward more bonds and cash 5–10 years before retirement. A major crash in your first retirement year can permanently derail a plan.',
    why: 'Sequence of returns risk is the biggest threat in early retirement. If the market drops 40% in year 1 and you\'re withdrawing 4%, you may need to withdraw 6–7% of the remaining portfolio. The math can spiral.',
    typicalWeeks: [1, 4],
    coachPrompt: 'Help me design a glide path to gradually reduce my sequence-of-returns risk as I approach retirement.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },
  {
    id: 'p5-healthcare',
    phase: 5,
    order: 3,
    title: 'Plan your pre-Medicare healthcare bridge',
    shortTitle: 'Healthcare bridge plan',
    description: 'If you retire before 65, you need a plan to cover healthcare for the gap years. Options: COBRA (expensive), ACA marketplace (income-dependent subsidies), spouse\'s plan.',
    why: 'Healthcare is the #1 unexpected cost that derails early retirement. It averages $800–$1,200/mo per person on the ACA market without subsidies. This needs to be in your number.',
    typicalWeeks: [2, 8],
    coachPrompt: 'Walk me through my healthcare options if I retire before Medicare age at 65.',
    completionCheck: () => false,
    skipCondition: (p) => !!(p.age && p.age >= 65),
    requiresSnapshot: false,
  },
  {
    id: 'p5-social-security',
    phase: 5,
    order: 4,
    title: 'Optimise your Social Security claiming strategy',
    shortTitle: 'Social Security timing',
    description: 'Delaying Social Security from 62 → 70 increases your monthly benefit by ~77%. If you\'re in good health, delaying is almost always the better mathematical choice.',
    why: 'Social Security is longevity insurance — it pays the most when you need it most (old age). Claiming early trades a higher payout for a smaller one. Unless you have poor health or no other income, delay.',
    typicalWeeks: [2, 4],
    coachPrompt: 'Help me model the difference in lifetime Social Security benefits between claiming early vs. delaying to 70.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },
  {
    id: 'p5-withdrawal-plan',
    phase: 5,
    order: 5,
    title: 'Design your withdrawal strategy',
    shortTitle: 'Withdrawal strategy',
    description: 'Map out the order you\'ll draw from accounts: taxable first (to let tax-advantaged grow), then traditional IRA/401k, then Roth last. Consider Roth conversions in low-income years.',
    why: 'The order you pull money from accounts in retirement can be worth hundreds of thousands of dollars over a 30-year drawdown. This is one of the highest-leverage optimisations in retirement planning.',
    typicalWeeks: [2, 8],
    coachPrompt: 'Walk me through how to design the optimal withdrawal sequence across my taxable, traditional, and Roth accounts.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },

  // ── PHASE 6: Retirement ───────────────────────────────────────────────────

  {
    id: 'p6-withdrawal-execute',
    phase: 6,
    order: 1,
    title: 'Execute your withdrawal strategy',
    shortTitle: 'Execute withdrawals',
    description: 'Put the plan into action: set up systematic withdrawals from accounts in the correct order, monitor spending vs. the 4% rule, and adjust annually.',
    why: 'A plan not executed is not a plan. Annual reviews ensure your withdrawal rate stays sustainable as markets fluctuate.',
    typicalWeeks: [1, 4],
    coachPrompt: 'Help me set up my retirement withdrawal plan and annual review process.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },
  {
    id: 'p6-rmd',
    phase: 6,
    order: 2,
    title: 'Plan for Required Minimum Distributions',
    shortTitle: 'RMD planning',
    description: 'At age 73 (per SECURE Act 2.0), you must begin withdrawing from traditional IRAs and 401ks. Failure to take RMDs results in a 25% penalty on the missed amount.',
    why: 'RMDs can push you into higher tax brackets unexpectedly if not planned for. Strategic Roth conversions earlier reduce your RMD burden significantly.',
    typicalWeeks: [2, 6],
    coachPrompt: 'Help me understand how RMDs will affect my tax situation and whether Roth conversions make sense before 73.',
    completionCheck: () => false,
    skipCondition: (p) => !!(p.age && p.age < 65),
    requiresSnapshot: false,
  },
  {
    id: 'p6-estate',
    phase: 6,
    order: 3,
    title: 'Complete your estate plan and legacy giving',
    shortTitle: 'Estate plan',
    description: 'Update or create a full estate plan: will, trust (if assets warrant), healthcare directives, power of attorney. Review all beneficiary designations. Define charitable giving.',
    why: 'Estate planning is a final act of financial care for the people you love. Without it, assets can be tied up in probate for years and tax burdens can be passed unnecessarily to heirs.',
    typicalWeeks: [4, 12],
    coachPrompt: 'Walk me through what a complete estate plan looks like for my situation and what I need to put in place.',
    completionCheck: () => false,
    requiresSnapshot: false,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getMilestonesByPhase(phase: number): Milestone[] {
  return MILESTONES
    .filter((m) => m.phase === phase)
    .sort((a, b) => a.order - b.order);
}

export function getMilestoneById(id: string): Milestone | undefined {
  return MILESTONES.find((m) => m.id === id);
}
