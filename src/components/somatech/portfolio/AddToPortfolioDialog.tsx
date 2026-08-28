import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { getHoldingMarketValue, upsertHolding } from '@/services/portfolio/portfolioService'
import { BUCKET_LABELS, GOAL_LABELS, type AssetBucket, type Portfolio } from '@/types/portfolio'
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'

// ─── Position sizing ──────────────────────────────────────────────────────────

interface SizingSuggestion {
  suggested_pct:   number   // 0–100
  suggested_usd:   number | null
  suggested_shares: number | null
  label: string             // e.g. "Conviction-weighted (7.2/10)"
}

function computePositionSizing(
  portfolio: Portfolio | undefined,
  compositeScore: number | undefined,
  currentPrice: number | undefined,
): SizingSuggestion | null {
  if (!portfolio) return null
  const maxPct = portfolio.max_single_position_pct   // e.g. 10 (percent)
  const score  = compositeScore ?? 5

  // Scale position size linearly from 20% of max (at score=0) to 100% of max (at score=10)
  // Floor at 20% so even low-conviction adds get a meaningful starting point
  const scaleFactor = 0.20 + (score / 10) * 0.80
  const suggested_pct = scaleFactor * maxPct          // % of total portfolio value

  const totalValue = (portfolio.holdings ?? []).reduce(
    (s, h) => s + getHoldingMarketValue(h), 0,
  )
  // Fall back to initial_capital when no holdings recorded yet
  const basis = totalValue > 0 ? totalValue : (portfolio.initial_capital ?? null)
  const suggested_usd    = basis != null ? (suggested_pct / 100) * basis : null
  const suggested_shares = suggested_usd != null && currentPrice != null && currentPrice > 0
    ? suggested_usd / currentPrice
    : null

  return {
    suggested_pct,
    suggested_usd,
    suggested_shares,
    label: `Conviction-weighted (${score.toFixed(1)}/10)`,
  }
}

interface AddToPortfolioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  ticker: string
  companyName: string
  currentPrice?: number
  marketCap?: number
  dcfUpsidePct?: number      // decimal, e.g. 0.23 = 23%
  suggestedBucket?: AssetBucket
  compositeScore?: number    // 0–10 from research engine
}

const BUCKET_ORDER: AssetBucket[] = [
  'US_EQUITY_LARGE',
  'US_EQUITY_SMALL',
  'INTL_EQUITY_DEVELOPED',
  'INTL_EQUITY_EMERGING',
  'FIXED_INCOME_INVESTMENT_GRADE',
  'FIXED_INCOME_HIGH_YIELD',
  'REAL_ASSETS',
  'ALTERNATIVES',
  'CASH',
]

