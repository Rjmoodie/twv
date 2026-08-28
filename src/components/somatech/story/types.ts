export type StoryClassification = 'company-reported' | 'calculated' | 'inferred' | 'typical';
export type StoryDirection = 'positive' | 'negative' | 'mixed' | 'neutral';
export type StoryChange = 'new' | 'strengthening' | 'weakening' | 'unchanged' | 'reversed' | 'resolved' | 'contradicted';
export type CatalystStatus = 'typical' | 'developing' | 'confirmed' | 'realized' | 'delayed' | 'invalidated';
export type TrackingMode = 'price' | 'story' | 'thesis';

export interface StoryEvidence {
  label: string;
  value: string;
  exactValue?: string;
  periodEnd: string | null;
  form: string | null;
  filedAt: string | null;
  accession: string | null;
  sourceUrl: string | null;
}

export interface StoryEvent {
  id: string;
  category: 'revenue' | 'margin' | 'cash-flow' | 'balance-sheet' | 'guidance' | 'risk' | 'capital-allocation';
  headline: string;
  detail: string;
  direction: StoryDirection;
  change: StoryChange;
  classification: StoryClassification;
  confidence: 'high' | 'medium' | 'low';
  disclosureDate: string | null;
  reportingPeriod: string | null;
  evidence: StoryEvidence[];
  watchNext: string;
}

export interface Catalyst {
  id: string;
  title: string;
  rationale: string;
  status: CatalystStatus;
  direction: StoryDirection;
  horizon: 'near' | 'medium' | 'long';
  classification: StoryClassification;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  invalidation: string;
}

export interface MacroExposure {
  id: string;
  factor: string;
  expectedRelationship: string;
  relevantMetrics: string[];
  classification: 'structurally-exposed' | 'historically-correlated' | 'company-confirmed' | 'analytically-inferred';
  confidence: 'high' | 'medium' | 'low';
}

export interface NarrativeClaim {
  id: string;
  category: StoryEvent['category'];
  headline: string;
  explanation: string;
  classification: 'company-reported' | 'inferred';
  direction: StoryDirection;
  confidence: 'high' | 'medium' | 'low';
  excerpt: string;
  watchNext: string;
  source: {
    form: string;
    accession: string;
    filedAt: string;
    reportDate: string | null;
    section: string;
    documentUrl: string;
  };
}

export interface CompanyStorySnapshot {
  schemaVersion: 'story-v1' | 'story-v2';
  ticker: string;
  companyName: string;
  generatedAt: string;
  sourceAsOf: string;
  reportingPeriod: string | null;
  summary: string;
  events: StoryEvent[];
  catalysts: Catalyst[];
  macroExposures: MacroExposure[];
  narrativeClaims?: NarrativeClaim[];
  limitations: string[];
}
