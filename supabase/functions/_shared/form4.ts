export type Form4Classification =
  | 'open_market_purchase'
  | 'open_market_sale'
  | 'grant'
  | 'option_exercise'
  | 'tax_withholding'
  | 'gift'
  | 'other';

export interface Form4Transaction {
  lineIndex: number;
  actorKey: string;
  jointFiling: boolean;
  ownerCik: string;
  ownerName: string;
  officerTitle: string | null;
  isOfficer: boolean;
  isDirector: boolean;
  isTenPercentOwner: boolean;
  transactionDate: string;
  transactionCode: string;
  classification: Form4Classification;
  acquiredDisposed: 'A' | 'D' | null;
  shares: number;
  pricePerShare: number | null;
  sharesOwnedAfter: number | null;
  plan10b51: boolean;
  priceSuspect: boolean;
}

export interface Form4DocumentMetadata {
  actorKey: string | null;
  jointFiling: boolean;
  periodOfReport: string | null;
  originalSubmissionDate: string | null;
}

export interface Form4PriceContext {
  close?: number | null;
  marketCap?: number | null;
}

/** Return the transaction-day close, or the nearest earlier trading-day close. */
export function closestPriorMarketClose(
  closes: ReadonlyMap<string, number>,
  transactionDate: string,
  maxLookbackDays = 7,
): number | null {
  const parsed = new Date(`${transactionDate}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate) || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== transactionDate) return null;
  for (let offset = 0; offset <= maxLookbackDays; offset++) {
    const date = new Date(parsed.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    const close = closes.get(date);
    if (Number.isFinite(close) && Number(close) > 0) return Number(close);
  }
  return null;
}

const decode = (value: string) => value
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();

const blocks = (xml: string, tag: string): string[] => {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...xml.matchAll(new RegExp(`<(?:\\w+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${escaped}>`, 'gi'))]
    .map(match => match[1]);
};

const text = (xml: string, tag: string): string | null => {
  const block = blocks(xml, tag)[0];
  if (block == null) return null;
  const value = blocks(block, 'value')[0] ?? block;
  return decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
};

const number = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const bool = (value: string | null) => /^(1|true|yes)$/i.test(value ?? '');

const normalizeCik = (value: string | null): string | null => {
  const digits = (value ?? '').trim();
  if (!/^\d{1,10}$/.test(digits) || /^0+$/.test(digits)) return null;
  return digits.padStart(10, '0');
};

const documentFootnotes = (xml: string): Map<string, string> => {
  const notes = new Map<string, string>();
  for (const match of xml.matchAll(/<(?:\w+:)?footnote\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/(?:\w+:)?footnote>/gi)) {
    const id = match[1]?.trim().toUpperCase();
    const value = decode((match[2] ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
    if (id && value) notes.set(id, value);
  }
  return notes;
};

const referencedFootnotes = (xml: string, notes: Map<string, string>): string => {
  const ids = [...xml.matchAll(/<(?:\w+:)?footnoteId\b[^>]*\bid=["']([^"']+)["'][^>]*\/?\s*>/gi)]
    .map(match => match[1]?.trim().toUpperCase())
    .filter((id): id is string => Boolean(id));
  return [...new Set(ids)].map(id => notes.get(id) ?? '').filter(Boolean).join(' ');
};

interface ParsedOwner {
  ownerCik: string;
  ownerName: string;
  officerTitle: string | null;
  isOfficer: boolean;
  isDirector: boolean;
  isTenPercentOwner: boolean;
}

const parseOwners = (xml: string): ParsedOwner[] => {
  const seen = new Set<string>();
  return blocks(xml, 'reportingOwner').flatMap(owner => {
    const ownerCik = normalizeCik(text(owner, 'rptOwnerCik'));
    if (!ownerCik || seen.has(ownerCik)) return [];
    seen.add(ownerCik);
    const relationship = blocks(owner, 'reportingOwnerRelationship')[0] ?? owner;
    return [{
      ownerCik,
      ownerName: text(owner, 'rptOwnerName') ?? 'Unknown insider',
      officerTitle: text(relationship, 'officerTitle') || null,
      isOfficer: bool(text(relationship, 'isOfficer')),
      isDirector: bool(text(relationship, 'isDirector')),
      isTenPercentOwner: bool(text(relationship, 'isTenPercentOwner')),
    }];
  });
};

const validDate = (value: string | null): string | null => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
};

export function parseForm4DocumentMetadata(xml: string): Form4DocumentMetadata {
  const owners = parseOwners(xml);
  return {
    actorKey: owners.length ? owners.map(owner => owner.ownerCik).sort().join('+') : null,
    jointFiling: owners.length > 1,
    periodOfReport: validDate(text(xml, 'periodOfReport')),
    originalSubmissionDate: validDate(text(xml, 'dateOfOriginalSubmission')),
  };
}

export function classifyForm4Code(code: string): Form4Classification {
  switch (code.toUpperCase()) {
    case 'P': return 'open_market_purchase';
    case 'S': return 'open_market_sale';
    case 'A': return 'grant';
    case 'M': return 'option_exercise';
    case 'F': return 'tax_withholding';
    case 'G': return 'gift';
    default: return 'other';
  }
}

export function isSuspectForm4Price(
  shares: number,
  price: number | null,
  context: Form4PriceContext = {},
): boolean {
  if (price == null || price <= 0 || !Number.isFinite(price)) return true;
  if (context.close && context.close > 0 && (price < context.close * 0.2 || price > context.close * 5)) return true;
  if (context.marketCap && context.marketCap > 0 && shares * price > context.marketCap * 0.5) return true;
  return false;
}

/** Parse one row per non-derivative and derivative transaction in an SEC ownership XML filing. */
export function parseForm4Xml(xml: string, context: Form4PriceContext = {}): Form4Transaction[] {
  const owners = parseOwners(xml);
  if (!owners.length) return [];

  const actorKey = owners.map(owner => owner.ownerCik).sort().join('+');
  const jointFiling = owners.length > 1;
  const notes = documentFootnotes(xml);
  const filingScope = ['nonDerivativeTransaction', 'derivativeTransaction'].reduce((scope, tag) => {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return scope.replace(new RegExp(`<(?:\\w+:)?${escaped}\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?${escaped}>`, 'gi'), '');
  }, xml);
  const filingPlan = bool(text(filingScope, 'aff10b5One'));
  const rows = [...blocks(xml, 'nonDerivativeTransaction'), ...blocks(xml, 'derivativeTransaction')];

  return rows.flatMap((row, lineIndex) => {
    const code = (text(row, 'transactionCode') ?? '').toUpperCase();
    const transactionDate = validDate(text(row, 'transactionDate'));
    const shares = number(text(row, 'transactionShares'));
    if (!code || !transactionDate || shares == null || shares < 0) return [];
    const price = number(text(row, 'transactionPricePerShare'));
    const acquiredDisposed = text(row, 'transactionAcquiredDisposedCode')?.toUpperCase();
    const planText = `${text(row, 'transactionCoding') ?? ''} ${referencedFootnotes(row, notes)} ${row}`;
    return owners.map(owner => ({
      lineIndex,
      actorKey,
      jointFiling,
      ...owner,
      transactionDate,
      transactionCode: code,
      classification: classifyForm4Code(code),
      acquiredDisposed: acquiredDisposed === 'A' || acquiredDisposed === 'D' ? acquiredDisposed : null,
      shares,
      pricePerShare: price,
      sharesOwnedAfter: number(text(row, 'sharesOwnedFollowingTransaction')),
      plan10b51: filingPlan || bool(text(row, 'aff10b5One')) || /10b5[\s-]?1/i.test(planText),
      priceSuspect: isSuspectForm4Price(shares, price, context),
    }));
  });
}