export default function AddToPortfolioDialog({
  open,
  onOpenChange,
  ticker,
  companyName,
  currentPrice,
  marketCap,
  dcfUpsidePct,
  suggestedBucket,
  compositeScore,
}: AddToPortfolioDialogProps) {
  const { portfolios, active, refresh } = usePortfolio()

  const [portfolioId, setPortfolioId] = useState<string>(() => active?.id ?? portfolios[0]?.id ?? '')
  const [bucket, setBucket] = useState<AssetBucket>(suggestedBucket ?? 'US_EQUITY_LARGE')
  const [shares, setShares] = useState('')
  const [costBasis, setCostBasis] = useState(currentPrice ? currentPrice.toFixed(2) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const sharesNum = parseFloat(shares) || undefined
  const costNum = parseFloat(costBasis) || undefined
  const marketValue = sharesNum != null && currentPrice != null
    ? sharesNum * currentPrice
    : undefined

  const selectedPortfolio = portfolios.find((p) => p.id === portfolioId)

  const sizing = useMemo(
    () => computePositionSizing(selectedPortfolio, compositeScore, currentPrice),
    [selectedPortfolio, compositeScore, currentPrice],
  )

  function applySuggestion() {
    if (!sizing?.suggested_shares) return
    setShares(sizing.suggested_shares.toFixed(2))
  }

  // Edge case: portfolio at max positions (and this is a new ticker, not an update)
  const holdings = selectedPortfolio?.holdings ?? []
  const isExisting = holdings.some((h) => h.ticker === ticker.toUpperCase())
  const atMaxPositions = !isExisting && holdings.length >= (selectedPortfolio?.max_positions ?? Infinity)

  // Edge case: composite score below portfolio's min conviction threshold
  const belowConviction = compositeScore != null && selectedPortfolio != null
    && compositeScore < selectedPortfolio.min_conviction_score

  async function handleSave() {
    if (!portfolioId || atMaxPositions) return
    setSaving(true)
    setError(null)
    try {
      await upsertHolding(portfolioId, {
        ticker: ticker.toUpperCase(),
        company_name: companyName,
        bucket,
        shares: sharesNum,
        cost_basis: costNum,
        current_price: currentPrice,
        market_value: marketValue,
      })
      await refresh()
      setDone(true)
      setTimeout(() => {
        setDone(false)
        onOpenChange(false)
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holding.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Add to Portfolio
            <Badge variant="outline" className="font-mono">{ticker}</Badge>
          </DialogTitle>
          {companyName && (
            <p className="text-sm text-muted-foreground">{companyName}</p>
          )}
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-accent">
            <CheckCircle2 className="w-8 h-8" />
            <p className="font-medium">Added to portfolio</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Portfolio selector */}
            {portfolios.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="port-select">Portfolio</Label>
                <Select value={portfolioId} onValueChange={setPortfolioId}>
                  <SelectTrigger id="port-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {GOAL_LABELS[p.goal]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPortfolio && (
                  <p className="text-xs text-muted-foreground">
                    {selectedPortfolio.horizon_years}yr horizon · Risk {selectedPortfolio.risk_tolerance}/5
                  </p>
                )}
              </div>
            )}

            {/* Bucket */}
            <div className="space-y-1.5">
              <Label htmlFor="bucket-select">Asset Bucket</Label>
              <Select value={bucket} onValueChange={(v) => setBucket(v as AssetBucket)}>
                <SelectTrigger id="bucket-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BUCKET_ORDER.map((b) => (
                    <SelectItem key={b} value={b}>{BUCKET_LABELS[b]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Price & shares */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="shares-input">Shares (optional)</Label>
                <Input
                  id="shares-input"
                  type="number"
                  min={0}
                  step="any"
                  placeholder="100"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cost-input">Cost Basis / share</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="cost-input"
                    type="number"
                    min={0}
                    step="any"
                    placeholder={currentPrice?.toFixed(2) ?? '0.00'}
                    className="pl-6"
                    value={costBasis}
                    onChange={(e) => setCostBasis(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Position sizing suggestion */}
            {sizing && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-blue-800 dark:text-blue-300">
                    <Sparkles className="w-3.5 h-3.5" />
                    Suggested size: {sizing.label}
                  </div>
                  {sizing.suggested_shares != null && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      onClick={applySuggestion}
                    >
                      Use
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-blue-800 dark:text-blue-300">
                  <div>
                    <p className="text-blue-600/70 dark:text-blue-400/70">Portfolio %</p>
                    <p className="font-semibold">{sizing.suggested_pct.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-blue-600/70 dark:text-blue-400/70">Capital</p>
                    <p className="font-semibold">
                      {sizing.suggested_usd != null
                        ? `$${sizing.suggested_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-blue-600/70 dark:text-blue-400/70">Shares</p>
                    <p className="font-semibold">
                      {sizing.suggested_shares != null ? sizing.suggested_shares.toFixed(1) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Snapshot row */}
            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground grid grid-cols-3 gap-2">
              <div>
                <p>Current Price</p>
                <p className="font-medium text-foreground">{currentPrice != null ? `$${currentPrice.toFixed(2)}` : '—'}</p>
              </div>
              <div>
                <p>Market Value</p>
                <p className="font-medium text-foreground">
                  {marketValue != null ? `$${marketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                </p>
              </div>
              <div>
                <p>DCF Upside</p>
                <p className={`font-medium ${dcfUpsidePct != null ? (dcfUpsidePct > 0 ? 'text-accent' : 'text-destructive') : 'text-foreground'}`}>
                  {dcfUpsidePct != null ? `${dcfUpsidePct > 0 ? '+' : ''}${(dcfUpsidePct * 100).toFixed(1)}%` : '—'}
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded border border-destructive/40 bg-destructive/10 p-2.5 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {!done && (
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            {/* No-portfolio guard */}
            {portfolios.length === 0 && (
              <p className="text-sm text-destructive w-full text-center">
                Create a portfolio first before adding holdings.
              </p>
            )}
            {/* Max positions warning */}
            {atMaxPositions && (
              <div className="flex items-start gap-2 rounded border border-warning/20 bg-warning/10 dark:bg-warning/15/20 p-2.5 text-sm text-warning dark:text-warning w-full">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                Portfolio is at max positions ({selectedPortfolio?.max_positions}). Remove a holding first.
              </div>
            )}
            {/* Low conviction warning */}
            {belowConviction && !atMaxPositions && (
              <div className="flex items-start gap-2 rounded border border-warning/20 bg-warning/10 dark:bg-warning/15/20 p-2.5 text-sm text-warning dark:text-warning w-full">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                Score {compositeScore?.toFixed(1)} is below your conviction threshold of {selectedPortfolio?.min_conviction_score}. You can still add it.
              </div>
            )}
            {/* Existing position notice */}
            {isExisting && !atMaxPositions && (
              <div className="flex items-start gap-2 rounded border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-2.5 text-sm text-blue-800 dark:text-blue-300 w-full">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                You already hold {ticker.toUpperCase()}. This will update the existing position.
              </div>
            )}
            <div className="flex gap-2 justify-end w-full">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !portfolioId || atMaxPositions || portfolios.length === 0}>
                {saving ? 'Saving…' : isExisting ? 'Update Position' : 'Add to Portfolio'}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
