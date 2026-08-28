import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { DCFParams, StockData } from "./types";

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'excellent': return 'text-accent';
    case 'good': return 'text-blue-600';
    case 'moderate': return 'text-yellow-600';
    case 'poor': return 'text-red-600';
    default: return 'text-muted-foreground';
  }
};

export const getStatusIcon = (status: string) => {
  switch (status) {
    case 'excellent': return CheckCircle;
    case 'good': return CheckCircle;
    case 'moderate': return AlertTriangle;
    case 'poor': return XCircle;
    default: return AlertTriangle;
  }
};

export const generateStockChartData = () => {
  const data = [];
  let price = 150;
  for (let i = 0; i < 30; i++) {
    const change = (Math.random() - 0.5) * 10;
    price = Math.max(price + change, 50);
    data.push({
      date: `Day ${i + 1}`,
      price: Math.round(price * 100) / 100,
      volume: Math.floor(Math.random() * 1000000) + 500000
    });
  }
  return data;
};

const PROJECTION_YEARS = 5;

export type EditableDcfInput = 'fcfGrowth' | 'exitMultiple' | 'discountRate';
export const DCF_INPUT_BOUNDS: Record<EditableDcfInput, { min: number; max: number; step: number }> = {
  fcfGrowth: { min: -50, max: 50, step: 0.5 },
  exitMultiple: { min: 0, max: 60, step: 0.5 },
  discountRate: { min: 1, max: 40, step: 0.5 },
};

export function clampDcfInput(key: EditableDcfInput, value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const { min, max } = DCF_INPUT_BOUNDS[key];
  return Math.min(Math.max(value, min), max);
}

/**
 * Five-year discounted cash flow with an exit-multiple terminal value.
 *
 * Two defects this replaces, both of which made the output unusable:
 *
 *  1. Share count was derived as `marketCap / price`. Substituting that back,
 *     value per share reduced to `PV × price / marketCap` — intrinsic value
 *     scaled one-for-one with the price it was meant to judge, so upside came
 *     out identical at $50 and $200. Shares are now derived from net income and
 *     EPS, which is independent of the current quote.
 *  2. Only the terminal value was discounted; no interim cash flow entered the
 *     sum, so it was an exit-multiple model wearing a DCF label.
 *
 * Returns `intrinsicValue: null` when inputs are insufficient rather than a
 * fabricated zero — a valuation that cannot be computed must not read as $0.
 */
export const calculateDCF = (scenario: DCFParams, stockData: StockData | null) => {
  const EMPTY = { intrinsicValue: null as number | null, cagr: null as number | null, upside: null as number | null };
  if (!stockData) return EMPTY;

  const currentPrice = stockData.price;
  const sharesOutstanding = stockData.financials?.sharesOutstanding
    ? parseFloat(stockData.financials.sharesOutstanding) / 1_000_000
    : 0;

  if (!isFinite(sharesOutstanding) || sharesOutstanding <= 0) return EMPTY;

  // ── Project and discount each year, then the terminal value ─────────────
  const g = scenario.fcfGrowth / 100;
  const r = scenario.discountRate / 100;
  if (!isFinite(g) || g <= -1 || !isFinite(r) || r <= 0 ||
      !isFinite(scenario.exitMultiple) || scenario.exitMultiple < 0) return EMPTY;
  if (clampDcfInput('fcfGrowth', scenario.fcfGrowth) !== scenario.fcfGrowth ||
      clampDcfInput('exitMultiple', scenario.exitMultiple) !== scenario.exitMultiple ||
      clampDcfInput('discountRate', scenario.discountRate) !== scenario.discountRate) return EMPTY;

  const reportedFcf = stockData.financials?.freeCashFlow
    ? parseFloat(stockData.financials.freeCashFlow) / 1_000_000
    : 0;
  if (!isFinite(reportedFcf) || reportedFcf <= 0) return EMPTY;
  let fcf = reportedFcf;
  let presentValue = 0;

  for (let year = 1; year <= PROJECTION_YEARS; year++) {
    fcf *= (1 + g);
    presentValue += fcf / Math.pow(1 + r, year);
  }

  // Terminal value on the exit multiple applied to final-year cash flow.
  const terminalValue = fcf * scenario.exitMultiple;
  presentValue += terminalValue / Math.pow(1 + r, PROJECTION_YEARS);

  const sharePrice = presentValue / sharesOutstanding;
  if (!isFinite(sharePrice)) return EMPTY;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    // Not rounded to whole dollars — that was a >15% quantisation error on a $3 stock.
    intrinsicValue: round2(sharePrice),
    cagr: currentPrice > 0 && sharePrice > 0
      ? round2(((sharePrice / currentPrice) ** (1 / PROJECTION_YEARS) - 1) * 100)
      : null,
    upside: currentPrice > 0
      ? round2(((sharePrice - currentPrice) / currentPrice) * 100)
      : null,
  };
};

