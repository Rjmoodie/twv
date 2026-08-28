export type JourneyId =
  | 'debt-freedom'
  | 'budget-clarity'
  | 'investor-starter'
  | 'home-buying'
  | 'business-owner';

export interface IntakeQuestion {
  id: string;
  label: string;
  type: 'currency' | 'percent' | 'number' | 'select' | 'itemized';
  placeholder?: string;
  options?: { value: string; label: string }[];
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  what: string;
  why: string;
  how: string;
  /** For type 'itemized' — placeholder text for the item name input */
  itemPlaceholder?: string;
}

export interface JourneyDef {
  id: JourneyId;
  title: string;
  tagline: string;
  audience: string;
  promise: string;
  iconName: string;
  colorBg: string;
  colorIcon: string;
  colorAccent: string;
  questions: IntakeQuestion[];
}

export const JOURNEYS: JourneyDef[] = [
  {
    id: 'debt-freedom',
    title: 'Debt Freedom',
    tagline: 'See your payoff date',
    audience: 'You have debt you want gone',
    promise: 'Get an exact payoff date and a step-by-step plan to eliminate your debt faster.',
    iconName: 'credit-card',
    colorBg: 'bg-red-500/10',
    colorIcon: 'text-red-500',
    colorAccent: 'border-red-500/30',
    questions: [
      {
        id: 'totalDebt',
        label: 'Total debt balance',
        type: 'currency',
        placeholder: 'e.g. 15,000',
        prefix: '$',
        min: 0,
        what: 'The combined outstanding balance across all your debts — credit cards, personal loans, car finance, etc.',
        why: 'This is the number we need to calculate your payoff timeline. Even an estimate within 20% gives us a useful plan.',
        how: 'Add up balances from all your debt accounts. Check your latest statements or log into your banking app.',
      },
      {
        id: 'currentMinimumPayment',
        label: 'Current required minimums',
        type: 'currency',
        placeholder: 'e.g. 275',
        prefix: '$',
        min: 0,
        what: 'The minimum payments already required across these debts each month.',
        why: 'This separates an existing bill from the additional payoff commitment competing for your current surplus.',
        how: 'Add the minimum payment shown on each debt statement. Enter zero only if no minimum is currently due.',
      },
      {
        id: 'monthlyPayment',
        label: 'Total monthly payment you plan to make',
        type: 'currency',
        placeholder: 'e.g. 500',
        prefix: '$',
        min: 0,
        what: 'How much you can realistically put toward debt each month — your current minimum plus any extra.',
        why: 'Even small increases dramatically cut payoff time. Capacity checks use only the amount above your current required minimums.',
        how: 'Start with your current minimum payments, then add any amount you could free up from discretionary spending.',
      },
      {
        id: 'interestRate',
        label: 'Average interest rate',
        type: 'percent',
        placeholder: 'e.g. 19',
        suffix: '%',
        min: 0,
        max: 40,
        what: 'The weighted average APR across your debts. Credit cards are typically 18–25%; personal loans 8–15%.',
        why: 'Interest is the engine making debt grow. Knowing your rate lets us calculate exact payoff months and total interest paid.',
        how: 'Check your statement for the APR. If you have multiple debts, use the rate of your highest-balance one as an estimate.',
      },
      {
        id: 'monthlyIncome',
        label: 'Monthly take-home income',
        type: 'currency',
        placeholder: 'e.g. 4,000',
        prefix: '$',
        min: 0,
        what: 'Your net monthly income — what actually hits your bank account after tax.',
        why: 'We use this to show the payment share of take-home income. It is not lender debt-to-income, which uses gross income and all required debts.',
        how: 'Use your most recent pay slip or average the last 3 months if your income varies.',
      },
    ],
  },
  {
    id: 'budget-clarity',
    title: 'Budget Clarity',
    tagline: 'Know where every dollar goes',
    audience: 'You feel like money just disappears',
    promise: 'Understand your money in 2 minutes — surplus, savings rate, and where to cut first.',
    iconName: 'pie-chart',
    colorBg: 'bg-blue-500/10',
    colorIcon: 'text-blue-500',
    colorAccent: 'border-blue-500/30',
    questions: [
      {
        id: 'monthlyIncome',
        label: 'Monthly take-home income',
        type: 'currency',
        placeholder: 'e.g. 4,500',
        prefix: '$',
        min: 0,
        what: 'What you actually receive after tax — salary, freelance, side income combined.',
        why: 'This is your starting point. Everything else is measured as a percentage of this number.',
        how: 'Check your most recent payslip for the net amount, or average the last 3 bank deposits.',
      },
      {
        id: 'fixedExpenses',
        label: 'Your fixed monthly bills',
        type: 'itemized',
        itemPlaceholder: 'Bill name (e.g. Rent, Netflix, Gym)',
        what: 'Recurring bills that hit every month at the same amount — rent or mortgage, utilities, insurance, subscriptions, and loan minimums.',
        why: 'Fixed costs are the floor of your budget. Listing them item by item shows exactly where your committed spend sits, and makes it obvious which are worth cutting.',
        how: 'Go through last month\'s bank statement and add each recurring debit that didn\'t change. Or export a CSV from your bank and upload it — we\'ll extract the line items for you.',
      },
      {
        id: 'variableExpenses',
        label: 'Your variable monthly spending',
        type: 'itemized',
        itemPlaceholder: 'Category (e.g. Groceries, Dining, Petrol)',
        what: 'Spending that changes month to month — groceries, dining out, entertainment, shopping, transport, and personal care.',
        why: 'Variable spending is where most people have the most control. Seeing each category as a line item makes it obvious where to cut first and how much you\'d save.',
        how: 'Estimate by category from last month\'s bank or card statement. Upload a CSV export and we\'ll pull the categories out for you — then adjust as needed.',
      },
      {
        id: 'savingsGoal',
        label: 'Monthly savings target',
        type: 'currency',
        placeholder: 'e.g. 500',
        prefix: '$',
        min: 0,
        what: 'How much you want to save each month — emergency fund, investments, or a specific goal.',
        why: 'We\'ll compare this to your actual surplus to show whether your goal is on track or needs adjustment.',
        how: 'Think about your most important financial goal right now. What monthly amount would move the needle on it?',
      },
    ],
  },
  {
    id: 'investor-starter',
    title: 'Start Investing',
    tagline: 'Grow your first $10k',
    audience: 'You want your money working for you',
    promise: 'See exactly when you can hit your investment goal with consistent monthly contributions.',
    iconName: 'trending-up',
    colorBg: 'bg-accent/10',
    colorIcon: 'text-accent',
    colorAccent: 'border-accent/30',
    questions: [
      {
        id: 'investmentGoal',
        label: 'Investment goal amount',
        type: 'currency',
        placeholder: 'e.g. 10,000',
        prefix: '$',
        min: 0,
        what: 'The portfolio value you\'re working toward — your first $10k, $50k, or whatever feels meaningful.',
        why: 'Having a concrete target turns "I should invest" into a plan with a finish line and a date.',
        how: 'Pick a milestone that would feel like a real achievement. $10k is a great first goal — it builds the habit.',
      },
      {
        id: 'currentSavings',
        label: 'Current savings / investments',
        type: 'currency',
        placeholder: 'e.g. 1,000',
        prefix: '$',
        min: 0,
        what: 'Money you already have saved or invested — including any emergency fund above 3 months of expenses.',
        why: 'Your starting point matters. Even $500 already saved means your goal could be months closer than you think.',
        how: 'Check your savings account balance and any existing investment accounts (ISA, brokerage, super).',
      },
      {
        id: 'monthlyContribution',
        label: 'Monthly amount you can invest',
        type: 'currency',
        placeholder: 'e.g. 200',
        prefix: '$',
        min: 0,
        what: 'How much you\'d contribute each month on top of what you already have.',
        why: 'Consistency beats timing. We\'ll show you how $100/mo vs $300/mo changes your timeline dramatically.',
        how: 'Look at your budget surplus. Even $50/month invested consistently compounds into something meaningful.',
      },
      {
        id: 'investmentHorizonYears',
        label: 'When do you want to reach this goal?',
        type: 'number',
        placeholder: 'e.g. 20',
        suffix: 'years',
        min: 1,
        max: 50,
        what: 'The number of years available for contributions and compounding before you need the money.',
        why: 'A goal amount without a deadline cannot produce a required contribution or a realistic investment policy.',
        how: 'Use the actual date the money is needed. Short horizons generally require more saving and less reliance on market returns.',
      },
      {
        id: 'riskTolerance',
        label: 'Investment comfort level',
        type: 'select',
        options: [
          { value: 'conservative', label: 'Conservative — prefer stability (4-5% return)' },
          { value: 'moderate', label: 'Moderate — balanced growth (6-7% return)' },
          { value: 'growth', label: 'Growth — comfortable with swings (8-10% return)' },
        ],
        what: 'How you\'d feel if your portfolio dropped 20% in a year before recovering.',
        why: 'Your risk tolerance determines which asset allocation we model. More risk = higher potential return but bigger short-term swings.',
        how: 'Ask yourself: if markets dropped 20%, would you sell, hold, or buy more? Sell = conservative, hold = moderate, buy = growth.',
      },
    ],
  },
  {
    id: 'home-buying',
    title: 'Buy a Home',
    tagline: 'Plan your path to ownership',
    audience: 'You want to stop renting',
    promise: 'Know exactly how long until you can afford a deposit and what your mortgage will cost.',
    iconName: 'home',
    colorBg: 'bg-amber-500/10',
    colorIcon: 'text-amber-500',
    colorAccent: 'border-amber-500/30',
    questions: [
      {
        id: 'targetHomePrice',
        label: 'Target home price',
        type: 'currency',
        placeholder: 'e.g. 450,000',
        prefix: '$',
        min: 0,
        what: 'The approximate price of the home you\'d want to buy — or the average in your target area.',
        why: 'We use this with your chosen deposit and financing assumptions to estimate the cash target and monthly ownership cost.',
        how: 'Check recent comparable sales or current listings in your target area.',
      },
      {
        id: 'currentSavings',
        label: 'Current savings toward deposit',
        type: 'currency',
        placeholder: 'e.g. 20,000',
        prefix: '$',
        min: 0,
        what: 'How much you\'ve already set aside specifically for a home deposit.',
        why: 'This is your head start. We\'ll calculate how many more months of saving gets you to your chosen deposit target.',
        how: 'Check the dedicated savings account you use for this goal. Keep emergency reserves separate.',
      },
      {
        id: 'monthlySavings',
        label: 'Monthly deposit savings',
        type: 'currency',
        placeholder: 'e.g. 800',
        prefix: '$',
        min: 0,
        what: 'How much you can realistically set aside each month toward your deposit.',
        why: 'This single number is the lever you control most. We\'ll show you the exact months saved by increasing it.',
        how: 'Review your budget surplus — how much could go straight to the deposit fund after all bills and expenses?',
      },
      {
        id: 'monthlyIncome',
        label: 'Combined household take-home income',
        type: 'currency',
        placeholder: 'e.g. 8,000',
        prefix: '$',
        min: 0,
        what: 'Total monthly take-home for all buyers — your income plus a partner\'s if buying together.',
        why: 'This lets the plan compare the modeled ownership cost with the cash actually available to your household.',
        how: 'Add up net monthly income for everyone who would contribute to housing. Lender underwriting uses separate gross-income and debt inputs.',
      },
      {
        id: 'depositPercent',
        label: 'Target deposit',
        type: 'percent',
        placeholder: 'e.g. 20',
        suffix: '%',
        min: 1,
        max: 99,
        what: 'The portion of the purchase price you intend to pay up front.',
        why: 'Deposit requirements and mortgage insurance vary by location and loan program. Making this explicit keeps the projection honest.',
        how: 'Use a lender estimate for your jurisdiction or begin with 20% as a planning assumption.',
      },
      {
        id: 'mortgageRate',
        label: 'Illustrative mortgage rate',
        type: 'percent',
        placeholder: 'e.g. 6.5',
        suffix: '%',
        min: 0,
        max: 25,
        what: 'The annual interest rate used to model principal and interest on a 30-year loan.',
        why: 'Rates materially change affordability. This is an assumption, not a quote or approval.',
        how: 'Use a current lender estimate and stress-test at least one higher-rate scenario.',
      },
    ],
  },
  {
    id: 'business-owner',
    title: 'Business Owner',
    tagline: 'Understand your business finances',
    audience: 'You run or are starting a business',
    promise: 'See your runway, breakeven point, and what revenue you need to pay yourself properly.',
    iconName: 'briefcase',
    colorBg: 'bg-violet-500/10',
    colorIcon: 'text-violet-500',
    colorAccent: 'border-violet-500/30',
    questions: [
      {
        id: 'monthlyRevenue',
        label: 'Current monthly revenue',
        type: 'currency',
        placeholder: 'e.g. 8,000',
        prefix: '$',
        min: 0,
        what: 'Your average monthly revenue over the last 3 months — gross, before any expenses.',
        why: 'Revenue is the starting point for everything. We use it to calculate your runway and growth gap.',
        how: 'Check your accounting software or bank statements. Use an average of the last 3 months if revenue varies.',
      },
      {
        id: 'monthlyExpenses',
        label: 'Monthly business expenses',
        type: 'currency',
        placeholder: 'e.g. 4,000',
        prefix: '$',
        min: 0,
        what: 'All operating costs — staff, software, rent, ads, supplies, professional services.',
        why: 'The gap between revenue and expenses is your operating profit. We\'ll show whether it\'s sustainable and growing.',
        how: 'Pull last month\'s P&L or add up all outgoing business transactions from your business account.',
      },
      {
        id: 'targetOwnerSalary',
        label: 'Monthly salary you want to pay yourself',
        type: 'currency',
        placeholder: 'e.g. 5,000',
        prefix: '$',
        min: 0,
        what: 'The monthly amount you want the business to pay you — a fair market salary for your role.',
        why: 'Many founders underpay themselves, masking the true cost of the business. This number makes the analysis honest.',
        how: 'Look up market salary for your role, or use what you\'d need to cover your personal living expenses comfortably.',
      },
      {
        id: 'cashReserves',
        label: 'Current cash reserves',
        type: 'currency',
        placeholder: 'e.g. 15,000',
        prefix: '$',
        min: 0,
        what: 'Cash in your business account today — your operational runway buffer.',
        why: 'Runway = reserves ÷ monthly burn. This tells you how many months you can operate if revenue stopped tomorrow.',
        how: 'Check your business bank account balance. Don\'t include money already earmarked for upcoming bills.',
      },
    ],
  },
];

export const getJourney = (id: JourneyId): JourneyDef | undefined =>
  JOURNEYS.find(j => j.id === id);
