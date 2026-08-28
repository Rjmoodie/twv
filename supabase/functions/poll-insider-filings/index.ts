import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { SEC_HEADERS } from '../_shared/narrativeExtraction.ts';
import { closestPriorMarketClose, isSuspectForm4Price, parseForm4DocumentMetadata, parseForm4Xml } from '../_shared/form4.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
});
const UPSTREAM_TIMEOUT_MS = 12_000;
const fetchUpstream = (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1] = {}) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const archiveUrl = (cik: string, accession: string, document: string) =>
  `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replace(/-/g, '')}/${encodeURIComponent(document)}`;

interface Filing {
  accession: string;
  filingDate: string;
  acceptedAt: string;
  document: string;
  form: '4' | '4/A';
}

const acceptedAt = (value: unknown, filingDate: string): string => {
  const candidate = String(value ?? '').trim();
  // SEC submissions commonly encode acceptanceDateTime as YYYYMMDDHHMMSS.
  // Date.parse is implementation-dependent for that compact form, so expand
  // it explicitly and validate the round trip before falling back.
  if (/^\d{14}$/.test(candidate)) {
    const expanded = `${candidate.slice(0, 4)}-${candidate.slice(4, 6)}-${candidate.slice(6, 8)}T${candidate.slice(8, 10)}:${candidate.slice(10, 12)}:${candidate.slice(12, 14)}Z`;
    const compactParsed = new Date(expanded);
    if (Number.isFinite(compactParsed.getTime())
      && compactParsed.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14) === candidate) {
      return compactParsed.toISOString();
    }
  }
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : `${filingDate}T00:00:00Z`;
};

