/**
 * Universe Scorer
 *
 * Automatically scores the curated ticker universe for a portfolio's goal.
 * Results are stored in research_results and used by the recommendation engine.
 * Runs in the background — callers don't need to wait for completion.
 */

import { supabase } from '@/integrations/supabase/client'
import { scoreCompany } from './researchEngine'
import { getUniverse } from '@/data/universes'
import type { GoalType, ResearchResult } from '@/types/portfolio'

const UNIVERSE_STALE_DAYS = 30

/**
 * Returns true when the universe results for this portfolio are stale and need a refresh.
 */
export async function isUniverseStale(portfolioId: string): Promise<boolean> {
  const { data } = await supabase
    .from('research_results')
    .select('generated_at')
    .eq('portfolio_id', portfolioId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.generated_at) return true

  const ageDays = (Date.now() - new Date(data.generated_at).getTime()) / 86_400_000
  return ageDays > UNIVERSE_STALE_DAYS
}

/**
 * Loads already-scored results for a portfolio from the DB.
 */
export async function loadScoredUniverse(portfolioId: string): Promise<ResearchResult[]> {
  const { data } = await supabase
    .from('research_results')
    .select('raw_result')
    .eq('portfolio_id', portfolioId)
    .order('composite_score', { ascending: false })

  return (data ?? [])
    .map((r) => r.raw_result as unknown as ResearchResult)
    .filter(Boolean)
}

/**
 * Scores the entire curated universe for a portfolio goal.
 * Persists each result to research_results as it completes.
 * onProgress called with (done, total) after each ticker.
 */
export async function scoreUniverse(
  portfolioId: string,
  goal: GoalType,
  horizonYears: number,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ResearchResult[]> {
  const universe = getUniverse(goal)
  const results: ResearchResult[] = []

  for (let i = 0; i < universe.length; i++) {
    if (signal?.aborted) break
    const { ticker, bucket } = universe[i]

    try {
      const r = await scoreCompany(ticker, {
        goal,
        horizon_years: horizonYears,
        target_bucket:  bucket,
      })
      results.push(r)

      // Persist immediately so partial results are available
      await supabase
        .from('research_results')
        .upsert({
          portfolio_id:       portfolioId,
          ticker:             r.ticker,
          composite_score:    r.composite_score,
          goal_alignment_pct: r.goal_alignment_pct,
          passes_filters:     r.passes_filters,
          bucket:             r.bucket,
          rank_in_bucket:     0,  // re-ranked after full run
          generated_at:       new Date().toISOString(),
          raw_result:         r as unknown as Record<string, unknown>,
        }, { onConflict: 'portfolio_id,ticker' })
    } catch {
      // Skip tickers EDGAR doesn't have — foreign filers, ETFs, etc.
    }

    onProgress?.(i + 1, universe.length)
    if (i < universe.length - 1) await new Promise((r) => setTimeout(r, 120))
  }

  // Update ranks now that all scores are in
  const ranked = [...results].sort((a, b) => b.composite_score - a.composite_score)
  await Promise.all(
    ranked.map((r, idx) =>
      supabase
        .from('research_results')
        .update({ rank_in_bucket: idx + 1 })
        .eq('portfolio_id', portfolioId)
        .eq('ticker', r.ticker)
    )
  )

  return ranked
}
