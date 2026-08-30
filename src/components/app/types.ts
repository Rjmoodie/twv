export interface DCFScenarios {
  low: DCFParams;
  base: DCFParams;
  high: DCFParams;
}

export interface DCFParams {
  revenueGrowth: number;
  netMargin: number;
  fcfGrowth: number;
  exitMultiple: number;
  discountRate: number;
}

export interface InvestmentThesis {
  moat: string;
  risks: string;
  opportunities: string;
}

export interface StockPillar {
  score: number;
  status: string;
  value: string;
}

export interface StockTechnicals {
  trend: string;
  ma50: number;
  ma200: number;
  rsi: number;
  macd: string;
}

export interface StockRatios {
  quickRatio?: number;
  assetTurnover?: number;
  grossMargin?: number;
  operatingMargin?: number;
}

export interface FinancialStatementPeriod {
  fiscalYear: number;
  fiscalQuarter?: number;
  periodEnd: string;
  periodType?: 'annual' | 'quarter' | 'ttm';
  derivation?: 'filed' | 'mixed' | 'derived';
  revenue: number | null; grossProfit: number | null; operatingIncome: number | null; netIncome: number | null;
  researchAndDevelopment?: number | null; sellingGeneralAdministrative?: number | null;
  pretaxIncome?: number | null; incomeTaxExpense?: number | null; interestExpense?: number | null;
  dilutedShares?: number | null;
  operatingCashFlow: number | null; capex: number | null; freeCashFlow: number | null;
  totalAssets: number | null; currentAssets: number | null; currentLiabilities: number | null;
  totalLiabilities?: number | null; receivables?: number | null; inventory?: number | null;
  goodwill?: number | null; retainedEarnings?: number | null;
  longTermDebt: number | null; shortTermDebt: number | null; shareholderEquity: number | null;
  cash: number | null; sharesOutstanding: number | null;
  depreciationAmortization?: number | null; stockCompensation?: number | null;
  acquisitions?: number | null; shareRepurchases?: number | null; dividendsPaid?: number | null;
  debtIssuance?: number | null; debtRepayment?: number | null;
  provenance?: Record<string, {
    concept: string | null; accession: string | null; filed: string | null;
    form: string | null; classification: 'filed' | 'derived'; formula?: string;
  }>;
}

export interface StockData {
  secCik?: string;
  symbol: string;
  name?: string;
  price: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  pe?: number;
  pbv?: number;
  roe?: number;
  debtToEquity?: number;
  currentRatio?: number;
  score?: number;
  intrinsicValue?: number;
  recommendation?: string;
  chartData?: any[];
  pillars?: Record<string, StockPillar>;
  technicals?: StockTechnicals;
  ratios?: StockRatios;
  marketCap?: number;
  eps?: number;
  dividend?: number;
  yield?: number;
  companyName?: string;
  headquarters?: string;
  founded?: string;
  employees?: string;
  ceo?: string;
  exchange?: string;
  currency?: string;
  sector?: string;
  industry?: string;
  /** SIC code as filed with the SEC, e.g. "6021". Drives valuation-method selection. */
  sic?: string;
  sicDescription?: string;
  description?: string;
  week52High?: number;
  week52Low?: number;
  dividendYield?: number;
  beta?: number;
  forwardPE?: number;
  pegRatio?: number;
  priceToSales?: number;
  evToRevenue?: number;
  evToEbitda?: number;
  ebitda?: number;
  revenueTTM?: number;
  profitMarginTTM?: number;
  operatingMarginTTM?: number;
  returnOnAssetsTTM?: number;
  quarterlyEarningsGrowthYOY?: number;
  quarterlyRevenueGrowthYOY?: number;
  analystTargetPrice?: number;
  dividendPerShare?: number;
  fiscalYearEnd?: string;
  latestQuarter?: string;
  dividendDate?: string;
  exDividendDate?: string;
  priceChange?: number;
  priceChangePercent?: number;
  lastUpdated?: string;
  dataSources?: {
    fundamentals: { provider: string; asOf: string | null; fetchedAt?: string; stale?: boolean };
    quote: { provider: string; asOf: string | null; fetchedAt: string; freshness: string; stale?: boolean };
    chart: { provider: string };
    quoteCacheHit: boolean;
    fundamentalsCacheHit: boolean;
  };
  annualFinancials?: FinancialStatementPeriod[];
  quarterlyFinancials?: FinancialStatementPeriod[];
  financials?: {
    revenue: string;
    netIncome: string;
    freeCashFlow?: string;
    sharesOutstanding?: string;
    totalAssets: string;
    totalDebt: string;
    shareholderEquity: string;
  };
}

export interface ValuationResult {
  revenueMultiple: number;
  earningsMultiple: number;
  dcfValue: number;
  averageValue: number;
}

export interface BusinessValuationInputs {
  industry: string;
  businessType: string;
  currentRevenue: number;
  grossMargin: number;
  ebitdaMargin: number;
  netMargin: number;
  revenueGrowth: number;
  exitTimeframe: number;
  discountRate: number;
  terminalGrowthRate: number;
}

export interface ValuationMethods {
  revenueMultiple: boolean;
  ebitdaMultiple: boolean;
  peMultiple: boolean;
  dcf: boolean;
}

export interface ValuationScenarios {
  conservative: ValuationBreakdown;
  base: ValuationBreakdown;
  optimistic: ValuationBreakdown;
}

export interface ValuationBreakdown {
  revenueMultiple?: number;
  ebitdaMultiple?: number;
  peMultiple?: number;
  dcfValue?: number;
  totalValue: number;
}

