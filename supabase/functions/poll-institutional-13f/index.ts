import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { SEC_HEADERS } from '../_shared/narrativeExtraction.ts';
import { is13FInformationTable, normalizeSecAcceptanceTimestamp, parseForm13FInformationTable } from '../_shared/form13f.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
});
const UPSTREAM_TIMEOUT_MS = 12_000;
const fetchUpstream = (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1] = {}) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const archiveBase = (cik: string, accession: string) =>
  `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}`;

interface Filing {
  accession: string;
  form: '13F-HR' | '13F-HR/A';
  filingDate: string;
  acceptedAt: string;
  reportDate: string;
}
function filingsFromSubmissions(value: unknown): Filing[] {
  const recent = (value as { filings?: { recent?: Record<string, unknown[]> } })?.filings?.recent;
  if (!recent) return [];
  const seen = new Set<string>();
  return (recent.accessionNumber ?? []).flatMap((accession, index) => {
    const form = String(recent.form?.[index] ?? '');
    const filingDate = String(recent.filingDate?.[index] ?? '');
    const reportDate = String(recent.reportDate?.[index] ?? '');
    if (!['13F-HR', '13F-HR/A'].includes(form) || !accession || !/^\d{4}-\d{2}-\d{2}$/.test(filingDate) || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return [];
    const key = `${accession}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      accession: String(accession),
      form: form as Filing['form'],
      filingDate,
      acceptedAt: normalizeSecAcceptanceTimestamp(recent.acceptanceDateTime?.[index], filingDate),
      reportDate,
    }];
  }).slice(0, 8);
}

async function findFilingDocuments(base: string): Promise<{ url: string; xml: string; coverXml: string }> {
  const indexResponse = await fetchUpstream(`${base}/index.json`, { headers: SEC_HEADERS });
  if (!indexResponse.ok) throw new Error(`SEC archive index ${indexResponse.status}`);
  const index = await indexResponse.json() as { directory?: { item?: Array<{ name?: string; type?: string }> } };
  const candidates = (index.directory?.item ?? [])
    .filter(item => /\.xml$/i.test(item.name ?? ''))
    .sort((a, b) => Number(/info|table/i.test(b.name ?? '')) - Number(/info|table/i.test(a.name ?? '')));
  let informationTable: { url: string; xml: string; rowCount: number } | null = null;
  let coverXml = '';
  for (const candidate of candidates) {
    const url = `${base}/${encodeURIComponent(candidate.name!)}`;
    const response = await fetchUpstream(url, { headers: SEC_HEADERS });
    if (!response.ok) continue;
    const xml = await response.text();
    if (is13FInformationTable(xml)) {
      const rowCount = parseForm13FInformationTable(xml).length;
      if (!informationTable || rowCount > informationTable.rowCount
        || (rowCount === informationTable.rowCount && xml.length > informationTable.xml.length)) {
        informationTable = { url, xml, rowCount };
      }
    } else coverXml += `\n${xml}`;
    await pause(120);
  }
  if (informationTable) return { url: informationTable.url, xml: informationTable.xml, coverXml };
  throw new Error('SEC filing has no readable 13F information table');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  const expected = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  if (!expected || req.headers.get('x-dispatch-secret') !== expected) return json({ error: 'Unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Service configuration unavailable' }, 503);
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Math.max(Number(body.batch_size) || 5, 1), 25);
  const { data: targets, error } = await supabase.rpc('institutional_13f_poll_targets', { batch_size: batchSize });
  if (error) return json({ error: 'Could not read 13F poll targets' }, 500);
  const results: Array<Record<string, unknown>> = [];

  for (const target of targets ?? []) {
    try {
      const submissions = await fetchUpstream(`https://data.sec.gov/submissions/CIK${target.cik}.json`, { headers: SEC_HEADERS });
      if (!submissions.ok) throw new Error(`SEC submissions ${submissions.status}`);
      const payload = await submissions.json() as { name?: string };
      const filings = filingsFromSubmissions(payload);
      let ingested = 0;
      for (const filing of filings.reverse()) {
        // A prior run may have written filing metadata and then failed before
        // its holdings batch. Only a real child row proves ingestion complete.
        const existing = await supabase.from('institutional_13f_holdings').select('id').eq('accession', filing.accession).limit(1);
        if (existing.data?.length) continue;
        const base = archiveBase(target.cik, filing.accession);
        const informationTable = await findFilingDocuments(base);
        const holdings = parseForm13FInformationTable(informationTable.xml);
        if (!holdings.length) throw new Error(`No valid holdings in ${filing.accession}`);
        const filingUrl = `${base}/${filing.accession}-index.html`;
        const totalValue = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
        const amendmentKind = filing.form === '13F-HR' ? 'original'
          : /<(?:\w+:)?isRestatement>\s*(?:true|1)\s*<\/(?:\w+:)?isRestatement>/i.test(informationTable.coverXml) ? 'restatement'
          : /<(?:\w+:)?isRestatement>\s*(?:false|0)\s*<\/(?:\w+:)?isRestatement>/i.test(informationTable.coverXml) ? 'additional_holdings'
          : 'unknown';
        const { error: filingError } = await supabase.from('institutional_13f_filings').upsert({
          accession: filing.accession, manager_cik: target.cik, form: filing.form,
          report_period: filing.reportDate, filed_at: filing.acceptedAt, filing_url: filingUrl,
          information_table_url: informationTable.url, holding_count: holdings.length,
          total_value_usd: totalValue, is_amendment: filing.form.endsWith('/A'), amendment_kind: amendmentKind,
        }, { onConflict: 'accession' });
        if (filingError) throw filingError;
        const { error: holdingsError } = await supabase.from('institutional_13f_holdings').upsert(holdings.map(holding => ({
          accession: filing.accession, line_index: holding.lineIndex, manager_cik: target.cik,
          report_period: filing.reportDate, issuer_name: holding.issuerName, title_of_class: holding.titleOfClass,
          cusip: holding.cusip, figi: holding.figi, value_usd: holding.valueUsd,
          shares_or_principal: holding.sharesOrPrincipal, shares_or_principal_type: holding.sharesOrPrincipalType,
          put_call: holding.putCall, investment_discretion: holding.investmentDiscretion,
          voting_sole: holding.votingSole, voting_shared: holding.votingShared, voting_none: holding.votingNone,
        })), { onConflict: 'accession,line_index', ignoreDuplicates: true });
        if (holdingsError) throw holdingsError;
        ingested++;
        await pause(250);
      }
      await supabase.rpc('refresh_institutional_security_map');
      await supabase.from('institutional_managers').update({
        name: payload.name ?? target.display_name, last_checked_at: new Date().toISOString(),
        last_error: null, consecutive_failures: 0, updated_at: new Date().toISOString(),
      }).eq('cik', target.cik);
      results.push({ manager: target.display_name, outcome: 'ok', filings: filings.length, ingested });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown error';
      const prior = await supabase.from('institutional_managers').select('consecutive_failures').eq('cik', target.cik).maybeSingle();
      await supabase.from('institutional_managers').update({
        last_checked_at: new Date().toISOString(), last_error: message.slice(0, 500),
        consecutive_failures: (prior.data?.consecutive_failures ?? 0) + 1, updated_at: new Date().toISOString(),
      }).eq('cik', target.cik);
      results.push({ manager: target.display_name, outcome: 'failed', error: message });
    }
    await pause(350);
  }
  return json({ processed: results.length, results });
});
