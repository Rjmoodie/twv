/**
 * The thing that notices.
 *
 * Company Story could only ever advance when the user went and looked: they
 * clicked, we read the newest filing, the card updated. Nobody was watching on
 * their behalf. This runs on a schedule, reads the newest 10-K/10-Q for every
 * narratively tracked ticker, and grades it per watcher.
 *
 * Two rules shape the whole function:
 *
 *   - The filing is read once per ticker, not once per watcher. The extraction
 *     is expensive and the filing is the same evidence for everyone, so it goes
 *     through the shared company_narrative_cache the on-demand path already
 *     fills -- which also means a user who clicks after a poll pays nothing.
 *   - Grading is per watcher, because the bar depends on their mode and on
 *     what they personally wrote down as thesis-breaking.
 *
 * Whether a graded filing is worth interrupting anyone for is decided in
 * _shared/storyAlerts.ts. This function does the fetching and the bookkeeping.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CORS_HEADERS } from '../_shared/cors.ts';
import { extractMdaSection, htmlToText, recentFilingCandidates } from '../_shared/secNarrative.ts';
import {
  analyzeSection,
  filingDocumentUrl,
  NARRATIVE_ANALYSIS_VERSION,
  SEC_HEADERS,
} from '../_shared/narrativeExtraction.ts';
import { isStoredClaim, type NarrativeClaim } from '../_shared/narrativeClaim.ts';
import {
  buildStoryAlertRows,
  filingSkipReason,
  isEntitledToStoryAlerts,
  type AlertFiling,
  type StoryWatcher,
} from '../_shared/storyAlerts.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

/** SEC asks for well under 10 requests a second; one company at a time stays far inside that. */
const SEC_PAUSE_MS = 350;
/** A filing older than this is history, not news -- see filingSkipReason. */
const MAX_FILING_AGE_DAYS = 30;
const DEFAULT_BATCH = 10;

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface PollTarget {
  ticker: string;
  cik: string;
  watcher_count: number;
  last_accession: string | null;
}

type Outcome = 'alerted' | 'routine' | 'unchanged' | 'baseline' | 'stale' | 'no_filing' | 'no_claims' | 'failed';

interface TickerResult {
  ticker: string;
  outcome: Outcome;
  enqueued?: number;
  error?: string;
}

async function secFetch(url: string): Promise<Response> {
  const response = await fetch(url, { headers: SEC_HEADERS });
  // 429 is transient and per-run: fail this ticker, let the next tick retry it.
  if (!response.ok) throw new Error(`SEC request failed (${response.status})`);
  return response;
}

/**
 * The claims for a filing, from the shared cache when another user (or an
 * earlier run) already paid for them. Returns null when the filing cannot be
 * read well enough to extract anything citation-verifiable.
 */
async function claimsForFiling(
  supabase: SupabaseClient,
  apiKey: string,
  ticker: string,
  filing: { form: string; accession: string; filingDate: string; reportDate: string | null; documentUrl: string },
): Promise<NarrativeClaim[] | null> {
  const { data: cached } = await supabase
    .from('company_narrative_cache')
    .select('claims')
    .eq('ticker', ticker)
    .eq('accession_number', filing.accession)
    .eq('analysis_version', NARRATIVE_ANALYSIS_VERSION)
    .maybeSingle();
  const cachedClaims = Array.isArray(cached?.claims) ? cached.claims.filter(isStoredClaim) : [];
  if (cachedClaims.length) return cachedClaims;

  const document = await secFetch(filing.documentUrl);
  const section = extractMdaSection(htmlToText(await document.text()), filing.form);
  // A filing whose MD&A cannot be isolated is not one we can quote from, and
  // an alert without a verbatim excerpt is exactly what this feature refuses
  // to send.
  if (!section) return null;

  const claims = await analyzeSection(apiKey, ticker, filing.form, section);
  if (!claims.length) return null;

  const { error } = await supabase.from('company_narrative_cache').upsert({
    ticker,
    accession_number: filing.accession,
    analysis_version: NARRATIVE_ANALYSIS_VERSION,
    form: filing.form,
    filing_date: filing.filingDate,
    report_date: filing.reportDate,
    document_url: filing.documentUrl,
    claims,
  }, { onConflict: 'ticker,accession_number,analysis_version', ignoreDuplicates: true });
  if (error) console.error('narrative cache write failed', ticker, error.message);
  return claims;
}

async function recordPollState(
  supabase: SupabaseClient,
  ticker: string,
  state: { accession?: string | null; filingDate?: string | null; error?: string | null; failed?: boolean },
) {
  // A run that failed adds to the count; any run that did not resets it. The
  // point of the column is to show a company that has been failing for a week,
  // which a flat 0-or-1 would hide.
  let failures = 0;
  if (state.failed) {
    const { data: prior } = await supabase
      .from('watchlist_story_poll_state')
      .select('consecutive_failures')
      .eq('ticker', ticker)
      .maybeSingle();
    failures = (prior?.consecutive_failures ?? 0) + 1;
  }

  const { error } = await supabase.from('watchlist_story_poll_state').upsert({
    ticker,
    ...(state.accession !== undefined ? { last_accession: state.accession } : {}),
    ...(state.filingDate !== undefined ? { last_filing_date: state.filingDate } : {}),
    last_checked_at: new Date().toISOString(),
    last_error: state.error ?? null,
    consecutive_failures: failures,
  }, { onConflict: 'ticker' });
  if (error) console.error('poll state write failed', ticker, error.message);
}