export interface BusinessValuationReport {
  inputs: BusinessValuationInputs;
  scenarios: ValuationScenarios;
  projections: Array<{
    year: number;
    revenue: number;
    ebitda: number;
    netIncome: number;
    value: number;
  }>;
  sensitivityAnalysis: {
    revenueGrowthImpact: Array<{ growth: number; value: number }>;
    marginImpact: Array<{ margin: number; value: number }>;
    multipleImpact: Array<{ multiple: number; value: number }>;
  };
}

export interface CashFlowInputs {
  businessName: string;
  industry: string;
  startingCash: number;
  timeframe: number;
  monthlyRevenue: number;
  revenueGrowthRate: number;
  hasSeasonality: boolean;
  seasonalityMultiplier: number;
  accountsReceivableDays: number;
  accountsPayableDays: number;
  fixedExpenses: Array<{
    name: string;
    amount: number;
    isPercentage: boolean;
  }>;
  variableExpenses: Array<{
    name: string;
    amount: number;
    isPercentage: boolean;
  }>;
  taxRate: number;
  loanAmount: number;
  interestRate: number;
  loanTermMonths: number;
  equityRaised: number;
  equityRaiseMonth: number;
}

export interface CashFlowScenario {
  monthlyProjections: Array<{
    month: number;
    inflows: number;
    outflows: number;
    netFlow: number;
    cashBalance: number;
    revenue: number;
    expenses: number;
  }>;
  totalInflows: number;
  totalOutflows: number;
  endingCash: number;
  avgMonthlyCashFlow: number;
  runway: number;
  breakEvenMonth: number;
  alerts: Array<{
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  keyMilestones: Array<{
    month: number;
    description: string;
    type: 'positive' | 'warning';
  }>;
}

export interface CashFlowReport {
  inputs: CashFlowInputs;
  scenarios: {
    conservative: CashFlowScenario;
    base: CashFlowScenario;
    optimistic: CashFlowScenario;
  };
  generatedAt: string;
}


export interface RealEstateResult {
  monthlyPayment: number;
  netCashFlow: number;
  cashOnCashReturn: number;
  capRate: number;
  profitable: boolean;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  featured: boolean;
  seo?: {
    title: string;
    description: string;
    keywords: string;
  };
  navGroup?: string;
}

// Business Marketplace Types
export interface BusinessListing {
  id: string;
  user_id: string;
  business_name: string;
  industry: string;
  location: string;
  revenue: number;
  ebitda: number;
  cash_flow?: number;
  asking_price: number;
  valuation_summary?: {
    low: number;
    base: number;
    high: number;
    cagr?: number;
    upside?: number;
  };
  description: string;
  key_value_drivers?: string;
  growth_potential?: string;
  competitive_advantages?: string;
  documents?: string[];
  bor_documents?: string[];
  bor_visibility: 'public' | 'premium' | 'on_request';
  visibility: 'public' | 'verified_only';
  status: 'draft' | 'live' | 'under_negotiation' | 'sold';
  views_count: number;
  contact_requests_count: number;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceMessage {
  id: string;
  listing_id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  read_at?: string;
  created_at: string;
}

export interface ListingFormData {
  business_name: string;
  industry: string;
  location: string;
  revenue: number;
  ebitda: number;
  cash_flow?: number;
  asking_price: number;
  description: string;
  key_value_drivers?: string;
  growth_potential?: string;
  competitive_advantages?: string;
  visibility: 'public' | 'verified_only';
  bor_documents?: string[];
  bor_visibility: 'public' | 'premium' | 'on_request';
}

export interface MarketplaceFilters {
  industry?: string;
  location?: string;
  priceMin?: number;
  priceMax?: number;
  ebitdaMin?: number;
  ebitdaMax?: number;
  sortBy: 'newest' | 'price_asc' | 'price_desc' | 'ebitda_desc';
}

// Funding Campaigns Types
export interface CampaignProjectionResult {
  targetAmount: number;
  projectedAmount: number;
  expectedDonors: number;
  totalDonations: number;
  weeklyTarget: number;
  weeklyProjected: number;
  optimisticAmount: number;
  pessimisticAmount: number;
  weeksToComplete: number;
  successProbability: number;
  onTrack: boolean;
}

export interface FundingCampaign {
  id: string;
  user_id: string;
  title: string;
  category: 'car' | 'education' | 'business' | 'medical' | 'emergency' | 'housing' | 'other';
  description: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  image_url?: string;
  video_url?: string;
  financial_breakdown?: Array<{
    title: string;
    amount: number;
  }> | any;
  projection_data?: CampaignProjectionResult | any;
  url_slug?: string;
  visibility: 'public' | 'private';
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  campaign_id: string;
  donor_name?: string;
  donor_email?: string;
  amount: number;
  message?: string;
  is_anonymous: boolean;
  stripe_payment_intent_id?: string;
  created_at: string;
}

export interface CreateCampaignForm {
  title: string;
  category: string;
  description: string;
  target_amount: number;
  deadline?: string;
  image_url?: string;
  video_url?: string;
  financial_breakdown?: Array<{
    title: string;
    amount: number;
  }>;
  url_slug?: string;
  visibility: 'public' | 'private';
}

export interface DonationForm {
  amount: number;
  donor_name?: string;
  donor_email?: string;
  message?: string;
  is_anonymous: boolean;
}

export interface CampaignFilters {
  category?: string;
  sortBy: 'newest' | 'most_funded' | 'ending_soon' | 'most_recent';
  search?: string;
}

export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  theme_preference: string;
  onboarding_completed: boolean;
  profile_completion_score: number;
  two_factor_enabled?: boolean;
  email_verified?: boolean;
}
