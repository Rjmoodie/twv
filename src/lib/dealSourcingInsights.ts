/**
 * dealSourcingInsights.ts
 *
 * Pure, memoisation-friendly utilities for the Deal Sourcing cockpit.
 * No React, no side-effects — just data-in / insight-out.
 */

import {
  ProcessedProperty,
  SOURCE_META,
  SourceId,
  ImplementationStatus,
} from "@/services/free-data-sources-implementation";

// ── Shared filter type (exported so component can import it) ──────────────────

export interface ServerFilters {
  search:         string;
  sources:        string[];
  leadTypes:      string[];
  severity:       string[];
  distressedOnly: boolean;
}

export const DEFAULT_SERVER_FILTERS: ServerFilters = {
  search:         "",
  sources:        [],
  leadTypes:      [],
  severity:       [],
  distressedOnly: false,
};

export const LEAD_TYPE_LABELS: Record<string, string> = {
  code_violation:  "Code Violation",
  tax_delinquent:  "Tax Delinquent",
  pre_foreclosure: "Pre-Foreclosure",
  reo:             "REO / Bank-Owned",
  vacant:          "Vacant",
  probate:         "Probate",
  eviction:        "Eviction Filing",
};

// ── Score ─────────────────────────────────────────────────────────────────────

export interface LeadScore {
  score:   number;
  label:   "High Priority" | "Promising" | "Needs Review" | "Low Signal";
  reasons: string[];
}

export function scoreLead(lead: ProcessedProperty): LeadScore {
  let s = 0;
  const reasons: string[] = [];

  // Severity
  if (lead.severity === "high")   { s += 25; reasons.push("High severity signal"); }
  else if (lead.severity === "medium") { s += 12; reasons.push("Medium severity signal"); }

  // Distressed flag
  if (lead.is_distressed) { s += 20; reasons.push("Distressed property flag"); }

  // Lead type premium
  const premiumTypes = ["pre_foreclosure", "tax_delinquent", "reo"];
  const goodTypes    = ["code_violation", "eviction"];
  const typeLabel    = LEAD_TYPE_LABELS[lead.lead_type] ?? lead.lead_type;
  if (premiumTypes.includes(lead.lead_type)) { s += 15; reasons.push(`${typeLabel} (high-value type)`); }
  else if (goodTypes.includes(lead.lead_type)) { s += 8; reasons.push(`${typeLabel} signal`); }

  // Property value
  if (lead.property_value != null) { s += 10; reasons.push("Property value available"); }

  // Incident date recency
  if (lead.incident_date) {
    const daysAgo = (Date.now() - new Date(lead.incident_date).getTime()) / 86_400_000;
    if (daysAgo < 30)  { s += 10; reasons.push("Very recent incident (< 30 days)"); }
    else if (daysAgo < 90) { s += 5; reasons.push("Recent incident (< 90 days)"); }
  }

  // Owner name
  if (lead.owner_name) { s += 5; reasons.push("Owner name available"); }

  // Source URL
  if (lead.source_url) { s += 5; reasons.push("Source link available"); }

  // Multiple tags = cross-signal
  if (lead.tags.length > 1) { s += 5; reasons.push("Multiple distress signals"); }

  // Penalties for missing critical data
  if (!lead.property_address) s -= 10;
  if (!lead.city)              s -= 5;

  s = Math.max(0, Math.min(100, s));

  let label: LeadScore["label"];
  if      (s >= 75) label = "High Priority";
  else if (s >= 50) label = "Promising";
  else if (s >= 25) label = "Needs Review";
  else              label = "Low Signal";

  return { score: s, label, reasons };
}

export type ScoredLead = { lead: ProcessedProperty; score: LeadScore };

// Score badge colour classes (Tailwind)
export function scoreBadgeClasses(score: number): string {
  if (score >= 75) return "bg-destructive/10 text-destructive border-destructive/20";
  if (score >= 50) return "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400";
  if (score >= 25) return "bg-muted border-border/50 text-muted-foreground";
  return "bg-muted/40 border-border/30 text-muted-foreground/50";
}

// ── Why it matters ────────────────────────────────────────────────────────────

