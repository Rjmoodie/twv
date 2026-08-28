import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronUp, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { StockData } from "../types";
import { mapStockAnalysisResponse, type StockAnalysisResponse } from "./stockAnalysisMapper";
import {
  comparabilityIssue, comparisonLabel, isComparableObservation, isValidTicker, median, metricsFromStock,
  type MetricObservation, type PeerMetricKey, type PeerMetrics,
} from "./peerComparableMath";
import { isFreshPeerResult, pendingPeerTickers, shouldStopPeerBatch } from "./peerComparableWorkflow";

const MAX_SELECTED_PEERS = 5;
const STORAGE_VERSION = 2;
const ALL_METRICS: Array<{ key: PeerMetricKey; label: string; description: string }> = [
  { key: "pe", label: "P/E", description: "Market capitalization / TTM net income" },
  { key: "evEbitda", label: "EV/EBITDA", description: "Enterprise value / provider TTM EBITDA" },
  { key: "ps", label: "P/S", description: "Market capitalization / TTM revenue" },
  { key: "pFcf", label: "P/FCF", description: "Market capitalization / TTM free cash flow" },
  { key: "pb", label: "P/B", description: "Market capitalization / latest stockholders' equity" },
];

type Suggestion = {
  ticker: string; name: string; industry?: string | null; sector?: string | null;
  score: number; confidence: "high" | "medium"; reasons: string[]; warnings: string[];
};
type LoadedPeer = { ticker: string; name: string; metrics: PeerMetrics; fetchedAt: string };
type PeerFailure = { ticker: string; message: string };
type SavedPeerState = {
  version: number; ticker: string; suggestions: Suggestion[]; selected: string[];
  loaded: LoadedPeer[]; failures: PeerFailure[]; generatedAt: string | null; classificationAsOf: string | null;
};

const storageKey = (ticker: string) => `somatech:peer-comps:v${STORAGE_VERSION}:${ticker}`;
const fresh = (peer: LoadedPeer) => isFreshPeerResult(peer.fetchedAt);

function validSavedState(value: unknown, ticker: string): value is SavedPeerState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<SavedPeerState>;
  if (state.version !== STORAGE_VERSION || state.ticker !== ticker || !Array.isArray(state.suggestions)
    || !Array.isArray(state.selected) || !Array.isArray(state.loaded) || !Array.isArray(state.failures)) return false;
  if (!state.selected.every((item) => typeof item === "string" && isValidTicker(item))) return false;
  if (!state.suggestions.every((item) => item && typeof item.ticker === "string" && isValidTicker(item.ticker)
    && typeof item.name === "string" && typeof item.score === "number" && Array.isArray(item.reasons) && Array.isArray(item.warnings))) return false;
  if (!state.failures.every((item) => item && typeof item.ticker === "string" && typeof item.message === "string")) return false;
  if (!state.loaded.every((peer) => peer && typeof peer.ticker === "string" && typeof peer.fetchedAt === "string"
    && peer.metrics && ALL_METRICS.every(({ key }) => peer.metrics[key] && typeof peer.metrics[key].formula === "string"))) return false;
  if (state.generatedAt != null && typeof state.generatedAt !== "string") return false;
  if (state.classificationAsOf != null && typeof state.classificationAsOf !== "string") return false;
  return true;
}

function readSavedState(ticker: string): SavedPeerState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(ticker)) ?? "null");
    return validSavedState(parsed, ticker) ? parsed : null;
  } catch {
    return null;
  }
}

async function functionError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    return body?.error || error.message;
  }
  return error instanceof Error ? error.message : "The peer data request failed";
}

