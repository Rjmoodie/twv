import type { DCFScenarios, InvestmentThesis } from '../types';

const STORAGE_VERSION = 'v4';

export const stockAnalysisStorageKey = (userId: string) =>
  `somatech:stock-analysis:${STORAGE_VERSION}:${userId}`;

export const defaultDcfScenarios = (): DCFScenarios => ({
  low: { revenueGrowth: 5, netMargin: 8, fcfGrowth: 3, exitMultiple: 15, discountRate: 12 },
  base: { revenueGrowth: 12, netMargin: 15, fcfGrowth: 8, exitMultiple: 20, discountRate: 10 },
  high: { revenueGrowth: 20, netMargin: 22, fcfGrowth: 15, exitMultiple: 25, discountRate: 8 },
});

export const defaultInvestmentThesis = (): InvestmentThesis => ({
  moat: '',
  risks: '',
  opportunities: '',
});