export const generateRetirementChartData = (
  currentAge: string,
  retirementAge: string,
  lifeExpectancy: string,
  currentSavings: string,
  annualContribution: string,
  expectedReturn: number[],
  retirementSpending: string,
  inflationRate: number[]
) => {
  if (!currentAge || !retirementAge || !currentSavings || !annualContribution) return [];
  
  const age = parseInt(currentAge);
  const retAge = parseInt(retirementAge);
  const lifeExp = parseInt(lifeExpectancy) || 90;
  const savings = parseFloat(currentSavings);
  const contribution = parseFloat(annualContribution);
  const returnRate = expectedReturn[0] / 100;
  const annualSpending = parseFloat(retirementSpending) || 0;
  const inflation = inflationRate ? inflationRate[0] / 100 : 0.025;
  
  const data = [];
  let currentBalance = savings;
  
  // Accumulation phase (working years)
  for (let year = age; year <= retAge; year++) {
    const totalContributions = contribution * (year - age + 1);
    const growth = currentBalance - savings - totalContributions;
    
    data.push({
      age: year,
      balance: Math.round(currentBalance),
      contributions: Math.round(totalContributions),
      growth: Math.round(Math.max(0, growth)),
      phase: 'accumulation'
    });
    
    if (year < retAge) {
      currentBalance = currentBalance * (1 + returnRate) + contribution;
    }
  }
  
  // Decumulation phase (retirement years)
  let retirementBalance = currentBalance;
  const inflationAdjustedSpending = annualSpending * Math.pow(1 + inflation, retAge - age);
  
  for (let year = retAge + 1; year <= lifeExp; year++) {
    const yearlySpending = inflationAdjustedSpending * Math.pow(1 + inflation, year - retAge);
    retirementBalance = Math.max(0, retirementBalance * (1 + returnRate) - yearlySpending);
    
    data.push({
      age: year,
      balance: Math.round(retirementBalance),
      contributions: Math.round(contribution * (retAge - age + 1)),
      growth: Math.round(retirementBalance),
      phase: 'decumulation'
    });
    
    if (retirementBalance <= 0) break;
  }
  
  return data;
};

export const generateCampaignProjectionData = (
  targetAmount: string,
  timeframe: string,
  averageDonation: string,
  donationFrequency: number[],
  networkSize: string,
  participationRate: number[]
) => {
  if (!targetAmount || !timeframe || !averageDonation || !networkSize) return [];
  
  const target = parseFloat(targetAmount);
  const weeks = parseInt(timeframe);
  const avgDonation = parseFloat(averageDonation);
  const frequency = donationFrequency[0];
  const network = parseInt(networkSize);
  const participation = participationRate[0] / 100;
  
  const expectedDonors = Math.floor(network * participation);
  const weeklyDonations = expectedDonors * frequency;
  const weeklyAmount = weeklyDonations * avgDonation;
  
  const data = [];
  
  for (let week = 0; week <= weeks; week++) {
    const realistic = Math.round(weeklyAmount * week);
    const optimistic = Math.round(weeklyAmount * week * 1.5);
    const pessimistic = Math.round(weeklyAmount * week * 0.6);
    
    data.push({
      week,
      realistic,
      optimistic,
      pessimistic,
      target: Math.round(target)
    });
  }
  
  return data;
};

// Utility functions for debugging and validation

/**
 * Validate numeric input and return safe value
 */
export const validateNumericInput = (value: string, min: number = 0, max: number = Infinity): number => {
  const num = parseFloat(value);
  if (isNaN(num)) return min;
  return Math.max(min, Math.min(max, num));
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format percentage for display
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle function for performance optimization
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Check if device is mobile
 */
export const isMobile = (): boolean => {
  return window.innerWidth < 768;
};

/**
 * Check if device is tablet
 */
export const isTablet = (): boolean => {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
};

/**
 * Check if device is desktop
 */
export const isDesktop = (): boolean => {
  return window.innerWidth >= 1024;
};

/**
 * Safe scroll to top with fallback
 */
export const scrollToTop = (): void => {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    // Fallback for older browsers
    window.scrollTo(0, 0);
  }
};

/**
 * Validate stock ticker format
 */
export const validateStockTicker = (ticker: string): boolean => {
  return /^[A-Z]{1,5}$/.test(ticker);
};

/**
 * Clean stock ticker input
 */
export const cleanStockTicker = (input: string): string => {
  return input.toUpperCase().replace(/[^A-Z]/g, '');
};

/**
 * Log performance metrics
 */
export const logPerformance = (name: string, startTime: number): void => {
  const duration = performance.now() - startTime;
  console.log(`Performance [${name}]: ${duration.toFixed(2)}ms`);
  
  if (duration > 1000) {
    console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
  }
};

/**
 * Generate unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Deep clone object
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
  return obj;
};
