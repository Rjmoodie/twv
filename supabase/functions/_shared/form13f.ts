export interface Form13FHolding {
  lineIndex: number;
  issuerName: string;
  titleOfClass: string;
  cusip: string;
  figi: string | null;
  valueUsd: number;
  sharesOrPrincipal: number;
  sharesOrPrincipalType: string;
  putCall: 'PUT' | 'CALL' | null;
  investmentDiscretion: string | null;
  votingSole: number;
  votingShared: number;
  votingNone: number;
}

/** Normalize SEC submissions acceptance timestamps, including compact YYYYMMDDHHMMSS. */
export function normalizeSecAcceptanceTimestamp(value: unknown, filingDate: string): string {
  const candidate = String(value ?? '').trim();
  if (/^\d{14}$/.test(candidate)) {
    const expanded = `${candidate.slice(0, 4)}-${candidate.slice(4, 6)}-${candidate.slice(6, 8)}T${candidate.slice(8, 10)}:${candidate.slice(10, 12)}:${candidate.slice(12, 14)}Z`;
    const parsed = new Date(expanded);
    if (Number.isFinite(parsed.getTime())
      && parsed.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) === candidate) {
      return parsed.toISOString();
    }
  }
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : `${filingDate}T00:00:00Z`;
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
  const value = blocks(xml, tag)[0];
  return value == null ? null : decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
};

const number = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value.replace(/[$,]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

/** Current SEC 13F XML information tables report value in dollars. */
export function parseForm13FInformationTable(xml: string): Form13FHolding[] {
  return blocks(xml, 'infoTable').flatMap((row, lineIndex) => {
    const issuerName = text(row, 'nameOfIssuer') ?? '';
    const titleOfClass = text(row, 'titleOfClass') ?? '';
    const cusip = (text(row, 'cusip') ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const valueUsd = number(text(row, 'value'));
    const sharesOrPrincipal = number(text(row, 'sshPrnamt'));
    if (!issuerName || !titleOfClass || !/^[A-Z0-9]{8,9}$/.test(cusip) || valueUsd == null || sharesOrPrincipal == null) return [];
    const putCall = text(row, 'putCall')?.toUpperCase();
    return [{
      lineIndex,
      issuerName,
      titleOfClass,
      cusip,
      figi: text(row, 'figi') || null,
      valueUsd,
      sharesOrPrincipal,
      sharesOrPrincipalType: text(row, 'sshPrnamtType') ?? 'UNKNOWN',
      putCall: putCall === 'PUT' || putCall === 'CALL' ? putCall : null,
      investmentDiscretion: text(row, 'investmentDiscretion') || null,
      votingSole: number(text(row, 'Sole')) ?? 0,
      votingShared: number(text(row, 'Shared')) ?? 0,
      votingNone: number(text(row, 'None')) ?? 0,
    }];
  });
}

export function is13FInformationTable(xml: string): boolean {
  return /<(?:\w+:)?informationTable\b/i.test(xml) && /<(?:\w+:)?infoTable\b/i.test(xml);
}