async function pollTicker(
  supabase: SupabaseClient,
  apiKey: string,
  target: PollTarget,
): Promise<TickerResult> {
  const submissions = await secFetch(`https://data.sec.gov/submissions/CIK${target.cik}.json`);
  const candidate = recentFilingCandidates(await submissions.json())[0];
  if (!candidate) {
    await recordPollState(supabase, target.ticker, {});
    return { ticker: target.ticker, outcome: 'no_filing' };
  }

  const skip = filingSkipReason({
    accession: candidate.accessionNumber,
    filingDate: candidate.filingDate,
    priorAccession: target.last_accession,
    now: new Date(),
    maxAgeDays: MAX_FILING_AGE_DAYS,
  });
  if (skip) {
    // Recorded either way, so a baseline or stale filing is `unchanged` next
    // run and the ticker stops being re-read.
    await recordPollState(supabase, target.ticker, {
      accession: candidate.accessionNumber,
      filingDate: candidate.filingDate,
    });
    return { ticker: target.ticker, outcome: skip };
  }

  const filing = {
    form: candidate.form,
    accession: candidate.accessionNumber,
    filingDate: candidate.filingDate,
    reportDate: candidate.reportDate,
    documentUrl: filingDocumentUrl(target.cik, candidate.accessionNumber, candidate.primaryDocument),
  };
  const claims = await claimsForFiling(supabase, apiKey, target.ticker, filing);
  if (!claims) {
    await recordPollState(supabase, target.ticker, {
      accession: filing.accession,
      filingDate: filing.filingDate,
      error: 'no citation-verifiable claims could be extracted',
    });
    return { ticker: target.ticker, outcome: 'no_claims' };
  }

  const { data: watcherRows, error: watcherError } = await supabase
    .rpc('watchlist_story_watchers', { p_ticker: target.ticker });
  if (watcherError) throw new Error(`watchers unavailable: ${watcherError.message}`);
  const watchers = (watcherRows ?? []) as StoryWatcher[];

  // Every entitled watcher's card gets the new filing, whatever the alert bar
  // decides. The "New" badge is the low-cost half of this feature: it costs a
  // glance, so it does not have to clear the bar that sending something does.
  // A lapsed watcher is left alone -- a badge they cannot open is worse than
  // no badge at all.
  const entitled = watchers.filter(isEntitledToStoryAlerts);
  if (entitled.length) {
    const { error: storyError } = await supabase
      .from('watchlist')
      .update({ story_updated_at: new Date().toISOString(), story_summary: claims[0].headline })
      .in('id', entitled.map(watcher => watcher.watchlist_id));
    if (storyError) console.error('story timestamp update failed', target.ticker, storyError.message);
  }

  const alertFiling: AlertFiling = {
    form: filing.form,
    accession: filing.accession,
    filingDate: filing.filingDate,
    documentUrl: filing.documentUrl,
  };
  const rows = buildStoryAlertRows({ ticker: target.ticker, filing: alertFiling, claims, watchers });

  let enqueued = 0;
  if (rows.length) {
    // Through the function, not a PostgREST upsert: the dedupe index is
    // partial and only real SQL can repeat its predicate.
    const { data, error } = await supabase.rpc('enqueue_story_alerts', { p_alerts: rows });
    if (error) throw new Error(`enqueue failed: ${error.message}`);
    enqueued = typeof data === 'number' ? data : 0;
  }

  await recordPollState(supabase, target.ticker, {
    accession: filing.accession,
    filingDate: filing.filingDate,
  });
  // A new filing that cleared nobody's bar is the common case, and the run
  // report should say so rather than reporting an alert that never went out.
  return { ticker: target.ticker, outcome: enqueued > 0 ? 'alerted' : 'routine', enqueued };
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  // Same shared secret as the dispatcher: both are cron-only endpoints with no
  // user session, and one secret to rotate is better than two to forget.
  const expected = Deno.env.get('NOTIFICATION_DISPATCH_SECRET');
  if (!expected || req.headers.get('x-dispatch-secret') !== expected) return json({ error: 'Unauthorized' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!url || !serviceKey) return json({ error: 'Service configuration unavailable' }, 503);
  if (!apiKey) return json({ error: 'Qualitative-analysis provider is not configured' }, 503);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const batchSize = Math.min(Math.max(Number(body?.batch_size) || DEFAULT_BATCH, 1), 50);

  const { data: targets, error } = await supabase.rpc('watchlist_story_poll_targets', { batch_size: batchSize });
  if (error) {
    console.error('poll targets unavailable', error.message);
    return json({ error: 'Could not read the poll list' }, 500);
  }

  const results: TickerResult[] = [];
  for (const target of (targets ?? []) as PollTarget[]) {
    try {
      results.push(await pollTicker(supabase, apiKey, target));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'unknown failure';
      console.error('story poll failed', target.ticker, message);
      // One company's bad filing, or a rate limit, must not end the run for
      // everyone behind it in the batch.
      await recordPollState(supabase, target.ticker, {
        error: message.slice(0, 300),
        failed: true,
      });
      results.push({ ticker: target.ticker, outcome: 'failed', error: message.slice(0, 200) });
    }
    await pause(SEC_PAUSE_MS);
  }

  const enqueued = results.reduce((total, result) => total + (result.enqueued ?? 0), 0);
  return json({ polled: results.length, enqueued, results });
});
