import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { scoreCompany } from '@/services/research/researchEngine'
import { dataAgeDays, isFilingDue } from '@/services/research/edgarService'
import { GOAL_LABELS, BUCKET_LABELS, type Portfolio, type AssetBucket, type GoalType } from '@/types/portfolio'
import type { ResearchResult } from '@/types/portfolio'
import { formatPct, formatScore, FLAG_LABELS } from './portfolioUtils'
import { FlaskConical, Search, AlertTriangle, ChevronDown, ChevronUp, X, PlusCircle, Bookmark } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { usePortfolio } from '@/contexts/PortfolioContext'
import AddToPortfolioDialog from './AddToPortfolioDialog'

interface Props {
  portfolio: Portfolio
}

interface RowState {
  expanded: boolean
}

const isResearchResult = (value: unknown): value is ResearchResult => {
  if (!value || typeof value !== 'object') return false
  const row = value as Partial<ResearchResult>
  return typeof row.ticker === 'string'
    && typeof row.composite_score === 'number'
    && Boolean(row.quality && row.value && row.growth && row.moat && row.earnings_quality)
    && Array.isArray(row.flags)
    && Array.isArray(row.data_sources)
}

export default function ResearchQueue({ portfolio }: Props) {
  const [tickerInput, setTickerInput] = useState('')
  const [results, setResults] = useState<ResearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [rowState, setRowState] = useState<Record<string, RowState>>({})
  const [error, setError] = useState<string | null>(null)
  const [addDialog, setAddDialog] = useState<{ result: ResearchResult; price?: number } | null>(null)
  const [loadingWatchlist, setLoadingWatchlist] = useState(false)

  const { active } = usePortfolio()
  const heldTickers = new Set((active?.holdings ?? []).map((h) => h.ticker.toUpperCase()))

  const loadFromWatchlist = useCallback(async () => {
    setLoadingWatchlist(true)
    try {
      const { data } = await supabase
        .from('watchlist')
        .select('ticker')
        .order('added_at', { ascending: false })
      if (data && data.length > 0) {
        setTickerInput(data.map((w) => w.ticker).join(', '))
      }
    } finally {
      setLoadingWatchlist(false)
    }
  }, [])

  const filter = GOAL_LABELS[portfolio.goal as GoalType]

  // Load persisted results for this portfolio on mount
  useEffect(() => {
    async function load() {
      const { data, error: loadError } = await supabase
        .from('research_results')
        .select('raw_result')
        .eq('portfolio_id', portfolio.id)
        .order('rank_in_bucket', { ascending: true })
      if (loadError) {
        setError('Saved research could not be loaded. You can retry by scoring the tickers again.')
      } else if (data && data.length > 0) {
        const loaded = data
          .map((r) => r.raw_result)
          .filter(isResearchResult)
          .sort((a, b) => b.composite_score - a.composite_score)
        setResults(loaded)
      }
    }
    void load()
  }, [portfolio.id])

  const toggleRow = (ticker: string) =>
    setRowState((prev) => ({ ...prev, [ticker]: { expanded: !prev[ticker]?.expanded } }))

  const runResearch = useCallback(async () => {
    const tickers = tickerInput
      .split(/[\s,]+/)
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean)

    if (tickers.length === 0) return

    setLoading(true)
    setError(null)
    setResults([])
    setProgress({ done: 0, total: tickers.length })

    const scored: ResearchResult[] = []
    const failedTickers: string[] = []
    for (let i = 0; i < tickers.length; i++) {
      try {
        const r = await scoreCompany(tickers[i], {
          goal: portfolio.goal as GoalType,
          horizon_years: portfolio.horizon_years,
        })
        scored.push(r)
        scored.sort((a, b) => b.composite_score - a.composite_score)
        setResults([...scored])
      } catch {
        failedTickers.push(tickers[i])
      }
      setProgress({ done: i + 1, total: tickers.length })
      if (i < tickers.length - 1) await new Promise((r) => setTimeout(r, 120))
    }

    // Persist to DB — upsert each result ranked by composite score
    if (scored.length > 0) {
      const rows = scored.map((r, idx) => ({
        portfolio_id:       portfolio.id,
        ticker:             r.ticker,
        composite_score:    r.composite_score,
        goal_alignment_pct: r.goal_alignment_pct,
        passes_filters:     r.passes_filters,
        bucket:             r.bucket,
        rank_in_bucket:     idx + 1,
        generated_at:       new Date().toISOString(),
        raw_result:         r as unknown as Record<string, unknown>,
      }))
      const { error: persistError } = await supabase
        .from('research_results')
        .upsert(rows, { onConflict: 'portfolio_id,ticker' })
      if (persistError) {
        setError('Scores were calculated, but could not be saved. The results remain visible for this session.')
      }
    }

    if (failedTickers.length > 0) {
      setError(`Could not score ${failedTickers.join(', ')}. Successful results are shown below.`)
    } else if (scored.length === 0) {
      setError('No tickers could be scored. Check the symbols and try again.')
    }
    setLoading(false)
    setProgress(null)
  }, [tickerInput, portfolio.id, portfolio.goal, portfolio.horizon_years])

  const scoreColor = (s: number) =>
    s >= 7 ? 'text-accent' : s >= 5 ? 'text-yellow-600' : 'text-destructive'

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 p-3">
        <div className="flex items-start gap-2">
          <FlaskConical className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-800 dark:text-blue-300">
            <strong>{filter} research filters active.</strong>{' '}
            Scores are computed from SEC EDGAR XBRL financials using Piotroski F-Score, Greenblatt ROIC, FCF yield, and earnings quality models.
            Horizon: <strong>{portfolio.horizon_years}yr</strong>.
          </div>
        </div>
      </div>

      {/* Input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Score tickers against your portfolio goal</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadFromWatchlist}
              disabled={loadingWatchlist || loading}
              className="text-xs text-muted-foreground"
            >
              <Bookmark className="w-3.5 h-3.5 mr-1" />
              {loadingWatchlist ? 'Loading…' : 'From watchlist'}
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="AAPL, MSFT, GOOG — comma or space separated"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !loading && runResearch()}
              className="font-mono text-sm"
            />
            <Button onClick={runResearch} disabled={loading || !tickerInput.trim()}>
              <Search className="w-4 h-4 mr-1" />
              {loading ? 'Scoring…' : 'Score'}
            </Button>
            {results.length > 0 && !loading && (
              <Button variant="ghost" size="icon" onClick={async () => {
                setResults([])
                setTickerInput('')
                await supabase.from('research_results').delete().eq('portfolio_id', portfolio.id)
              }}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
          {progress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Fetching EDGAR data…</span>
                <span>{progress.done}/{progress.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all rounded-full"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{results.length} result{results.length !== 1 ? 's' : ''}</h3>
            <p className="text-xs text-muted-foreground">Sorted by composite score</p>
          </div>
          {results.map((r, idx) => {
            const expanded = rowState[r.ticker]?.expanded ?? false
            const inPortfolio = heldTickers.has(r.ticker.toUpperCase())
            return (
              <Card key={r.ticker} className={r.passes_filters ? '' : 'opacity-80'}>
                <CardContent className="p-0">
                  {/* Main row */}
                  <div className="p-4 flex items-center gap-3">
                    <button
                      className="flex-1 text-left flex items-center gap-3 hover:bg-muted/30 -m-4 p-4 rounded-t-lg transition-colors min-w-0"
                      onClick={() => toggleRow(r.ticker)}
                    >
                      <span className="w-6 text-xs text-muted-foreground tabular-nums shrink-0">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">{r.ticker}</span>
                          <span className="text-xs text-muted-foreground truncate">{r.company_name}</span>
                          {r.passes_filters && <Badge className="text-xs">Passes filters</Badge>}
                          {inPortfolio && <Badge variant="secondary" className="text-xs">In portfolio</Badge>}
                          {r.institutional_context && r.institutional_context.manager_count > 0 && (
                            <Badge variant="outline">
                              13F: {r.institutional_context.accumulating_count} adding · {r.institutional_context.reducing_count} reducing
                            </Badge>
                          )}
                          {r.flags.slice(0, 2).map((f) => (
                            <Badge key={f} variant="destructive" className="text-xs">{FLAG_LABELS[f] ?? f}</Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span>Alignment: <strong className="text-foreground">{r.goal_alignment_pct}%</strong></span>
                          <span>Piotroski: <strong className="text-foreground">{r.quality.piotroski}/9</strong></span>
                          <span className="hidden sm:inline">EV/EBIT: <strong className="text-foreground">{r.value.ev_ebit?.toFixed(1) ?? '—'}</strong></span>
                          {r.data_as_of && (
                            <span className={isFilingDue(r.data_as_of) ? 'text-warning font-medium' : ''}>
                              {isFilingDue(r.data_as_of) ? '⚠ ' : ''}data {dataAgeDays(r.data_as_of)}d old
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={`text-2xl font-bold tabular-nums ${scoreColor(r.composite_score)}`}>
                        {r.composite_score.toFixed(1)}
                      </div>
                      {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                    </button>
                    <Button
                      size="sm"
                      variant={inPortfolio ? 'outline' : 'default'}
                      className="shrink-0 ml-2"
                      onClick={() => setAddDialog({ result: r, price: r.current_price ?? undefined })}
                    >
                      <PlusCircle className="w-3.5 h-3.5 mr-1" />
                      {inPortfolio ? 'Update' : 'Add'}
                    </Button>
                  </div>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t px-4 pb-4 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <ScoreBlock label="Quality" value={r.quality.composite} outOf={10}>
                        <p className="text-xs text-muted-foreground">Piotroski {r.quality.piotroski}/9</p>
                        <p className="text-xs text-muted-foreground">ROIC avg: {r.quality.roic_5yr_avg != null ? `${(r.quality.roic_5yr_avg * 100).toFixed(1)}%` : '—'}</p>
                        <p className="text-xs text-muted-foreground">FCF consistency: {r.quality.fcf_consistency != null ? `${(r.quality.fcf_consistency * 100).toFixed(0)}%` : '—'}</p>
                      </ScoreBlock>
                      <ScoreBlock label="Value" value={r.value.composite} outOf={10} coverage={r.value.coverage}>
                        <p className="text-xs text-muted-foreground">EV/EBIT: {r.value.ev_ebit?.toFixed(1) ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">FCF yield: {formatPct(r.value.fcf_yield)}</p>
                        <p className="text-xs text-muted-foreground">DCF upside: {formatPct(r.value.dcf_upside_pct)}</p>
                      </ScoreBlock>
                      <ScoreBlock label="Growth" value={r.growth.composite} outOf={10} coverage={r.growth.coverage}>
                        <p className="text-xs text-muted-foreground">Rev CAGR 3yr: {formatPct(r.growth.revenue_cagr_3yr)}</p>
                        <p className="text-xs text-muted-foreground">Rev CAGR 5yr: {formatPct(r.growth.revenue_cagr_5yr)}</p>
                        <p className="text-xs text-muted-foreground">ROIIC: {formatPct(r.growth.roiic)}</p>
                      </ScoreBlock>
                      <ScoreBlock label="Moat" value={r.moat.composite} outOf={5}>
                        <p className="text-xs text-muted-foreground">GM stability: {r.moat.gross_margin_stability != null ? `${(r.moat.gross_margin_stability * 100).toFixed(0)}%` : '—'}</p>
                        <p className="text-xs text-muted-foreground">ROIC {'>'} 10%: {r.moat.roic_vs_wacc_years ?? 0}/5 yrs</p>
                      </ScoreBlock>
                      <div className="col-span-2 sm:col-span-4">
                        <p className="text-xs text-muted-foreground">Earnings quality — OCF/NI: <strong>{r.earnings_quality.ocf_to_ni?.toFixed(2) ?? '—'}</strong> · Accruals ratio: <strong>{r.earnings_quality.accruals_ratio?.toFixed(3) ?? '—'}</strong></p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-muted-foreground">
                            Data as of: {r.data_as_of || '—'}
                            {dataAgeDays(r.data_as_of) != null && (
                              <span className="ml-1 text-muted-foreground">
                                ({dataAgeDays(r.data_as_of)}d ago)
                              </span>
                            )}
                            {' · '}Source: {r.data_sources.join(', ')}
                          </p>
                          {isFilingDue(r.data_as_of) && (
                            <Badge variant="outline" className="text-xs border-warning/20 text-warning dark:text-warning">
                              New 10-K likely available — re-score
                            </Badge>
                          )}
                        </div>
                        {/* The header already shows the first two; repeating them
                            here rendered the same flag twice on one card. */}
                        {r.flags.length > 2 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {r.flags.slice(2).map((f) => (
                              <Badge key={f} variant="destructive" className="text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />{FLAG_LABELS[f] ?? f}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Price context panel */}
                      {r.price_context && (
                        <div className="col-span-2 sm:col-span-4 rounded-lg border bg-muted/20 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price Context</p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Current Price</p>
                              <p className="font-semibold text-sm">
                                {r.price_context.current_price != null ? `$${r.price_context.current_price.toFixed(2)}` : '—'}
                              </p>
                              {r.price_context.price_as_of && (
                                <p className="text-[10px] text-muted-foreground">
                                  close {new Date(r.price_context.price_as_of).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">52w Range</p>
                              <p className="font-semibold text-sm tabular-nums">
                                {r.price_context.week52_low != null && r.price_context.week52_high != null
                                  ? `$${r.price_context.week52_low.toFixed(0)} – $${r.price_context.week52_high.toFixed(0)}`
                                  : '—'}
                              </p>
                              {r.price_context.week52_position_pct != null && (
                                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-blue-500 transition-all"
                                    style={{ width: `${r.price_context.week52_position_pct}%` }}
                                  />
                                </div>
                              )}
                              {r.price_context.week52_position_pct != null && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {r.price_context.week52_position_pct.toFixed(0)}% of 52w range
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">200d MA</p>
                              <p className="font-semibold text-sm tabular-nums">
                                {r.price_context.ma_200day != null ? `$${r.price_context.ma_200day.toFixed(2)}` : '—'}
                              </p>
                              {r.price_context.above_200d_ma != null && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs mt-1 ${r.price_context.above_200d_ma ? 'border-emerald-400 text-accent dark:text-accent' : 'border-destructive/20 text-destructive dark:text-destructive'}`}
                                >
                                  {r.price_context.above_200d_ma ? 'Above 200d MA' : 'Below 200d MA'}
                                </Badge>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Analyst Target</p>
                              <p className="font-semibold text-sm tabular-nums">
                                {r.price_context.analyst_target != null ? `$${r.price_context.analyst_target.toFixed(2)}` : '—'}
                              </p>
                              {r.price_context.analyst_upside_pct != null && (
                                <p className={`text-xs font-medium mt-0.5 ${r.price_context.analyst_upside_pct >= 0 ? 'text-accent' : 'text-destructive'}`}>
                                  {r.price_context.analyst_upside_pct >= 0 ? '+' : ''}{(r.price_context.analyst_upside_pct * 100).toFixed(1)}% analyst upside
                                </p>
                              )}
                            </div>
                          </div>
                          {(r.price_context.price_provider || r.price_context.market_stats_as_of) && (
                            <p className="text-[10px] leading-snug text-muted-foreground">
                              {r.price_context.price_provider && `Quote: ${r.price_context.price_provider}. `}
                              End-of-day, not real time
                              {r.price_context.market_stats_as_of &&
                                `; 52w range, 200d MA and analyst target fetched ${new Date(r.price_context.market_stats_as_of).toLocaleDateString()}`}
                              . The percentages above combine the two, so treat them as indicative rather than live.
                            </p>
                          )}
                        </div>
                      )}

                      {/* DCF valuation panel */}
                      {r.valuation && (
                        <div className="col-span-2 sm:col-span-4 rounded-lg border bg-muted/20 p-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">DCF Intrinsic Value Range</p>
                          <div className="grid grid-cols-3 gap-3">
                            {(['conservative', 'base', 'optimistic'] as const).map((scenario) => {
                              const s = r.valuation![scenario]
                              const upside = s.upside_pct
                              return (
                                <div key={scenario} className="text-center">
                                  <p className="text-xs text-muted-foreground capitalize">{scenario}</p>
                                  <p className="font-semibold text-sm tabular-nums">
                                    {s.intrinsic_value != null ? `$${s.intrinsic_value.toFixed(2)}` : '—'}
                                  </p>
                                  {upside != null && (
                                    <p className={`text-xs font-medium ${upside >= 0 ? 'text-accent' : 'text-destructive'}`}>
                                      {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    g={( s.growth_rate * 100).toFixed(0)}% / d={(s.discount_rate * 100).toFixed(0)}%
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                          {r.valuation.graham_number != null && (
                            <p className="text-xs text-muted-foreground border-t pt-2">
                              Graham Number: <strong className="text-foreground">${r.valuation.graham_number.toFixed(2)}</strong>
                              {r.price_context?.current_price != null && (
                                <span className={`ml-2 font-medium ${r.price_context.current_price <= r.valuation.graham_number ? 'text-accent' : 'text-destructive'}`}>
                                  ({r.price_context.current_price <= r.valuation.graham_number ? 'below' : 'above'} Graham Number)
                                </span>
                              )}
                            </p>
                          )}
                        </div>
                      )}

                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add to Portfolio dialog */}
      {addDialog && (
        <AddToPortfolioDialog
          open={!!addDialog}
          onOpenChange={(open) => { if (!open) setAddDialog(null) }}
          ticker={addDialog.result.ticker}
          companyName={addDialog.result.company_name}
          currentPrice={addDialog.price}
          dcfUpsidePct={addDialog.result.value.dcf_upside_pct ?? undefined}
          suggestedBucket={addDialog.result.bucket}
          compositeScore={addDialog.result.composite_score}
        />
      )}
    </div>
  )
}

function ScoreBlock({
  label,
  value,
  outOf,
  coverage,
  children,
}: {
  label: string
  value: number
  outOf: number
  /** Share of this score's inputs that were available, 0–1. */
  coverage?: number
  children?: React.ReactNode
}) {
  const pct = (value / outOf) * 100
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'
  // Missing inputs are scored at neutral, which pulls a partial score toward the
  // middle. Saying so is the difference between a score and a guess.
  const thin = coverage != null && coverage < 1
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="font-medium">
          {label}
          {thin && (
            <span
              className="ml-1 font-normal text-[10px] text-warning"
              title={`Only ${Math.round(coverage! * 100)}% of this score's inputs were available. The rest are held at neutral.`}
            >
              partial
            </span>
          )}
        </span>
        <span className="tabular-nums text-muted-foreground">{value.toFixed(1)}/{outOf}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {children}
    </div>
  )
}