export function explainLead(lead: ProcessedProperty): string {
  const prefix = lead.is_distressed
    ? "This is a flagged distressed property. "
    : "";

  switch (lead.lead_type) {
    case "reo":
      return `${prefix}This is a bank-owned (REO) property. It may be worth reviewing for investor acquisition or wholesale opportunities.`;
    case "tax_delinquent":
      return `${prefix}Tax delinquency may indicate financial pressure on the owner. Confirm current tax status and ownership before outreach.`;
    case "pre_foreclosure":
      return `${prefix}This property is in pre-foreclosure, suggesting the owner may be under pressure. Verify status carefully before contact.`;
    case "code_violation":
      if (lead.severity === "high")
        return `${prefix}A high-severity code violation may signal deferred maintenance or an owner struggling to keep up. Could indicate motivation to sell.`;
      return `${prefix}This property has an open code violation. The severity level affects how urgently the owner may be looking for relief.`;
    case "eviction":
      return `${prefix}An eviction filing may indicate a landlord dealing with difficult tenants or considering exiting the rental market.`;
    case "vacant":
      return `${prefix}Vacant properties can signal distressed ownership, an estate situation, or an absentee owner open to offers.`;
    case "probate":
      return `${prefix}Probate properties often involve heirs who may prefer a quick sale over managing an inherited asset.`;
    default:
      if (lead.is_distressed)
        return "This property shows distress signals from public records. Verify ownership and situation before outreach.";
      return "This lead comes from a free public data source. Review the source record to understand the current situation.";
  }
}

// ── Recommended action ────────────────────────────────────────────────────────

export interface LeadAction {
  label:    "Analyze deal" | "Verify ownership" | "Check comps" | "Export for outreach" | "Review source" | "Skip for now";
  type:     "analyze" | "verify" | "comps" | "export" | "review" | "skip";
  priority: "high" | "medium" | "low";
  reason:   string;
}

export function recommendAction(lead: ProcessedProperty, score: number): LeadAction {
  if (score >= 65 && lead.property_value != null)
    return { label: "Analyze deal", type: "analyze", priority: "high",
      reason: "High-priority signal with property value available for deal modelling." };
  if (!lead.owner_name && score >= 40)
    return { label: "Verify ownership", type: "verify", priority: "medium",
      reason: "Owner name missing — confirm via county records before outreach." };
  if (lead.property_value != null && score >= 40)
    return { label: "Check comps", type: "comps", priority: "medium",
      reason: "Property value exists but deal potential needs a market comparison." };
  if (lead.owner_name && lead.property_address && lead.source_url)
    return { label: "Export for outreach", type: "export", priority: "medium",
      reason: "Address, owner name, and source link are all available." };
  if (score < 25)
    return { label: "Skip for now", type: "skip", priority: "low",
      reason: "Limited data available — may improve after the next data refresh." };
  return { label: "Review source", type: "review", priority: "low",
    reason: "Check the source record for additional context." };
}

// ── Sourcing summary ──────────────────────────────────────────────────────────

export interface SourcingSummary {
  totalLeads:        number;
  highPriorityLeads: number;
  distressedLeads:   number;
  avgPropertyValue:  number | null;
  ownerReadyLeads:   number;
  topSource:         { source: string; label: string; count: number } | null;
  topMarket:         { city: string; state: string; hpCount: number } | null;
  lastRefreshedAt:   string | null;
  freshnessLabel:    "Fresh" | "Aging" | "Stale" | "Unknown";
  qualityLabel:      "Strong" | "Moderate" | "Weak" | "Unknown";
}