function form4Filings(value: unknown): Filing[] {
  const recent = (value as { filings?: { recent?: Record<string, unknown[]> } })?.filings?.recent;
  if (!recent) return [];
  return (recent.accessionNumber ?? []).flatMap((accession, index) => {
    const form = String(recent.form?.[index] ?? '');
    const filingDate = String(recent.filingDate?.[index] ?? '');
    const document = String(recent.primaryDocument?.[index] ?? '');
    if (!/^4(?:\/A)?$/.test(form) || !accession || !document || !/^\d{4}-\d{2}-\d{2}$/.test(filingDate)) return [];
    return [{
      accession: String(accession),
      filingDate,
      acceptedAt: acceptedAt(recent.acceptanceDateTime?.[index], filingDate),
      document,
      form: form as '4' | '4/A',
    }];
  });
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
  const batchSize = Math.min(Math.max(Number(body.batch_size) || 10, 1), 50);
  const { data: targets, error } = await supabase.rpc('insider_poll_targets', { batch_size: batchSize });
  if (error) return json({ error: 'Could not read insider poll targets' }, 500);

  const results: Array<Record<string, unknown>> = [];
  for (const target of targets ?? []) {
    const parsedAlertsFrom = target.alerts_from ? new Date(target.alerts_from) : new Date();
    const alertsFrom = Number.isFinite(parsedAlertsFrom.getTime()) ? parsedAlertsFrom : new Date();
    try {
      const [{ data: analysisCache }, { data: historyCache }] = await Promise.all([
        supabase.from('stock_analysis_cache').select('fundamentals').eq('ticker', target.ticker).maybeSingle(),
        supabase.from('stock_price_history_cache').select('series').eq('ticker', target.ticker).maybeSingle(),
      ]);
      const marketCap = Number(analysisCache?.fundamentals?.profile?.marketCapitalization) || null;
      const closes = new Map<string, number>((Array.isArray(historyCache?.series) ? historyCache.series : [])
        .flatMap((point: unknown) => {
          const row = point as { date?: unknown; close?: unknown };
          const close = Number(row.close);
          return typeof row.date === 'string' && Number.isFinite(close) && close > 0 ? [[row.date, close] as [string, number]] : [];
        }));
      const response = await fetchUpstream(`https://data.sec.gov/submissions/CIK${String(target.cik).padStart(10, '0')}.json`, { headers: SEC_HEADERS });
      if (!response.ok) throw new Error(`SEC submissions ${response.status}`);
      const cutoff = Date.now() - 366 * 86_400_000;
      const filings = form4Filings(await response.json()).filter(filing => new Date(filing.filingDate).getTime() >= cutoff);
      const existing = await supabase.from('insider_filings')
        .select('accession,form,parser_version').eq('ticker', target.ticker)
        .gte('filed_at', new Date(cutoff).toISOString());
      if (existing.error) throw existing.error;
      const ingested = new Map<string, { form?: string; parser_version?: number }>(
        (existing.data ?? []).map(row => [row.accession, row]),
      );
      let storedRows = 0;
      let processedFilings = 0;
      const alertableAccessions = new Set<string>();
      for (const filing of filings.reverse()) {
        const prior = ingested.get(filing.accession);
        if (prior?.form === filing.form && Number(prior.parser_version) >= 2) continue;
        const filingUrl = archiveUrl(target.cik, filing.accession, filing.document);
        const document = await fetchUpstream(filingUrl, { headers: SEC_HEADERS });
        if (!document.ok) throw new Error(`SEC ownership document ${document.status}`);
        const xml = await document.text();
        const metadata = parseForm4DocumentMetadata(xml);
        const rows = parseForm4Xml(xml).map(row => ({
          ...row,
          priceSuspect: isSuspectForm4Price(row.shares, row.pricePerShare, {
            close: closestPriorMarketClose(closes, row.transactionDate), marketCap,
          }),
        }));
        if (rows.length) {
          const payload = rows.map(row => ({
            ticker: target.ticker, cik: String(target.cik).padStart(10, '0'), accession: filing.accession,
            form: filing.form, is_amendment: filing.form === '4/A',
            actor_key: row.actorKey, joint_filing: row.jointFiling,
            line_index: row.lineIndex, owner_cik: row.ownerCik, owner_name: row.ownerName,
            officer_title: row.officerTitle, is_officer: row.isOfficer, is_director: row.isDirector,
            is_ten_percent_owner: row.isTenPercentOwner, transaction_date: row.transactionDate,
            transaction_code: row.transactionCode, classification: row.classification,
            acquired_disposed: row.acquiredDisposed, shares: row.shares, price_per_share: row.pricePerShare,
            shares_owned_after: row.sharesOwnedAfter, filed_at: filing.acceptedAt,
            filing_url: filingUrl, plan_10b5_1: row.plan10b51, price_suspect: row.priceSuspect,
          }));
          const { data, error: insertError } = await supabase.from('insider_transactions')
            .upsert(payload, { onConflict: 'accession,owner_cik,line_index' }).select('id');
          if (insertError) throw insertError;
          storedRows += data?.length ?? 0;
          if (filing.form === '4' && new Date(filing.acceptedAt) >= alertsFrom
            && rows.some(row => row.classification === 'open_market_purchase' && !row.priceSuspect)) {
            alertableAccessions.add(filing.accession);
          }
        }
        const filingRecord = await supabase.from('insider_filings').upsert({
          accession: filing.accession,
          ticker: target.ticker,
          cik: String(target.cik).padStart(10, '0'),
          form: filing.form,
          filed_at: filing.acceptedAt,
          filing_url: filingUrl,
          is_amendment: filing.form === '4/A',
          actor_key: metadata.actorKey,
          joint_filing: metadata.jointFiling,
          period_of_report: metadata.periodOfReport,
          original_submission_date: metadata.originalSubmissionDate,
          row_count: rows.length,
          parser_version: 2,
        }, { onConflict: 'accession' });
        if (filingRecord.error) throw filingRecord.error;
        // A header-only amendment can withdraw/supersede an earlier filing, so
        // amendment resolution must run even when the amended document has no
        // reportable transaction rows.
        if (filing.form === '4/A') {
          const amendment = await supabase.rpc('apply_form4_amendment', {
            p_ticker: target.ticker,
            p_accession: filing.accession,
          });
          if (amendment.error) throw amendment.error;
        }
        processedFilings++;
        await pause(125);
      }
      let enqueued = 0;
      if (target.alerts_from) {
        for (const accession of alertableAccessions) {
          const alert = await supabase.rpc('enqueue_insider_buy_alerts', {
            p_ticker: target.ticker,
            p_first_accession: accession,
          });
          if (alert.error) throw alert.error;
          enqueued += Number(alert.data) || 0;
        }
      }
      await supabase.from('insider_poll_state').upsert({ ticker: target.ticker, alerts_from: target.alerts_from ?? alertsFrom.toISOString(), last_checked_at: new Date().toISOString(), last_error: null, consecutive_failures: 0 });
      results.push({
        ticker: target.ticker,
        outcome: target.alerts_from ? 'polled' : 'baseline',
        filings: filings.length,
        processed_filings: processedFilings,
        stored_rows: storedRows,
        enqueued,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown error';
      const prior = await supabase.from('insider_poll_state').select('consecutive_failures').eq('ticker', target.ticker).maybeSingle();
      await supabase.from('insider_poll_state').upsert({ ticker: target.ticker, alerts_from: target.alerts_from ?? alertsFrom.toISOString(), last_checked_at: new Date().toISOString(), last_error: message.slice(0, 500), consecutive_failures: (prior.data?.consecutive_failures ?? 0) + 1 });
      results.push({ ticker: target.ticker, outcome: 'failed', error: message });
    }
    await pause(250);
  }
  return json({ processed: results.length, results });
});
