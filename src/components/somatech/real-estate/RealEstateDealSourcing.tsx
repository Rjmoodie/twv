import React, { useState, useMemo, useCallback, useRef, Suspense, useEffect } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import HelpTooltip from '@/components/somatech/guide/HelpTooltip';
const DealSourcingMap = lazyWithRetry(() => import("./DealSourcingMap"));
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, RefreshCw, Download, Filter, Building2, MapPin,
  CheckCircle2, Loader2, ChevronDown, ChevronUp, AlertCircle, BarChart2,
  Calendar, User, Tag, DollarSign, AlertTriangle, ExternalLink,
  Flame, Clock, FileCheck, HelpCircle, TrendingUp, Activity,
  Copy, CheckCheck, Zap, Star, Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/useBreakpoint";
import {
  freeDataSourcesImplementation, ProcessedProperty, PHASE_1_SOURCES, SOURCE_META,
} from "@/services/free-data-sources-implementation";
import { DataCoverageTable } from "@/components/modules/lead-gen/DataCoverageTable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/somatech/AuthProvider";
import { type MapBounds } from "./DealSourcingMap";
import {
  ServerFilters, DEFAULT_SERVER_FILTERS, LEAD_TYPE_LABELS,
  LeadScore, ScoredLead, SourcingSummary, SourceHealth, LeadMixItem, DataConfidence,
  SmartPreset, PresetConfig, SMART_PRESETS, LeadReviewStatus, LeadAction,
  scoreLead, scoreBadgeClasses, explainLead, recommendAction,
  deriveSummary, deriveAllSourceHealth, deriveLeadMix, deriveDataConfidence,
  presetServerFilters, presetClientFilter,
  freshnessClasses, qualityClasses,
  incidentAge, countStaleLeads,
  REVIEW_STATUS_LABELS, REVIEW_STATUS_COLORS,
} from "@/lib/dealSourcingInsights";

// ── Shared constants ──────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtCompact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

const SEVERITY_COLORS: Record<string, string> = {
  high:   "text-destructive",
  medium: "text-amber-600 dark:text-amber-400",
  low:    "text-muted-foreground",
};

const PRESET_ICONS: Record<SmartPreset, React.ReactNode> = {
  "high-priority":      <Flame className="h-3 w-3" />,
  "owner-pressure":     <AlertTriangle className="h-3 w-3" />,
  "bank-owned":         <Building2 className="h-3 w-3" />,
  "fresh-leads":        <Clock className="h-3 w-3" />,
  "export-ready":       <FileCheck className="h-3 w-3" />,
  "needs-verification": <HelpCircle className="h-3 w-3" />,
};

function relTime(d: string | null): string {
  if (!d) return "—";
  const h = (Date.now() - new Date(d).getTime()) / 3_600_000;
  if (h < 1)  return "Just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const update = useCallback((v: T) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(v), delayMs);
  }, [delayMs]);
  const prev = useRef(value);
  if (prev.current !== value) { prev.current = value; update(value); }
  return debounced;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBadge({ score, label }: { score: number; label: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap",
      scoreBadgeClasses(score)
    )}>
      <span className="font-bold">{score}</span>
      <span className="hidden sm:inline opacity-70">{label.split(" ")[0]}</span>
    </span>
  );
}

function MiniBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${percent}%` }} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  onAnalyzeLead?: (lead: ProcessedProperty) => void;
}

const RealEstateDealSourcing: React.FC<Props> = ({ onAnalyzeLead }) => {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const isMobile  = useIsMobile();
  const { user }  = useAuth();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [sf, setSf]                     = useState<ServerFilters>(DEFAULT_SERVER_FILTERS);
  const [activePreset, setActivePreset] = useState<SmartPreset | null>(null);
  const [valueRange, setValueRange]     = useState<[number, number]>([0, 2_000_000]);
  const debouncedRange                  = useDebounced(valueRange, 300);
  const [viewMode, setViewMode]         = useState<"table" | "cards" | "map">(isMobile ? "cards" : "map");
  const [mapBounds, setMapBounds]       = useState<MapBounds | null>(null);
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [reviewFilter, setReviewFilter] = useState<LeadReviewStatus | "all">("all");
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [detailLead, setDetailLead]     = useState<ScoredLead | null>(null);
  const [summaryOpen, setSummaryOpen]   = useState(true);
  // ── Extended client-side filters ─────────────────────────────────────────
  // ownerFlags: AND-combined property flags (absentee, llc, has_owner_name)
  const [ownerFlags, setOwnerFlags]     = useState<Set<string>>(new Set());
  // maxAgeDays: null = any age; number = incident must be within N days
  const [maxAgeDays, setMaxAgeDays]     = useState<number | null>(null);

  // ── Review workflow — DB-backed, keyed by "data_source::source_record_id" ──
  const [reviewMap, setReviewMap] = useState<Map<string, LeadReviewStatus>>(new Map());

  // Load persisted reviews for the current user on mount
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("lead_reviews")
      .select("data_source, source_record_id, status")
      .eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error || !data) return;
        const m = new Map<string, LeadReviewStatus>();
        for (const r of data) m.set(`${r.data_source}::${r.source_record_id}`, r.status as LeadReviewStatus);
        setReviewMap(m);
      });
  }, [user?.id]);

  // Hoisted here so useMemos below can reference it without hoisting issues
  const reviewKey = (lead: ProcessedProperty) =>
    `${lead.data_source}::${lead.source_record_id ?? lead.id}`;

  // ── Queries ───────────────────────────────────────────────────────────────
  const leadsQuery = useQuery({
    queryKey: ["real-estate-leads", sf],
    queryFn: () => freeDataSourcesImplementation.getLeads({
      search:         sf.search       || undefined,
      sources:        sf.sources.length      ? sf.sources      : undefined,
      leadTypes:      sf.leadTypes.length    ? sf.leadTypes    : undefined,
      severity:       sf.severity.length     ? sf.severity     : undefined,
      distressedOnly: sf.distressedOnly      || undefined,
      limit: 1000,
    }),
    staleTime: 5 * 60_000,
  });

  const statusQuery = useQuery({
    queryKey: ["real-estate-status"],
    queryFn:  () => freeDataSourcesImplementation.getImplementationStatus(),
    staleTime: 60_000,
  });

  const fetchMutation = useMutation({
    mutationFn: (sources: typeof PHASE_1_SOURCES[number][]) =>
      freeDataSourcesImplementation.fetchSources(sources),
    onSuccess: (result) => {
      const errs = result.errors ?? [];
      qc.invalidateQueries({ queryKey: ["real-estate-leads"] });
      qc.invalidateQueries({ queryKey: ["real-estate-status"] });
      toast({
        title: errs.length ? "Fetch completed with warnings" : "Data refreshed",
        description: `${result.totalFetched.toLocaleString()} fetched, ${result.totalInserted.toLocaleString()} added.${errs.length ? ` ${errs.length} source(s) had errors.` : ""}`,
        variant: errs.length ? "destructive" : "default",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Fetch failed", description: err.message, variant: "destructive" });
    },
  });

  const enrichMutation = useMutation({
    mutationFn: async (sources: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/enrich-real-estate-leads`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sources }),
        }
      );
      if (!res.ok) throw new Error(`Enrich failed: ${res.status}`);
      return res.json();
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["real-estate-leads"] });
      const total = result.totalEnriched ?? 0;
      toast({ title: "Enrichment complete", description: `${total} leads enriched with owner/value data.` });
    },
    onError: (err: Error) => {
      toast({ title: "Enrichment failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Derived data (all memoised) ───────────────────────────────────────────

  const baseLeads = useMemo(() => {
    const raw = leadsQuery.data ?? [];
    const [minV, maxV] = debouncedRange;
    const valueFiltered = (minV === 0 && maxV === 2_000_000)
      ? raw
      : raw.filter(l => l.property_value == null || (l.property_value >= minV && l.property_value <= maxV));

    const clientFilter = activePreset ? presetClientFilter(activePreset) : null;
    const presetFiltered = clientFilter ? valueFiltered.filter(clientFilter) : valueFiltered;

    // Owner flags — AND logic (lead must satisfy ALL selected flags)
    const ownerFiltered = ownerFlags.size === 0 ? presetFiltered : presetFiltered.filter(l => {
      if (ownerFlags.has("absentee")      && !l.is_absentee)  return false;
      if (ownerFlags.has("llc")           && !l.is_llc_owned) return false;
      if (ownerFlags.has("has_owner_name") && !l.owner_name)   return false;
      if (ownerFlags.has("distressed")    && !l.is_distressed) return false;
      return true;
    });

    // Freshness filter — incident_date within N days
    const freshnessFiltered = maxAgeDays == null ? ownerFiltered : ownerFiltered.filter(l => {
      if (!l.incident_date) return false;
      return (Date.now() - new Date(l.incident_date).getTime()) / 86_400_000 <= maxAgeDays;
    });

    // Review status filter — "all" shows everything including unreviewed
    if (reviewFilter === "all") return freshnessFiltered;
    if (reviewFilter === "new" as LeadReviewStatus)
      return freshnessFiltered.filter(l => !reviewMap.get(reviewKey(l)) || reviewMap.get(reviewKey(l)) === "new");
    return freshnessFiltered.filter(l => reviewMap.get(reviewKey(l)) === reviewFilter);
  }, [leadsQuery.data, debouncedRange, activePreset, reviewFilter, reviewMap, ownerFlags, maxAgeDays]);

  const scoredLeads = useMemo<ScoredLead[]>(
    () => baseLeads.map(lead => ({ lead, score: scoreLead(lead) })),
    [baseLeads]
  );

  // Sort by score descending
  const leads: ScoredLead[] = useMemo(
    () => [...scoredLeads].sort((a, b) => b.score.score - a.score.score),
    [scoredLeads]
  );

  const summary      = useMemo(() => deriveSummary(scoredLeads, statusQuery.data?.sourceBreakdown), [scoredLeads, statusQuery.data]);
  const sourceHealth = useMemo(() => deriveAllSourceHealth(scoredLeads, statusQuery.data?.sourceBreakdown), [scoredLeads, statusQuery.data]);
  const leadMix      = useMemo(() => deriveLeadMix(baseLeads), [baseLeads]);
  const confidence   = useMemo(() => deriveDataConfidence(baseLeads), [baseLeads]);
  const staleCount   = useMemo(() => countStaleLeads(baseLeads), [baseLeads]);

  // Count leads per review status — powers the pipeline bar
  const pipelineCounts = useMemo(() => {
    const c: Record<string, number> = { new: 0, reviewed: 0, analyzing: 0, exported: 0, dismissed: 0 };
    for (const { lead } of leads) {
      const s = reviewMap.get(reviewKey(lead)) ?? "new";
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [leads, reviewMap]);

  // Count leads that match each smart preset (run against full unfiltered query data)
  const presetCounts = useMemo(() => {
    const raw = leadsQuery.data ?? [];
    const out: Partial<Record<SmartPreset, number>> = {};
    for (const p of SMART_PRESETS) {
      const f = presetClientFilter(p.id);
      out[p.id] = f ? raw.filter(f).length : raw.length;
    }
    return out;
  }, [leadsQuery.data]);

  // Highest-scoring unreviewed lead for "Next Best Lead" action
  const nextBestUnreviewed = useMemo(() =>
    leads.find(({ lead }) => {
      const s = reviewMap.get(reviewKey(lead));
      return !s || s === "new";
    }) ?? null,
  [leads, reviewMap]);

  // When map is active, narrow the list to leads visible in the current viewport
  const visibleLeads = useMemo(() => {
    if (viewMode !== "map" || !mapBounds) return leads;
    const mapped = leads.filter(({ lead }) =>
      lead.latitude  != null && lead.longitude != null &&
      lead.latitude  >= mapBounds.south && lead.latitude  <= mapBounds.north &&
      lead.longitude >= mapBounds.west  && lead.longitude <= mapBounds.east
    );
    // Always show unmapped leads at the end so they're not silently hidden
    const unmapped = leads.filter(({ lead }) => !lead.latitude || !lead.longitude);
    return [...mapped, ...unmapped];
  }, [leads, viewMode, mapBounds]);

  const mappedCount = useMemo(
    () => leads.filter(({ lead }) => lead.latitude && lead.longitude).length,
    [leads]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const applyPreset = (preset: SmartPreset) => {
    if (activePreset === preset) {
      setActivePreset(null);
      setSf(DEFAULT_SERVER_FILTERS);
    } else {
      setActivePreset(preset);
      setSf(presetServerFilters(preset));
    }
    setSelected(new Set());
    // TODO: analytics — deal_filter_preset_used
  };

  const handleExport = async () => {
    try {
      toast({ title: "Preparing export…", description: "Fetching all matching records." });
      const all = selected.size
        ? leads.filter(({ lead }) => selected.has(lead.id)).map(({ lead }) => lead)
        : await freeDataSourcesImplementation.getLeads({
            search:         sf.search       || undefined,
            sources:        sf.sources.length ? sf.sources  : undefined,
            leadTypes:      sf.leadTypes.length ? sf.leadTypes : undefined,
            severity:       sf.severity.length  ? sf.severity  : undefined,
            distressedOnly: sf.distressedOnly   || undefined,
            limit: 10_000,
          });

      const cols = ["state","city","county","lead_type","property_address","owner_name","property_value","severity","tags","incident_date","source_url"];
      const csv  = [
        cols.join(","),
        ...all.map(r => cols.map(c => {
          const v = (r as Record<string, unknown>)[c];
          if (Array.isArray(v)) return `"${v.join(";")}"`;
          return `"${String(v ?? "").replace(/"/g, '""')}"`;
        }).join(",")),
      ].join("\n");

      const a  = document.createElement("a");
      a.href   = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = `real-estate-leads-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exported", description: `${all.length.toLocaleString()} leads exported.` });
      // TODO: analytics — deal_csv_exported
    } catch (err) {
      toast({ title: "Export failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const copyAddress = (lead: ProcessedProperty) => {
    const text = [lead.property_address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: text });
    });
  };

  // reviewKey defined below with setReview — see the hoisted version used in useMemos

  const setReview = useCallback(async (lead: ProcessedProperty, status: LeadReviewStatus) => {
    const key = reviewKey(lead);
    // Optimistic update
    setReviewMap(m => new Map(m).set(key, status));
    if (!user?.id || !lead.source_record_id) return;
    const { error } = await supabase.from("lead_reviews").upsert({
      user_id:          user.id,
      data_source:      lead.data_source,
      source_record_id: lead.source_record_id,
      status,
    }, { onConflict: "user_id,data_source,source_record_id" });
    if (error) {
      toast({ title: "Couldn't save review", description: error.message, variant: "destructive" });
      // Roll back optimistic update
      setReviewMap(m => { const n = new Map(m); n.delete(key); return n; });
    }
  }, [user?.id, toast]);

  // ── Computed display state ────────────────────────────────────────────────
  const isLoading    = leadsQuery.isLoading;
  const isFetching   = fetchMutation.isPending;
  const isError      = leadsQuery.isError;
  const status       = statusQuery.data;
  const hasData      = leads.length > 0;
  const neverFetched = !isLoading && !isError && !hasData && !status?.totalLeads;
  const allSelected  = leads.length > 0 && selected.size === leads.length;
  const activeFilters = sf.leadTypes.length + sf.severity.length + (sf.distressedOnly ? 1 : 0) + sf.sources.length + (reviewFilter !== "all" ? 1 : 0) + ownerFlags.size + (maxAgeDays != null ? 1 : 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Deal Sourcing</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {PHASE_1_SOURCES.length} public sources ·{" "}
            {status?.totalLeads
              ? `${status.totalLeads.toLocaleString()} leads in database`
              : "No data yet — run a fetch to start"}
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm"
            onClick={() => fetchMutation.mutate([...PHASE_1_SOURCES])}
            disabled={isFetching} className="gap-1.5 h-9 touch-manipulation">
            {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isFetching ? "Fetching…" : "Refresh"}
          </Button>
          {hasData && (
            <Button variant="outline" size="sm"
              onClick={() => enrichMutation.mutate(["nyc_hpd","philly_violations","chicago_violations","sf_violations","boston_violations"])}
              disabled={enrichMutation.isPending} className="gap-1.5 h-9 touch-manipulation">
              {enrichMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
              {enrichMutation.isPending ? "Enriching…" : "Re-enrich"}
            </Button>
          )}
          {hasData && (
            <Button size="sm" onClick={handleExport} className="gap-1.5 h-9 touch-manipulation">
              <Download className="h-3.5 w-3.5" />
              {selected.size ? `Export ${selected.size}` : "Export CSV"}
            </Button>
          )}
        </div>
      </div>

      {/* ── Sourcing Intelligence Summary ──────────────────────────────── */}
      {hasData && (
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <button
            onClick={() => setSummaryOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Sourcing Intelligence</span>
              {summary.highPriorityLeads > 0 && (
                <span className="text-[10px] font-semibold rounded-full bg-destructive/10 text-destructive px-2 py-0.5">
                  {summary.highPriorityLeads} high-priority
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("text-[11px] font-medium", freshnessClasses(summary.freshnessLabel))}>
                {summary.freshnessLabel}
              </span>
              {summaryOpen
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          </button>

          {summaryOpen && (
            <div className="border-t border-border/40 px-4 pb-4 pt-3 space-y-4">

              {/* Stat grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Leads",    value: summary.totalLeads.toLocaleString(), icon: <Activity className="h-3.5 w-3.5 text-muted-foreground" /> },
                  { label: "High Priority",  value: summary.highPriorityLeads.toLocaleString(), icon: <Flame className="h-3.5 w-3.5 text-destructive" />, highlight: true },
                  { label: "Distressed",     value: summary.totalLeads ? `${Math.round(summary.distressedLeads / summary.totalLeads * 100)}%` : "—", icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> },
                  { label: "Owner Ready",    value: summary.ownerReadyLeads.toLocaleString(), icon: <User className="h-3.5 w-3.5 text-muted-foreground" /> },
                ].map(s => (
                  <div key={s.label} className={cn(
                    "rounded-xl border p-3 space-y-1",
                    s.highlight ? "border-destructive/20 bg-destructive/[0.04]" : "border-border/40 bg-background/60"
                  )}>
                    <div className="flex items-center gap-1.5">{s.icon}<span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{s.label}</span></div>
                    <p className={cn("text-xl font-bold tabular-nums", s.highlight && "text-destructive")}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Lead mix bar */}
              {leadMix.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Mix</p>
                  <div className="space-y-1.5">
                    {leadMix.slice(0, 5).map((item, i) => {
                      const colors = ["bg-primary", "bg-amber-500", "bg-destructive", "bg-teal-500", "bg-violet-500"];
                      return (
                        <div key={item.type} className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-28 truncate shrink-0">{item.label}</span>
                          <div className="flex-1">
                            <MiniBar percent={item.percent} colorClass={colors[i % colors.length]} />
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{item.percent}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bottom row: market / value / confidence */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground border-t border-border/30 pt-3">
                {summary.topMarket && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Top market: <span className="text-foreground font-medium">{summary.topMarket.city}, {summary.topMarket.state}</span>
                    <span className="text-muted-foreground/60">· {summary.topMarket.hpCount} high-priority</span>
                  </span>
                )}
                {summary.avgPropertyValue && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    Avg value: <span className="text-foreground font-medium">{fmtCompact.format(summary.avgPropertyValue)}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  Data quality: <span className={cn("font-medium", qualityClasses(summary.qualityLabel))}>{summary.qualityLabel}</span>
                  <span className="text-muted-foreground/60">({confidence.explanation.split(" · ").slice(0, 2).join(" · ")})</span>
                </span>
                {summary.lastRefreshedAt && (
                  <span>Updated <span className="text-foreground">{relTime(summary.lastRefreshedAt)}</span></span>
                )}
              </div>

              {/* Stale data warning */}
              {staleCount > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-3.5 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    <span className="font-semibold">{staleCount.toLocaleString()} leads are over 1 year old.</span>
                    {" "}These violations may have been resolved. Verify current status before any outreach to avoid wasting effort on closed cases.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Sourcing Mission Bar ──────────────────────────────────────── */}
      {(hasData || !neverFetched) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              What are you sourcing today?
            </p>
            {activePreset && (
              <button
                onClick={() => { setActivePreset(null); setSf(DEFAULT_SERVER_FILTERS); }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear ×
              </button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {SMART_PRESETS.map(p => {
              const count   = presetCounts[p.id] ?? 0;
              const isActive = activePreset === p.id;
              return (
                <button key={p.id}
                  onClick={() => applyPreset(p.id)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all shrink-0 min-w-[120px] touch-manipulation",
                    isActive
                      ? "border-primary/40 bg-primary/10"
                      : "border-border/60 bg-card/60 hover:border-border hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <span className={isActive ? "text-primary" : "text-muted-foreground"}>
                      {PRESET_ICONS[p.id]}
                    </span>
                    <span className={cn("text-xs font-semibold", isActive ? "text-primary" : "text-foreground")}>
                      {p.label}
                    </span>
                    {count > 0 && (
                      <span className={cn(
                        "ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none shrink-0",
                        isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{p.description}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Source chips (enhanced with health) ─────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-nowrap" style={{ WebkitOverflowScrolling: 'touch' }}>
        {PHASE_1_SOURCES.map(s => {
          const health = sourceHealth.find(h => h.source === s);
          const active = sf.sources.includes(s);
          const statusDot = {
            healthy:   "bg-accent",
            aging:     "bg-amber-400",
            "no-data": "bg-muted-foreground/40",
            error:     "bg-destructive",
          }[health?.status ?? "no-data"];

          return (
            <button key={s}
              onClick={() => {
                setSf(f => ({
                  ...f,
                  sources: active ? f.sources.filter(x => x !== s) : [...f.sources, s],
                }));
                if (activePreset) setActivePreset(null);
                // TODO: analytics — deal_source_filter_clicked
              }}
              title={health?.note}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 bg-card/60 text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full shrink-0", statusDot)} />
              {SOURCE_META[s].city}, {SOURCE_META[s].state}
              {health && health.count > 0 && (
                <span className="text-muted-foreground/70">· {health.count.toLocaleString()}</span>
              )}
              {health && health.hpCount > 0 && (
                <span className="text-destructive/70">({health.hpCount} ↑)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {isError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Failed to load leads</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {leadsQuery.error instanceof Error ? leadsQuery.error.message : "Check your connection."}
            </p>
            <button onClick={() => leadsQuery.refetch()} className="text-xs text-primary hover:underline mt-1.5">Retry</button>
          </div>
        </div>
      )}

      {/* ── Never-fetched CTA ────────────────────────────────────────────── */}
      {neverFetched && (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center space-y-3">
          <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium">No leads in database yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Fetch live data from Chicago, NYC, LA, Austin, Seattle, and HUD REO — all free, no API key required.
          </p>
          <Button onClick={() => fetchMutation.mutate([...PHASE_1_SOURCES])} disabled={isFetching} className="gap-2">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isFetching ? "Fetching…" : "Fetch first batch of leads"}
          </Button>
        </div>
      )}

      {/* ── Data coverage reference ─────────────────────────────────────── */}
      <DataCoverageTable />

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      {(hasData || sf.search || sf.leadTypes.length > 0) && (
        <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
          <button onClick={() => setFiltersOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span>Filters</span>
              {activeFilters > 0 && (
                <span className="bg-primary/10 text-primary text-[10px] font-semibold rounded-full px-2 py-0.5">
                  {activeFilters} active
                </span>
              )}
            </div>
            {filtersOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {filtersOpen && (
            <div className="border-t border-border/40 px-5 py-5 space-y-5">

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search address, city, county, owner…"
                  value={sf.search}
                  onChange={e => { setSf(f => ({ ...f, search: e.target.value })); setActivePreset(null); }}
                  className="pl-9 h-9" />
              </div>

              {/* ── Lead Type — OR within group ─────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">Lead Type</Label>
                  <span className="text-[10px] text-muted-foreground">select multiple = OR</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(LEAD_TYPE_LABELS).map(([k, label]) => {
                    const active = sf.leadTypes.includes(k);
                    return (
                      <button key={k}
                        onClick={() => {
                          setSf(f => ({ ...f, leadTypes: active ? f.leadTypes.filter(x => x !== k) : [...f.leadTypes, k] }));
                          setActivePreset(null);
                        }}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors touch-manipulation",
                          active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                        )}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AND divider */}
              {(sf.leadTypes.length > 0 || sf.severity.length > 0) && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border/40" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">AND</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
              )}

              {/* ── Severity — OR within group ──────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Severity</Label>
                <div className="flex gap-1.5">
                  {(["high", "medium", "low"] as const).map(sev => {
                    const active = sf.severity.includes(sev);
                    const colors = {
                      high:   active ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border/50 text-muted-foreground hover:border-destructive/30 hover:text-destructive",
                      medium: active ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" : "border-border/50 text-muted-foreground hover:border-amber-400/40 hover:text-amber-600",
                      low:    active ? "border-border bg-muted text-foreground" : "border-border/50 text-muted-foreground hover:border-border",
                    };
                    return (
                      <button key={sev}
                        onClick={() => {
                          setSf(f => ({ ...f, severity: active ? f.severity.filter(x => x !== sev) : [...f.severity, sev] }));
                          setActivePreset(null);
                        }}
                        className={cn("flex-1 rounded-lg border py-2 text-[11px] font-semibold capitalize transition-colors touch-manipulation", colors[sev])}>
                        {sev}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AND divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">AND</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              {/* ── Owner / Property flags — AND across, multi-select ───── */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Owner & Property</Label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    { key: "distressed",     label: "Distressed" },
                    { key: "absentee",       label: "Absentee owner" },
                    { key: "llc",            label: "LLC-owned" },
                    { key: "has_owner_name", label: "Owner name available" },
                  ] as const).map(({ key, label }) => {
                    const active = ownerFlags.has(key);
                    return (
                      <button key={key}
                        onClick={() => setOwnerFlags(prev => {
                          const next = new Set(prev);
                          if (active) next.delete(key); else next.add(key);
                          return next;
                        })}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors touch-manipulation",
                          active ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                        )}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/70">Multiple owner flags = AND (lead must match all selected)</p>
              </div>

              {/* AND divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">AND</span>
                <div className="flex-1 h-px bg-border/40" />
              </div>

              {/* ── Freshness ──────────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Data Freshness</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {([
                    { label: "Any age",   days: null },
                    { label: "< 30 days", days: 30 },
                    { label: "< 90 days", days: 90 },
                    { label: "< 1 year",  days: 365 },
                  ] as const).map(({ label, days }) => (
                    <button key={label}
                      onClick={() => setMaxAgeDays(days)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors touch-manipulation",
                        maxAgeDays === days ? "border-primary/40 bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
                      )}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Property Value ─────────────────────────────────────────── */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">
                  Property Value: {fmt.format(valueRange[0])} — {fmt.format(valueRange[1])}
                  {(valueRange[0] > 0 || valueRange[1] < 2_000_000) && (
                    <span className="text-muted-foreground/60 font-normal"> · client-side</span>
                  )}
                </Label>
                <Slider value={valueRange}
                  onValueChange={(v: number[]) => setValueRange([v[0], v[1]])}
                  min={0} max={2_000_000} step={25_000} />
              </div>

              {/* ── Active filter summary ─────────────────────────────────── */}
              {activeFilters > 0 && (
                <div className="rounded-xl bg-muted/50 border border-border/40 px-3.5 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Showing leads where</p>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {sf.leadTypes.length > 0 && (
                      <span className="text-foreground font-medium">
                        Type: {sf.leadTypes.map(t => LEAD_TYPE_LABELS[t] ?? t).join(" <span class='text-muted-foreground'>or</span> ")}
                      </span>
                    )}
                    {sf.severity.length > 0 && (
                      <span className="text-foreground font-medium">
                        · Severity: {sf.severity.join(" or ")}
                      </span>
                    )}
                    {ownerFlags.size > 0 && (
                      <span className="text-foreground font-medium">
                        · {[...ownerFlags].join(" + ")}
                      </span>
                    )}
                    {maxAgeDays != null && (
                      <span className="text-foreground font-medium">· &lt;{maxAgeDays}d old</span>
                    )}
                    {(valueRange[0] > 0 || valueRange[1] < 2_000_000) && (
                      <span className="text-foreground font-medium">
                        · Value: {fmt.format(valueRange[0])}–{fmt.format(valueRange[1])}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setSf(DEFAULT_SERVER_FILTERS);
                  setValueRange([0, 2_000_000]);
                  setActivePreset(null);
                  setReviewFilter("all");
                  setOwnerFlags(new Set());
                  setMaxAgeDays(null);
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lead Pipeline Bar ────────────────────────────────────────────── */}
      {hasData && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">Pipeline</span>
          <span className="text-muted-foreground/30 shrink-0">·</span>
          {([
            { val: "all",       label: "All",       count: leads.length },
            { val: "new",       label: "New",        count: pipelineCounts.new ?? 0 },
            { val: "reviewed",  label: "Reviewed",   count: pipelineCounts.reviewed ?? 0 },
            { val: "analyzing", label: "Analyzing",  count: pipelineCounts.analyzing ?? 0 },
            { val: "exported",  label: "Exported",   count: pipelineCounts.exported ?? 0 },
            { val: "dismissed", label: "Dismissed",  count: pipelineCounts.dismissed ?? 0 },
          ] as const).map(({ val, label, count }) => (
            <button key={val}
              onClick={() => setReviewFilter(val as LeadReviewStatus | "all")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0 touch-manipulation",
                reviewFilter === val
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border"
              )}>
              {label}
              {count > 0 && <span className="font-bold tabular-nums">{count}</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Results header ────────────────────────────────────────────────── */}
      {hasData && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground min-w-0 truncate">
            {isLoading ? "Loading…" : (
              viewMode === "map" && mapBounds
                ? `${visibleLeads.filter(l => l.lead.latitude && l.lead.longitude).length.toLocaleString()} in view · ${mappedCount.toLocaleString()} mapped`
                : `${leads.length.toLocaleString()} leads`
            )}
            {activePreset && <span className="ml-1.5 text-primary font-medium">· {SMART_PRESETS.find(p => p.id === activePreset)?.label}</span>}
            {selected.size > 0 && ` · ${selected.size} selected`}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {/* Next Best Lead */}
            {nextBestUnreviewed && (
              <button
                onClick={() => setDetailLead(nextBestUnreviewed)}
                className="hidden sm:flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/8 px-3 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-colors touch-manipulation"
              >
                <Zap className="h-3 w-3" />
                Next Best
              </button>
            )}
          {/* View mode toggle — tall enough for touch, fixed-width on mobile */}
          <div className="flex items-center shrink-0 gap-0.5 rounded-xl border border-border/50 bg-muted/30 p-0.5">
            {([
              { id: "map",   label: "Map",   icon: <MapIcon className="h-3.5 w-3.5" /> },
              { id: "cards", label: "Cards", icon: null },
              { id: "table", label: "Table", icon: null },
            ] as const).map(({ id, label, icon }) => (
              <button key={id} onClick={() => setViewMode(id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors touch-manipulation min-h-[36px]",
                  viewMode === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                {icon}<span className="hidden xs:inline sm:inline">{label}</span>
                {!icon && <span>{label}</span>}
              </button>
            ))}
          </div>
          </div>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Table view ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && hasData && viewMode === "table" && (
        <div className="rounded-2xl border border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/40">
                  <TableHead className="w-8">
                    <Checkbox checked={allSelected} disabled={leads.length === 0}
                      onCheckedChange={v => setSelected(v ? new Set(leads.map(({ lead }) => lead.id)) : new Set())} />
                  </TableHead>
                  <TableHead className="w-20">
                    <HelpTooltip term="lead_score" side="bottom" className="text-xs font-medium" />
                  </TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="hidden md:table-cell">Severity</TableHead>
                  <TableHead className="hidden lg:table-cell">Value</TableHead>
                  <TableHead className="hidden lg:table-cell">Source</TableHead>
                  <TableHead className="hidden xl:table-cell">Date</TableHead>
                  <TableHead className="w-16 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.slice(0, 500).map(({ lead, score }) => {
                  const review = reviewMap.get(reviewKey(lead));
                  return (
                    <TableRow key={lead.id}
                      className={cn(
                        "border-border/30 hover:bg-muted/30 cursor-pointer",
                        review === "dismissed" && "opacity-50"
                      )}
                      onClick={() => { setDetailLead({ lead, score }); /* TODO: analytics — deal_lead_opened */ }}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(lead.id)}
                          onCheckedChange={v => setSelected(s => {
                            const next = new Set(s);
                            if (v) next.add(lead.id); else next.delete(lead.id);
                            return next;
                          })} />
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={score.score} label={score.label} />
                      </TableCell>
                      <TableCell>
                        <div className="max-w-[180px] truncate text-sm font-medium">{lead.property_address ?? "—"}</div>
                        <div className="text-[10px] text-muted-foreground">{[lead.city, lead.state].filter(Boolean).join(", ")}{lead.zip ? ` ${lead.zip}` : ""}</div>
                        {review && review !== "new" && (
                          <span className={cn("text-[9px] font-semibold rounded px-1 py-0.5", REVIEW_STATUS_COLORS[review])}>
                            {REVIEW_STATUS_LABELS[review]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="text-[10px] whitespace-nowrap">
                          {LEAD_TYPE_LABELS[lead.lead_type] ?? lead.lead_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {lead.severity && (
                          <span className={cn("text-xs font-semibold capitalize", SEVERITY_COLORS[lead.severity])}>
                            {lead.severity}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm font-mono tabular-nums">
                        {lead.property_value ? fmt.format(lead.property_value) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px] block">
                          {(SOURCE_META as Record<string, { city: string }>)[lead.data_source]?.city ?? lead.data_source}
                        </span>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {(() => {
                          const age = incidentAge(lead.incident_date);
                          return (
                            <span className={cn(
                              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                              age.badgeClass
                            )} title={age.warning ?? undefined}>
                              {age.label}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {onAnalyzeLead && lead.property_value && (
                            <button title="Analyze in BRRRR"
                              onClick={() => { onAnalyzeLead(lead); /* TODO: analytics — deal_lead_analyzed */ }}
                              className="text-primary hover:text-primary/80 transition-colors">
                              <BarChart2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {lead.source_url && (
                            <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                              title="Open source data"
                              className="text-muted-foreground hover:text-foreground transition-colors">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {leads.length > 500 && (
            <div className="px-5 py-3 border-t border-border/40 text-center">
              <p className="text-xs text-muted-foreground">
                Showing 500 of {leads.length.toLocaleString()} — use Export CSV for the full list
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Card view ────────────────────────────────────────────────────── */}
      {!isLoading && !isError && hasData && viewMode === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.slice(0, 60).map(({ lead, score }) => {
            const action  = recommendAction(lead, score.score);
            const review  = reviewMap.get(reviewKey(lead));
            const explain = explainLead(lead);
            return (
              <div key={lead.id}
                className={cn(
                  "rounded-2xl border border-border/50 bg-card/60 p-4 space-y-3 cursor-pointer transition-all hover:shadow-md hover:border-border/80",
                  review === "dismissed" && "opacity-50"
                )}
                onClick={() => { setDetailLead({ lead, score }); }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <ScoreBadge score={score.score} label={score.label} />
                      {review && review !== "new" && (
                        <span className={cn("text-[9px] font-semibold rounded px-1.5 py-0.5", REVIEW_STATUS_COLORS[review])}>
                          {REVIEW_STATUS_LABELS[review]}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{lead.property_address ?? "—"}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {LEAD_TYPE_LABELS[lead.lead_type] ?? lead.lead_type}
                  </Badge>
                </div>

                {/* Signal line */}
                <div className="flex items-center gap-2 flex-wrap">
                  {lead.severity && (
                    <span className={cn("text-[11px] font-semibold capitalize", SEVERITY_COLORS[lead.severity])}>
                      {lead.severity} severity
                    </span>
                  )}
                  {lead.is_distressed && (
                    <HelpTooltip term="distressed_lead" side="top">
                      <Badge variant="destructive" className="text-[10px] cursor-default">Distressed</Badge>
                    </HelpTooltip>
                  )}
                  {lead.is_absentee   && <Badge variant="secondary"   className="text-[10px]">Absentee</Badge>}
                  {lead.is_llc_owned  && <Badge variant="secondary"   className="text-[10px]">LLC</Badge>}
                </div>

                {/* Why it matters */}
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 border-t border-border/30 pt-2.5">
                  {explain}
                </p>

                {/* Financial + age */}
                <div className="flex items-center justify-between text-[11px]">
                  {lead.property_value ? (
                    <span className="font-semibold font-mono">{fmt.format(lead.property_value)}</span>
                  ) : (
                    <span className="text-muted-foreground">No value estimate</span>
                  )}
                  {(() => {
                    const age = incidentAge(lead.incident_date);
                    return (
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                        age.badgeClass
                      )} title={age.warning ?? undefined}>
                        {age.label}
                      </span>
                    );
                  })()}
                </div>
                {/* Inline stale warning on card */}
                {incidentAge(lead.incident_date).age === "stale" && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    ⚠ Over 1yr old — verify status before outreach.
                  </p>
                )}

                {/* Recommended action + source link */}
                <div className="flex items-center justify-between gap-2 border-t border-border/30 pt-2.5"
                  onClick={e => e.stopPropagation()}>
                  {action.type === "analyze" && onAnalyzeLead && lead.property_value ? (
                    <button
                      onClick={() => { onAnalyzeLead(lead); }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <BarChart2 className="h-3 w-3" />
                      Analyze deal
                    </button>
                  ) : (
                    <span className={cn(
                      "text-[11px] font-medium",
                      action.priority === "high" ? "text-destructive" : action.priority === "medium" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                    )}>
                      → {action.label}
                    </span>
                  )}
                  {lead.source_url && (
                    <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          {leads.length > 60 && (
            <div className="sm:col-span-2 lg:col-span-3 text-center text-xs text-muted-foreground py-2">
              Showing 60 of {leads.length.toLocaleString()} — switch to Table view or export CSV
            </div>
          )}
        </div>
      )}
      {/* ── Map view ──────────────────────────────────────────────────────── */}
      {!isLoading && !isError && hasData && viewMode === "map" && (() => {
        const panelLead  = detailLead;
        const showDetail = !!panelLead;
        const MAP_H      = isMobile ? "420px" : "640px";
        const fmtC       = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

        return (
          <div className={cn("gap-4", isMobile ? "flex flex-col" : "grid grid-cols-[1fr_380px]")}>

            {/* ── Map ─────────────────────────────────────────────────── */}
            <div className="rounded-2xl overflow-hidden border border-border/50" style={{ height: MAP_H }}>
              <Suspense fallback={
                <div className="w-full h-full bg-muted/30 flex items-center justify-center rounded-2xl">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }>
                <DealSourcingMap
                  leads={leads}
                  selectedId={detailLead?.lead.id ?? null}
                  onLeadSelect={setDetailLead}
                  onBoundsChange={setMapBounds}
                  fitBoundsKey={[...sf.sources, activePreset ?? ""].join("|")}
                  height="100%"
                />
              </Suspense>
            </div>

            {/* ── Right panel: slides between list ↔ detail ───────────── */}
            <div
              className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden relative"
              style={{ height: MAP_H }}
            >
              {/* ── List layer ── slides left when detail opens */}
              <div className={cn(
                "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
                showDetail ? "-translate-x-full opacity-0 pointer-events-none" : "translate-x-0 opacity-100"
              )}>
                <div className="px-4 pt-3.5 pb-2.5 border-b border-border/30 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {mapBounds
                        ? `${visibleLeads.filter(l => l.lead.latitude && l.lead.longitude).length} in view`
                        : `${leads.length} leads`}
                      <span className="opacity-50"> · click to preview</span>
                    </p>
                    {(() => {
                      const unmappedCount = leads.filter(l => !l.lead.latitude || !l.lead.longitude).length;
                      return unmappedCount > 0 ? (
                        <span className="text-[10px] text-muted-foreground/60 border border-border/40 rounded px-1.5 py-0.5"
                          title="These leads have no coordinates and won't appear on the map">
                          {unmappedCount} no coords
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {visibleLeads.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center gap-2">
                      <MapPin className="h-6 w-6 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">No leads in this area</p>
                      <p className="text-[11px] text-muted-foreground/60">Pan or zoom out to see more</p>
                    </div>
                  ) : null}
                  {visibleLeads.slice(0, 120).map(({ lead, score }) => {
                    const review = reviewMap.get(reviewKey(lead));
                    return (
                      <div key={lead.id}
                        onClick={() => setDetailLead({ lead, score })}
                        className={cn(
                          "rounded-xl px-3 py-2.5 cursor-pointer transition-colors border",
                          "border-transparent hover:border-border/60 hover:bg-muted/40",
                          review === "dismissed" && "opacity-40"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ScoreBadge score={score.score} label={score.label} />
                          <span className="text-xs font-medium truncate flex-1">{lead.property_address ?? "—"}</span>
                          {lead.property_value && (
                            <span className="text-[11px] font-mono text-muted-foreground shrink-0">{fmtC.format(lead.property_value)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 pl-0.5 text-[10px] text-muted-foreground">
                          <MapPin className="h-2.5 w-2.5 shrink-0 opacity-50" />
                          <span className="truncate">{[lead.city, lead.state].filter(Boolean).join(", ")}</span>
                          {lead.severity && (
                            <span className={cn("font-semibold capitalize shrink-0", SEVERITY_COLORS[lead.severity])}>{lead.severity}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {visibleLeads.length > 120 && (
                    <p className="text-center text-[11px] text-muted-foreground/50 py-3">+{(visibleLeads.length - 120).toLocaleString()} more · zoom in</p>
                  )}
                </div>
              </div>

              {/* ── Detail layer ── slides in from right */}
              <div className={cn(
                "absolute inset-0 flex flex-col transition-all duration-300 ease-in-out",
                showDetail ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
              )}>
                {panelLead && (() => {
                  const { lead, score } = panelLead;
                  const action   = recommendAction(lead, score.score);
                  const explain  = explainLead(lead);
                  const review   = reviewMap.get(reviewKey(lead)) ?? "new";

                  return (
                    <>
                      {/* Detail header with back button */}
                      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-border/30 shrink-0">
                        <button
                          onClick={() => setDetailLead(null)}
                          className="text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1 rounded-lg hover:bg-muted/50"
                        >
                          <ChevronDown className="h-4 w-4 -rotate-90" />
                        </button>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <ScoreBadge score={score.score} label={score.label} />
                          <span className="text-xs font-medium truncate">{lead.property_address ?? "—"}</span>
                        </div>
                      </div>

                      {/* Scrollable detail body */}
                      <div className="flex-1 overflow-y-auto">
                        <div className="px-4 py-4 space-y-4">

                          {/* Location */}
                          <div>
                            <p className="text-base font-semibold leading-tight">{lead.property_address ?? "—"}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {[lead.city, lead.state, lead.county ? `${lead.county} County` : null, lead.zip].filter(Boolean).join(" · ")}
                            </p>
                          </div>

                          {/* Why it matters */}
                          <div className="rounded-xl bg-primary/[0.04] border border-primary/10 px-3.5 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/60 mb-1">Why this lead matters</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{explain}</p>
                          </div>

                          {/* Score reasons */}
                          {score.reasons.length > 0 && (
                            <div className="space-y-1.5">
                              {score.reasons.map(r => (
                                <div key={r} className="flex items-center gap-2 text-[11px]">
                                  <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
                                  <span className="text-muted-foreground">{r}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <Separator />

                          {/* Financial + Owner side by side */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Financial</p>
                              {lead.property_value
                                ? <p className="text-sm font-semibold font-mono">{fmt.format(lead.property_value)}</p>
                                : <p className="text-xs text-muted-foreground">No estimate</p>}
                              {lead.equity_estimate && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">Equity: {fmtC.format(lead.equity_estimate)}</p>
                              )}
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Owner</p>
                              {lead.owner_name
                                ? <p className="text-sm font-medium">{lead.owner_name}</p>
                                : <p className="text-xs text-muted-foreground">Not available</p>}
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {lead.is_absentee  && <Badge variant="secondary" className="text-[9px]">Absentee</Badge>}
                                {lead.is_llc_owned && <Badge variant="secondary" className="text-[9px]">LLC</Badge>}
                              </div>
                            </div>
                          </div>

                          {/* Signal */}
                          {(lead.violation_description || lead.status || lead.incident_date) && (
                            <>
                              <Separator />
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Signal</p>
                                {lead.violation_description && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{lead.violation_description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                                  {lead.status && <span>Status: <span className="text-foreground font-medium">{lead.status}</span></span>}
                                  {lead.incident_date && (() => {
                                    const age = incidentAge(lead.incident_date);
                                    return (
                                      <span className="flex items-center gap-1.5">
                                        <Calendar className="h-3 w-3" />{lead.incident_date}
                                        <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", age.badgeClass)}>{age.label}</span>
                                      </span>
                                    );
                                  })()}
                                </div>
                                {incidentAge(lead.incident_date).warning && (
                                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
                                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">{incidentAge(lead.incident_date).warning}</p>
                                  </div>
                                )}
                              </div>
                            </>
                          )}

                          {/* Recommended action */}
                          <div className={cn(
                            "rounded-xl border px-3.5 py-3",
                            action.priority === "high"   ? "border-destructive/20 bg-destructive/[0.04]"
                            : action.priority === "medium" ? "border-amber-500/20 bg-amber-500/[0.04]"
                            : "border-border/50 bg-muted/30"
                          )}>
                            <p className={cn("text-[10px] font-semibold uppercase tracking-wider mb-0.5",
                              action.priority === "high" ? "text-destructive/70" : action.priority === "medium" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                            )}>Recommended Action</p>
                            <p className="text-sm font-medium">{action.label}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{action.reason}</p>
                          </div>

                          {/* Tags */}
                          {lead.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {lead.tags.map(t => (
                                <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                                  <Tag className="h-2.5 w-2.5" />{t}
                                </Badge>
                              ))}
                            </div>
                          )}

                          <Separator />

                          {/* Source */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-medium">{(SOURCE_META as Record<string, { label: string }>)[lead.data_source]?.label ?? lead.data_source}</span>
                            <span>Fetched {relTime(lead.fetched_at)}</span>
                          </div>

                          {/* Review workflow */}
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Mark as</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(["reviewed", "analyzing", "exported", "dismissed"] as LeadReviewStatus[]).map(s => (
                                <button key={s}
                                  onClick={() => setReview(lead, review === s ? "new" : s)}
                                  className={cn(
                                    "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                                    review === s ? REVIEW_STATUS_COLORS[s] + " border-transparent" : "border-border/50 text-muted-foreground hover:text-foreground"
                                  )}>
                                  {REVIEW_STATUS_LABELS[s]}
                                </button>
                              ))}
                            </div>
                          </div>

                        </div>
                      </div>

                      {/* Action footer */}
                      <div className="shrink-0 px-4 py-3 border-t border-border/30 flex gap-2">
                        <button onClick={() => copyAddress(lead)}
                          className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-1">
                          <Copy className="h-3.5 w-3.5" />Copy
                        </button>
                        {lead.source_url && (
                          <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                            <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                              <ExternalLink className="h-3.5 w-3.5" />Source
                            </Button>
                          </a>
                        )}
                        {onAnalyzeLead && lead.property_value && (
                          <Button size="sm" className="flex-1 gap-1.5 text-xs"
                            onClick={() => { setDetailLead(null); onAnalyzeLead(lead); }}>
                            <BarChart2 className="h-3.5 w-3.5" />Analyze
                          </Button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>

    {/* ── Lead Detail Sheet — table/cards view only; map uses inline panel ── */}
    <Sheet open={!!detailLead && viewMode !== "map"} onOpenChange={open => { if (!open) setDetailLead(null); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {detailLead && (() => {
          const { lead, score } = detailLead;
          const action   = recommendAction(lead, score.score);
          const explain  = explainLead(lead);
          const review   = reviewMap.get(reviewKey(lead)) ?? "new";

          return (
            <>
              <SheetHeader className="pb-4">
                <div className="flex items-start gap-3 pr-8">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ScoreBadge score={score.score} label={score.label} />
                      <Badge variant="outline" className="text-[10px]">
                        {LEAD_TYPE_LABELS[lead.lead_type] ?? lead.lead_type}
                      </Badge>
                    </div>
                    <SheetTitle className="text-base leading-snug">
                      {lead.property_address ?? "Unknown address"}
                    </SheetTitle>
                    <SheetDescription className="mt-0.5">
                      {[lead.city, lead.state, lead.county ? `${lead.county} County` : null, lead.zip].filter(Boolean).join(" · ")}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 py-1">

                {/* Why it matters */}
                <div className="rounded-xl bg-primary/[0.04] border border-primary/10 px-4 py-3 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary/70">Why this lead matters</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{explain}</p>
                </div>

                {/* Score breakdown */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5" />Score Breakdown
                  </p>
                  <div className="space-y-1">
                    {score.reasons.map(r => (
                      <div key={r} className="flex items-center gap-2 text-[11px]">
                        <CheckCircle2 className="h-3 w-3 text-accent shrink-0" />
                        <span className="text-muted-foreground">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Financial */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />Financial
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {lead.property_value && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Est. Value</p>
                        <p className="text-sm font-semibold font-mono">{fmt.format(lead.property_value)}</p>
                      </div>
                    )}
                    {lead.equity_estimate && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Equity Est.</p>
                        <p className="text-sm font-semibold font-mono">{fmt.format(lead.equity_estimate)}</p>
                      </div>
                    )}
                    {!lead.property_value && <p className="text-xs text-muted-foreground col-span-2">No value estimate available.</p>}
                  </div>
                </div>

                {/* Owner */}
                {(lead.owner_name || lead.is_absentee || lead.is_llc_owned) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />Owner
                      </p>
                      {lead.owner_name && <p className="text-sm">{lead.owner_name}</p>}
                      {!lead.owner_name && <p className="text-xs text-muted-foreground">Owner name not available in source data.</p>}
                      <div className="flex gap-1.5">
                        {lead.is_absentee  && <Badge variant="secondary" className="text-[10px]">Absentee owner</Badge>}
                        {lead.is_llc_owned && <Badge variant="secondary" className="text-[10px]">LLC-owned</Badge>}
                      </div>
                    </div>
                  </>
                )}

                {/* Signal */}
                {(lead.violation_description || lead.status || lead.incident_date) && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5" />Signal
                      </p>
                      {lead.violation_description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">{lead.violation_description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {lead.status && <span>Status: <span className="text-foreground font-medium">{lead.status}</span></span>}
                        {(() => {
                          const age = incidentAge(lead.incident_date);
                          return (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3" />
                              {lead.incident_date ?? "Unknown date"}
                              <span className={cn(
                                "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                                age.badgeClass
                              )}>{age.label}</span>
                            </span>
                          );
                        })()}
                      </div>
                      {incidentAge(lead.incident_date).warning && (
                        <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                            {incidentAge(lead.incident_date).warning}
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Tags */}
                {lead.tags.length > 0 && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-1">
                      {lead.tags.map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] gap-1">
                          <Tag className="h-2.5 w-2.5" />{t}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}

                {/* Source + freshness */}
                <Separator />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">
                    {(SOURCE_META as Record<string, { label: string }>)[lead.data_source]?.label ?? lead.data_source}
                  </span>
                  <span>Fetched {relTime(lead.fetched_at)}</span>
                </div>

                {/* Recommended action callout */}
                <div className={cn(
                  "rounded-xl border px-4 py-3 space-y-1",
                  action.priority === "high"   ? "border-destructive/20 bg-destructive/[0.04]"
                  : action.priority === "medium" ? "border-amber-500/20 bg-amber-500/[0.04]"
                  : "border-border/50 bg-muted/30"
                )}>
                  <p className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    action.priority === "high" ? "text-destructive/70"
                    : action.priority === "medium" ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground"
                  )}>Recommended Action</p>
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground">{action.reason}</p>
                </div>

                {/* Review workflow */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mark as</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["reviewed", "analyzing", "exported", "dismissed"] as LeadReviewStatus[]).map(s => (
                      <button key={s}
                        onClick={() => setReview(lead, review === s ? "new" : s)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          review === s
                            ? REVIEW_STATUS_COLORS[s] + " border-transparent"
                            : "border-border/50 text-muted-foreground hover:text-foreground"
                        )}>
                        {REVIEW_STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sheet footer actions */}
              <SheetFooter className="mt-6 flex-col sm:flex-row gap-2">
                <button
                  onClick={() => copyAddress(lead)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-1"
                >
                  <Copy className="h-3.5 w-3.5" />Copy address
                </button>
                {lead.source_url && (
                  <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-2">
                      <ExternalLink className="h-3.5 w-3.5" />View source
                    </Button>
                  </a>
                )}
                {onAnalyzeLead && lead.property_value && (
                  <Button size="sm" className="flex-1 gap-2"
                    onClick={() => { setDetailLead(null); onAnalyzeLead(lead); }}>
                    <BarChart2 className="h-3.5 w-3.5" />Analyze in BRRRR
                  </Button>
                )}
              </SheetFooter>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
    </>
  );
};

export default RealEstateDealSourcing;