const number = (value: number | null) => value == null ? "—" : value.toLocaleString(undefined, { maximumFractionDigits: 0 });
const formattedDate = (value: string | null | undefined, includeTime = false) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "unavailable";
  return includeTime ? new Date(value).toLocaleString() : new Date(value).toLocaleDateString();
};
const multiple = (observation: MetricObservation | undefined) => observation?.value == null ? "N/M" : `${observation.value.toFixed(1)}x`;
const observationTitle = (observation: MetricObservation | undefined) => observation
  ? `${observation.formula}\n${observation.numeratorLabel}: ${number(observation.numerator)}\n${observation.denominatorLabel}: ${number(observation.denominator)}\nCurrency: ${observation.currency ?? "unavailable"}\nQuote: ${observation.quoteAsOf ?? "unavailable"}\nFundamentals: ${observation.fundamentalsAsOf ?? "unavailable"}\nSource: ${observation.source}${observation.unavailableReason ? `\nUnavailable: ${observation.unavailableReason}` : ""}`
  : "Unavailable";

interface Props { ticker: string; stockData: StockData | null }

export default function PeerComps({ ticker, stockData }: Props) {
  const [initialState] = useState(() => readSavedState(ticker));
  const [suggestions, setSuggestions] = useState(initialState?.suggestions ?? []);
  const [selected, setSelected] = useState(initialState?.selected ?? []);
  const [loaded, setLoaded] = useState(initialState?.loaded ?? []);
  const [failures, setFailures] = useState(initialState?.failures ?? []);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialState?.generatedAt ?? null);
  const [classificationAsOf, setClassificationAsOf] = useState<string | null>(initialState?.classificationAsOf ?? null);
  const [manualTicker, setManualTicker] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const persistedTicker = useRef(ticker);
  const activeTicker = useRef(ticker);
  const selectedRef = useRef(selected);

  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => {
    activeTicker.current = ticker;
    const saved = readSavedState(ticker);
    setSuggestions(saved?.suggestions ?? []); setSelected(saved?.selected ?? []);
    setLoaded(saved?.loaded ?? []); setFailures(saved?.failures ?? []);
    setGeneratedAt(saved?.generatedAt ?? null); setClassificationAsOf(saved?.classificationAsOf ?? null);
    setManualTicker(""); setSuggesting(false); setLoadingPeers(false); setShowAudit(false);
  }, [ticker]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (persistedTicker.current !== ticker) { persistedTicker.current = ticker; return; }
    const state: SavedPeerState = { version: STORAGE_VERSION, ticker, suggestions, selected, loaded, failures, generatedAt, classificationAsOf };
    try { window.localStorage.setItem(storageKey(ticker), JSON.stringify(state)); }
    catch (error) { console.warn("Could not save peer-comparable state:", error); }
  }, [ticker, suggestions, selected, loaded, failures, generatedAt, classificationAsOf]);

  const targetMetrics = useMemo(() => stockData ? metricsFromStock(stockData) : null, [stockData]);
  const visibleMetrics = useMemo(() => {
    const sector = stockData?.sector?.toLowerCase() ?? "";
    if (sector.includes("financial")) return ALL_METRICS.filter(({ key }) => key === "pe" || key === "pb");
    if (sector.includes("real estate")) return ALL_METRICS.filter(({ key }) => key === "ps" || key === "pb");
    return ALL_METRICS;
  }, [stockData?.sector]);
  const activeFailures = useMemo(() => failures.filter((failure) => selected.includes(failure.ticker)), [failures, selected]);
  const usablePeers = useMemo(() => loaded.filter((peer) => selected.includes(peer.ticker) && fresh(peer)
    && !activeFailures.some((failure) => failure.ticker === peer.ticker)), [loaded, selected, activeFailures]);
  const comparableValues = useMemo(() => Object.fromEntries(ALL_METRICS.map(({ key }) => [key,
    targetMetrics ? usablePeers.map((peer) => peer.metrics[key]).filter((peerMetric) => isComparableObservation(targetMetrics[key], peerMetric)).map((metric) => metric.value) : [],
  ])) as Record<PeerMetricKey, Array<number | null>>, [targetMetrics, usablePeers]);
  const medians = useMemo(() => Object.fromEntries(ALL_METRICS.map(({ key }) => [key, median(comparableValues[key])])) as Record<PeerMetricKey, number | null>, [comparableValues]);

  const suggestPeers = async () => {
    const requestTicker = ticker; setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("stock-analysis", { body: { operation: "suggest-peers", ticker } });
      if (error) throw error;
      if (activeTicker.current !== requestTicker) return;
      const next = Array.isArray(data?.suggestions) ? data.suggestions as Suggestion[] : [];
      setSuggestions(next); setGeneratedAt(data?.generatedAt ?? new Date().toISOString());
      setClassificationAsOf(data?.classificationAsOf ?? null);
      if (!next.length) toast.info("No sufficiently specific automatic matches were found. Add a verified peer manually.");
    } catch (error) {
      if (activeTicker.current === requestTicker) toast.error(await functionError(error));
    } finally { if (activeTicker.current === requestTicker) setSuggesting(false); }
  };

  const removePeer = (candidate: string) => {
    setSelected((current) => current.filter((item) => item !== candidate));
    setLoaded((current) => current.filter((item) => item.ticker !== candidate));
    setFailures((current) => current.filter((item) => item.ticker !== candidate));
  };

  const toggleSelected = (candidate: string) => {
    if (candidate === ticker) return;
    if (selected.includes(candidate)) return removePeer(candidate);
    if (selected.length >= MAX_SELECTED_PEERS) return toast.info(`Choose up to ${MAX_SELECTED_PEERS} peers at a time.`);
    setSelected((current) => [...current, candidate]);
  };

  const addManualPeer = () => {
    const candidate = manualTicker.trim().toUpperCase();
    if (!isValidTicker(candidate)) return toast.error("Enter a valid US stock ticker");
    if (candidate === ticker) return toast.error("The target company cannot also be its own peer");
    if (selected.includes(candidate)) return toast.info(`${candidate} is already selected`);
    if (selected.length >= MAX_SELECTED_PEERS) return toast.info(`Choose up to ${MAX_SELECTED_PEERS} peers at a time.`);
    setSelected((current) => [...current, candidate]); setManualTicker("");
  };

  const loadSelectedPeers = async () => {
    const requestTicker = ticker;
    const pending = pendingPeerTickers(selected, loaded, failures);
    if (!pending.length) return toast.info("All selected peers have current cached results");
    setLoadingPeers(true); setFailures((current) => current.filter((failure) => !pending.includes(failure.ticker)));
    for (let index = 0; index < pending.length; index += 1) {
      const candidate = pending[index];
      try {
        const { data, error } = await supabase.functions.invoke<StockAnalysisResponse>("stock-analysis", { body: { ticker: candidate } });
        if (error) throw error;
        if (!data) throw new Error("No peer data was returned");
        const normalized = mapStockAnalysisResponse(data);
        const peer: LoadedPeer = { ticker: candidate, name: normalized.companyName || candidate, metrics: metricsFromStock(normalized), fetchedAt: data.quote.fetchedAt };
        if (activeTicker.current === requestTicker && selectedRef.current.includes(candidate)) {
          setLoaded((current) => [...current.filter((item) => item.ticker !== candidate), peer]);
          setFailures((current) => current.filter((item) => item.ticker !== candidate));
        }
      } catch (error) {
        const message = await functionError(error);
        if (activeTicker.current === requestTicker && selectedRef.current.includes(candidate)) {
          setFailures((current) => [...current.filter((item) => item.ticker !== candidate), { ticker: candidate, message }]);
        }
        if (activeTicker.current === requestTicker && shouldStopPeerBatch(message)) {
          const deferred = pending.slice(index + 1).filter((item) => selectedRef.current.includes(item));
          setFailures((current) => [...current.filter((failure) => !deferred.includes(failure.ticker)),
            ...deferred.map((item) => ({ ticker: item, message: "Deferred because the market-data limit was reached" }))]);
          break;
        }
      }
    }
    if (activeTicker.current === requestTicker) setLoadingPeers(false);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" />Peer Comparables — {ticker}</CardTitle>
        <CardDescription>Optional secondary analysis. No peer company data is retrieved until you approve peers and select Compare.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!suggestions.length && !selected.length && (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <p className="text-sm font-medium">Build a relevant comparison set</p>
            <p className="mt-1 text-xs text-muted-foreground">Specific industry, SIC, operating-cohort and available scale matches are ranked. Broad-sector-only guesses are excluded.</p>
            <Button className="mt-4 gap-2" onClick={suggestPeers} disabled={suggesting}>{suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}Suggest comparable companies</Button>
          </div>
        )}

        {suggestions.length > 0 && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-semibold">Suggested peers</p><p className="text-xs text-muted-foreground">Select up to {MAX_SELECTED_PEERS}. Suggestions are classifications—not investment recommendations.</p></div>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={suggestPeers} disabled={suggesting}><RefreshCw className={`h-3.5 w-3.5 ${suggesting ? "animate-spin" : ""}`} />Refresh</Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {suggestions.map((suggestion) => {
                const checked = selected.includes(suggestion.ticker);
                return (
                  <button key={suggestion.ticker} type="button" aria-pressed={checked} onClick={() => toggleSelected(suggestion.ticker)} className={`rounded-lg border p-3 text-left transition-colors ${checked ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                    <div className="flex items-start gap-2"><span aria-hidden="true" className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>{checked && <Check className="h-3 w-3" />}</span>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="font-semibold">{suggestion.ticker}</span><Badge variant="secondary" className="text-[10px]">{suggestion.score}/100 · {suggestion.confidence}</Badge></div><p className="truncate text-xs text-muted-foreground">{suggestion.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{suggestion.reasons.slice(0, 3).join(" · ")}</p>{suggestion.warnings.length > 0 && <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">{suggestion.warnings.slice(0, 2).join(" · ")}{suggestion.warnings.length > 2 ? ` · +${suggestion.warnings.length - 2} more` : ""}</p>}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">Generated {formattedDate(generatedAt, true)}; classification data retrieved {formattedDate(classificationAsOf, true)}.</p>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input value={manualTicker} onChange={(event) => setManualTicker(event.target.value.toUpperCase())} onKeyDown={(event) => event.key === "Enter" && addManualPeer()} placeholder="Add ticker manually" aria-label="Peer ticker" className="h-9 w-48 font-mono" maxLength={10} />
          <Button size="sm" variant="outline" onClick={addManualPeer} className="gap-1"><Plus className="h-3.5 w-3.5" />Add peer</Button>
          {selected.length > 0 && <Button size="sm" onClick={loadSelectedPeers} disabled={loadingPeers} className="gap-1.5">{loadingPeers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}Compare selected ({selected.length})</Button>}
        </div>

        {stockData?.sector?.toLowerCase().includes("financial") && <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">Financial-company view: P/E and P/B only. Enterprise-value and free-cash-flow multiples are suppressed because they are generally not comparable for regulated balance-sheet businesses.</p>}
        {stockData?.sector?.toLowerCase().includes("real estate") && <p className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">Real-estate view: P/S and P/B only. P/FFO is not shown because standardized FFO data is not available from the current filing feed.</p>}

        {selected.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-sm">
              <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 text-left">Company</th>{visibleMetrics.map((metric) => <th key={metric.key} className="px-2 py-2 text-center" title={metric.description}>{metric.label}</th>)}<th className="w-10" /></tr></thead>
              <tbody className="divide-y">
                <tr className="bg-primary/5"><td className="py-2 font-semibold text-primary">{ticker}<span className="ml-2 text-[10px] font-normal text-muted-foreground">target</span></td>{visibleMetrics.map(({ key }) => <td key={key} className="px-2 py-2 text-center font-mono" title={observationTitle(targetMetrics?.[key])}>{multiple(targetMetrics?.[key])}</td>)}<td /></tr>
                {selected.map((candidate) => {
                  const peer = loaded.find((item) => item.ticker === candidate);
                  const failure = failures.find((item) => item.ticker === candidate);
                  const stale = peer ? !fresh(peer) : false;
                  return <tr key={candidate} className={failure || stale ? "bg-amber-500/5" : undefined}><td className="py-2"><div className="flex items-center gap-2 font-semibold">{candidate}{stale && <Badge variant="outline" className="text-[9px]">stale</Badge>}{failure && <Badge variant="outline" className="text-[9px] text-amber-700">excluded</Badge>}</div><div className="max-w-64 truncate text-[10px] text-muted-foreground" title={failure?.message}>{failure ? failure.message : peer ? `${peer.name} · quote ${formattedDate(peer.fetchedAt)}` : "Selected · not loaded"}</div></td>{visibleMetrics.map(({ key }) => { const issue = peer && targetMetrics ? comparabilityIssue(targetMetrics[key], peer.metrics[key]) : null; return <td key={key} className={`px-2 py-2 text-center font-mono ${issue ? "text-muted-foreground" : ""}`} title={`${issue ? `Excluded from median: ${issue}\n` : ""}${observationTitle(peer?.metrics[key])}`}>{multiple(peer?.metrics[key])}{issue && <sup className="ml-0.5 text-[8px]">†</sup>}</td>; })}<td><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removePeer(candidate)} aria-label={`Remove ${candidate}`}><Trash2 className="h-3.5 w-3.5" /></Button></td></tr>;
                })}
              </tbody>
              {usablePeers.length > 0 && <tfoot><tr className="border-t bg-muted/30"><td className="py-2 text-xs font-medium">Comparable median</td>{visibleMetrics.map(({ key }) => <td key={key} className="px-2 py-2 text-center font-mono text-xs">{medians[key] != null ? `${medians[key]!.toFixed(1)}x` : "—"}</td>)}<td /></tr></tfoot>}
            </table>
          </div>
        )}

        {usablePeers.length > 0 && targetMetrics && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{visibleMetrics.map(({ key, label }) => <div key={key} className="rounded-xl border p-3 text-center"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-bold">{multiple(targetMetrics[key])}</p><p className="mt-1 text-[10px] text-muted-foreground">{comparisonLabel(targetMetrics[key].value, medians[key], comparableValues[key].length)}</p></div>)}</div>}
        {activeFailures.length > 0 && <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground"><AlertCircle className="h-4 w-4 shrink-0 text-amber-600" /><span>{activeFailures.length} peer request{activeFailures.length === 1 ? "" : "s"} could not be completed. Failed and stale rows are excluded from medians; successful rows remain available.</span></div>}

        {selected.length > 0 && <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setShowAudit((current) => !current)}>{showAudit ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}Calculation audit</Button>}
        {showAudit && targetMetrics && <div className="space-y-4 rounded-lg border bg-muted/20 p-3 text-xs"><p className="font-semibold">Calculation inputs and sources</p>{[{ ticker, metrics: targetMetrics, fetchedAt: null }, ...loaded.filter((peer) => selected.includes(peer.ticker))].map((company) => { const rowFailure = failures.find((failure) => failure.ticker === company.ticker); const rowIssue = rowFailure?.message ?? (company.fetchedAt && !isFreshPeerResult(company.fetchedAt) ? "Cached peer result is stale" : null); return <section key={company.ticker} className="space-y-2"><p className="font-semibold text-primary">{company.ticker}{rowIssue ? ` — excluded: ${rowIssue}` : ""}</p>{visibleMetrics.map(({ key, label }) => { const item = company.metrics[key]; const issue = company.ticker === ticker ? null : rowIssue ?? comparabilityIssue(targetMetrics[key], item); return <div key={key} className="grid gap-1 border-t pt-2 sm:grid-cols-[90px_1fr]"><span className="font-medium">{label}</span><span className="text-muted-foreground">{item.formula}; {item.numeratorLabel} {number(item.numerator)} ÷ {item.denominatorLabel} {number(item.denominator)}. Currency {item.currency ?? "unavailable"}; quote {item.quoteAsOf ?? "unavailable"}; fundamentals {item.fundamentalsAsOf ?? "unavailable"}. {item.unavailableReason ?? item.source}{issue ? ` Excluded from median: ${issue}.` : ""}</span></div>; })}</section>; })}</div>}
        <p className="text-xs text-muted-foreground">N/M means a multiple is not meaningful because an input is zero, negative, incomplete or unavailable. † values remain visible for review but are excluded from medians because their currency, quote date, filing date or basis is not comparable. Conclusions require at least three comparable observations.</p>
      </CardContent>
    </Card>
  );
}