export function deriveSummary(
  scored: ScoredLead[],
  sourceBreakdown?: ImplementationStatus["sourceBreakdown"]
): SourcingSummary {
  const empty: SourcingSummary = {
    totalLeads: 0, highPriorityLeads: 0, distressedLeads: 0,
    avgPropertyValue: null, ownerReadyLeads: 0,
    topSource: null, topMarket: null,
    lastRefreshedAt: null, freshnessLabel: "Unknown", qualityLabel: "Unknown",
  };
  if (!scored.length) return empty;

  let hpCount = 0, distressedCount = 0, valueSum = 0, valueCount = 0, ownerReady = 0;
  const sourceCounts: Record<string, number> = {};
  const marketMap: Record<string, { city: string; state: string; count: number; hpCount: number }> = {};

  for (const { lead, score } of scored) {
    if (score.score >= 75) hpCount++;
    if (lead.is_distressed) distressedCount++;
    if (lead.property_value != null) { valueSum += lead.property_value; valueCount++; }
    if (lead.owner_name && lead.property_address && lead.source_url) ownerReady++;

    sourceCounts[lead.data_source] = (sourceCounts[lead.data_source] ?? 0) + 1;

    if (lead.city && lead.state) {
      const k = `${lead.city}|${lead.state}`;
      if (!marketMap[k]) marketMap[k] = { city: lead.city, state: lead.state, count: 0, hpCount: 0 };
      marketMap[k].count++;
      if (score.score >= 75) marketMap[k].hpCount++;
    }
  }

  const topSourceKey = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const topMarketEntry = Object.values(marketMap).sort((a, b) => b.hpCount - a.hpCount)[0];

  const lastRefreshedAt = sourceBreakdown?.reduce<string | null>((latest, s) => {
    if (!s.lastFetch) return latest;
    return !latest || s.lastFetch > latest ? s.lastFetch : latest;
  }, null) ?? null;

  let freshnessLabel: SourcingSummary["freshnessLabel"] = "Unknown";
  if (lastRefreshedAt) {
    const hours = (Date.now() - new Date(lastRefreshedAt).getTime()) / 3_600_000;
    if (hours < 6)  freshnessLabel = "Fresh";
    else if (hours < 48) freshnessLabel = "Aging";
    else freshnessLabel = "Stale";
  }

  const total = scored.length;
  const addrPct  = scored.filter(({ lead }) => lead.property_address).length / total;
  const ownerPct = scored.filter(({ lead }) => lead.owner_name).length / total;
  const avgQ = (addrPct * 0.5 + ownerPct * 0.5);
  const qualityLabel: SourcingSummary["qualityLabel"] =
    avgQ > 0.65 ? "Strong" : avgQ > 0.35 ? "Moderate" : "Weak";

  return {
    totalLeads:        total,
    highPriorityLeads: hpCount,
    distressedLeads:   distressedCount,
    avgPropertyValue:  valueCount > 0 ? Math.round(valueSum / valueCount) : null,
    ownerReadyLeads:   ownerReady,
    topSource: topSourceKey ? {
      source: topSourceKey,
      label: (SOURCE_META as Record<string, { label: string }>)[topSourceKey]?.label ?? topSourceKey,
      count: sourceCounts[topSourceKey],
    } : null,
    topMarket: topMarketEntry ?? null,
    lastRefreshedAt,
    freshnessLabel,
    qualityLabel,
  };
}

// ── Source health ─────────────────────────────────────────────────────────────

export interface SourceHealth {
  source:          string;
  label:           string;
  city:            string;
  state:           string;
  count:           number;
  hpCount:         number;
  lastFetchedAt:   string | null;
  status:          "healthy" | "aging" | "no-data" | "error";
  usefulnessScore: number;
  note:            string;
}

export function deriveAllSourceHealth(
  scored: ScoredLead[],
  sourceBreakdown?: ImplementationStatus["sourceBreakdown"]
): SourceHealth[] {
  return (Object.keys(SOURCE_META) as SourceId[]).map(id => {
    const meta    = SOURCE_META[id];
    const leads   = scored.filter(({ lead }) => lead.data_source === id);
    const count   = leads.length;
    const hpCount = leads.filter(({ score }) => score.score >= 75).length;
    const sbEntry = sourceBreakdown?.find(s => s.source === id);
    const lastFetchedAt = sbEntry?.lastFetch ?? null;

    let status: SourceHealth["status"] = "no-data";
    if (count > 0) {
      if (lastFetchedAt) {
        const hours = (Date.now() - new Date(lastFetchedAt).getTime()) / 3_600_000;
        status = hours < 48 ? "healthy" : "aging";
      } else {
        status = "healthy";
      }
    }

    // Usefulness: blend volume + hp ratio
    const hpRatio = count > 0 ? hpCount / count : 0;
    const usefulnessScore = Math.round(
      Math.min(100, (count / 10) * 0.4 + hpRatio * 100 * 0.6)
    );

    let note: string;
    if (count === 0)
      note = "No data yet. Refresh to pull leads from this source.";
    else if (hpCount === 0)
      note = `${count} leads, none high-priority yet. May improve with more data.`;
    else if (hpRatio > 0.25)
      note = `Strong source — ${hpCount} of ${count} leads are high-priority.`;
    else
      note = `${count} leads, ${hpCount} high-priority. Moderate signal strength.`;

    return { source: id, label: meta.label, city: meta.city, state: meta.state,
      count, hpCount, lastFetchedAt, status, usefulnessScore, note };
  });
}

