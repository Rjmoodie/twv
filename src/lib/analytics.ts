/**
 * Analytics
 *
 * Replaces the previous situation, in which the only `capture()` in the
 * codebase was a `console.log` stub inside an unreachable module — so no
 * product question could be answered from data.
 *
 * Deliberately vendor-neutral. The module owns the event taxonomy and the
 * call sites; a sink is installed once at startup. Until one is installed the
 * module is a safe no-op (it buffers a short tail for debugging), so wiring
 * call sites is never blocked on choosing a vendor.
 *
 *   import { setAnalyticsSink } from '@/lib/analytics'
 *   setAnalyticsSink((e, props) => posthog.capture(e, props))
 */

// ─── Event taxonomy ──────────────────────────────────────────────────────────
//
// Named after the growth questions they exist to answer. Adding a member here
// is the only way to emit an event — a typo becomes a compile error rather
// than a silently-missing metric, which is how `analytics-event-name-drift`
// happens.

export type AnalyticsEvent =
  // Activation — does anyone reach value?
  | 'journey_started'
  | 'journey_completed'
  | 'calculator_run'
  | 'onboarding_completed'
  // Loop — does the product reproduce itself?
  | 'moment_shared'
  | 'moment_share_opened'
  | 'community_feed_viewed'
  // Monetisation — where does the paywall bite?
  | 'gate_encountered'
  | 'upgrade_started'
  // Portfolio loop — are people returning to operate and communicate?
  | 'portfolio_viewed'
  | 'portfolio_view_toggled'
  | 'portfolio_action_completed'
  | 'project_invitation_created'
  | 'crm_contact_created'
  | 'crm_activity_created'
  | 'crm_task_completed'
  // Trust — did we show a number nobody could use?
  | 'valuation_unavailable';

export interface AnalyticsProps {
  [key: string]: string | number | boolean | null | undefined;
}

type Sink = (event: AnalyticsEvent, props: AnalyticsProps) => void;

let sink: Sink | null = null;

/** Recent events, kept only to make "is this wired?" answerable in a console. */
const buffer: Array<{ event: AnalyticsEvent; props: AnalyticsProps; at: string }> = [];
const BUFFER_LIMIT = 50;

export function setAnalyticsSink(next: Sink | null): void {
  sink = next;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  const enriched: AnalyticsProps = {
    ...props,
    // Session-scoped so funnels can be reconstructed without identifying anyone.
    session_id: getSessionId(),
  };

  buffer.push({ event, props: enriched, at: new Date().toISOString() });
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  if (!sink) return;
  try {
    sink(event, enriched);
  } catch {
    // Analytics must never break a user flow.
  }
}

/** The recent event tail — for debugging instrumentation, not for product logic. */
export function recentEvents(): ReadonlyArray<{ event: AnalyticsEvent; props: AnalyticsProps; at: string }> {
  return buffer;
}

// ─── Session id ──────────────────────────────────────────────────────────────

const SESSION_KEY = 'tw-analytics-session';
let cachedSessionId: string | null = null;

function getSessionId(): string {
  if (cachedSessionId) return cachedSessionId;
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      cachedSessionId = existing;
      return existing;
    }
    const created = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(SESSION_KEY, created);
    cachedSessionId = created;
    return created;
  } catch {
    // Private browsing / blocked storage — fall back to an in-memory id.
    cachedSessionId = cachedSessionId ?? `s_mem_${Math.random().toString(36).slice(2, 10)}`;
    return cachedSessionId;
  }
}