// ── Lead mix ──────────────────────────────────────────────────────────────────

export interface LeadMixItem {
  type:    string;
  label:   string;
  count:   number;
  percent: number;
}

export function deriveLeadMix(leads: ProcessedProperty[]): LeadMixItem[] {
  if (!leads.length) return [];
  const counts: Record<string, number> = {};
  for (const l of leads) counts[l.lead_type] = (counts[l.lead_type] ?? 0) + 1;
  const total = leads.length;
  return Object.entries(counts)
    .map(([type, count]) => ({
      type, count,
      label: LEAD_TYPE_LABELS[type] ?? type,
      percent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

// ── Data confidence ───────────────────────────────────────────────────────────

export interface DataConfidence {
  score:       number;
  label:       "High" | "Medium" | "Low";
  addrPct:     number;
  ownerPct:    number;
  valuePct:    number;
  explanation: string;
}

export function deriveDataConfidence(leads: ProcessedProperty[]): DataConfidence {
  if (!leads.length)
    return { score: 0, label: "Low", addrPct: 0, ownerPct: 0, valuePct: 0, explanation: "No leads loaded." };

  const n         = leads.length;
  const addrPct   = Math.round(leads.filter(l => l.property_address).length / n * 100);
  const ownerPct  = Math.round(leads.filter(l => l.owner_name).length / n * 100);
  const valuePct  = Math.round(leads.filter(l => l.property_value != null).length / n * 100);
  const datePct   = Math.round(leads.filter(l => l.incident_date).length / n * 100);
  const srcPct    = Math.round(leads.filter(l => l.source_url).length / n * 100);

  const score = Math.round(
    addrPct  * 0.30 +
    ownerPct * 0.25 +
    valuePct * 0.20 +
    datePct  * 0.15 +
    srcPct   * 0.10
  );

  const label: DataConfidence["label"] = score >= 65 ? "High" : score >= 40 ? "Medium" : "Low";

  const weakest = ownerPct < 40
    ? `Only ${ownerPct}% of leads include owner names.`
    : valuePct < 40
    ? `Only ${valuePct}% include property value estimates.`
    : `Data is reasonably complete across key fields.`;

  return {
    score, label, addrPct, ownerPct, valuePct,
    explanation: `Addresses: ${addrPct}% · Owners: ${ownerPct}% · Values: ${valuePct}%. ${weakest}`,
  };
}

// ── Smart presets ─────────────────────────────────────────────────────────────

export type SmartPreset =
  | "high-priority"
  | "owner-pressure"
  | "bank-owned"
  | "fresh-leads"
  | "export-ready"
  | "needs-verification";

export interface PresetConfig {
  id:          SmartPreset;
  label:       string;
  description: string;
}

export const SMART_PRESETS: PresetConfig[] = [
  { id: "high-priority",       label: "High Priority",      description: "Distressed + high severity" },
  { id: "owner-pressure",      label: "Owner Pressure",     description: "Tax delinquent or code violation" },
  { id: "bank-owned",          label: "Bank-Owned",         description: "REO leads only" },
  { id: "fresh-leads",         label: "Fresh Leads",        description: "Incident within last 30 days" },
  { id: "export-ready",        label: "Export Ready",       description: "Has address + owner + source URL" },
  { id: "needs-verification",  label: "Needs Verification", description: "Missing owner or source data" },
];

/** Returns server-filter state for the given preset (where server filters suffice). */
export function presetServerFilters(preset: SmartPreset): ServerFilters {
  switch (preset) {
    case "high-priority":
      return { ...DEFAULT_SERVER_FILTERS, distressedOnly: true, severity: ["high"] };
    case "owner-pressure":
      return { ...DEFAULT_SERVER_FILTERS, leadTypes: ["tax_delinquent", "code_violation"] };
    case "bank-owned":
      return { ...DEFAULT_SERVER_FILTERS, leadTypes: ["reo"] };
    default:
      return { ...DEFAULT_SERVER_FILTERS };
  }
}

/** Client-side predicate for presets that can't be expressed as server filters. */
export function presetClientFilter(preset: SmartPreset): ((l: ProcessedProperty) => boolean) | null {
  switch (preset) {
    case "fresh-leads":
      return l => {
        if (!l.incident_date) return false;
        return (Date.now() - new Date(l.incident_date).getTime()) / 86_400_000 < 30;
      };
    case "export-ready":
      return l => !!(l.owner_name && l.property_address && l.source_url);
    case "needs-verification":
      return l => !l.owner_name || !l.source_url;
    default:
      return null;
  }
}

// ── Review status (local-first; DB migration recommended later) ───────────────

export type LeadReviewStatus = "new" | "reviewed" | "analyzing" | "exported" | "dismissed";

export const REVIEW_STATUS_LABELS: Record<LeadReviewStatus, string> = {
  new:        "New",
  reviewed:   "Reviewed",
  analyzing:  "Analyzing",
  exported:   "Exported",
  dismissed:  "Dismissed",
};

export const REVIEW_STATUS_COLORS: Record<LeadReviewStatus, string> = {
  new:        "bg-primary/10 text-primary",
  reviewed:   "bg-accent/10 text-accent",
  analyzing:  "bg-violet-500/10 text-violet-600",
  exported:   "bg-teal-500/10 text-teal-600",
  dismissed:  "bg-muted text-muted-foreground",
};

// ── Freshness label helper ────────────────────────────────────────────────────

export function freshnessClasses(label: SourcingSummary["freshnessLabel"]): string {
  switch (label) {
    case "Fresh":   return "text-accent";
    case "Aging":   return "text-amber-600 dark:text-amber-400";
    case "Stale":   return "text-destructive";
    default:        return "text-muted-foreground";
  }
}

export function qualityClasses(label: SourcingSummary["qualityLabel"]): string {
  switch (label) {
    case "Strong":   return "text-accent";
    case "Moderate": return "text-amber-600 dark:text-amber-400";
    case "Weak":     return "text-destructive";
    default:         return "text-muted-foreground";
  }
}

// ── Incident age ──────────────────────────────────────────────────────────────

export type IncidentAge = "fresh" | "recent" | "aging" | "stale" | "unknown";

export interface AgeLabel {
  age:         IncidentAge;
  daysAgo:     number | null;
  label:       string;
  warning:     string | null;
  badgeClass:  string;
}

/** Returns age classification and a user-visible warning for stale leads. */
export function incidentAge(incidentDate: string | null): AgeLabel {
  if (!incidentDate) return {
    age: "unknown", daysAgo: null,
    label: "No date", warning: "No incident date recorded — status unknown.",
    badgeClass: "bg-muted/50 text-muted-foreground/60 border-border/30",
  };

  const daysAgo = (Date.now() - new Date(incidentDate).getTime()) / 86_400_000;

  if (daysAgo < 30)
    return { age: "fresh", daysAgo, label: `${Math.floor(daysAgo)}d ago`,
      warning: null, badgeClass: "bg-accent/10 text-accent border-accent/20" };

  if (daysAgo < 90)
    return { age: "recent", daysAgo, label: `${Math.floor(daysAgo)}d ago`,
      warning: null, badgeClass: "bg-primary/10 text-primary border-primary/20" };

  if (daysAgo < 365)
    return { age: "aging", daysAgo, label: `${Math.floor(daysAgo / 30)}mo ago`,
      warning: "Violation is several months old — verify it is still unresolved before outreach.",
      badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400" };

  const years = (daysAgo / 365).toFixed(1);
  return { age: "stale", daysAgo, label: `${years}yr ago`,
    warning: `This violation is over ${Math.floor(daysAgo / 365)} year(s) old. It may have been resolved. Confirm current status before any outreach.`,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20" };
}

/** Count of stale leads (> 1 year) in a lead set — used in the summary warning. */
export function countStaleLeads(leads: ProcessedProperty[]): number {
  return leads.filter(l => {
    if (!l.incident_date) return false;
    return (Date.now() - new Date(l.incident_date).getTime()) / 86_400_000 > 365;
  }).length;
}
