import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { usePortfolio } from '@/contexts/PortfolioContext'
import { upsertHolding, deleteHolding, getHoldingMarketValue } from '@/services/portfolio/portfolioService'
import { BUCKET_LABELS, type Portfolio, type AssetBucket } from '@/types/portfolio'
import { formatUSD } from './portfolioUtils'
import { PlusCircle, Trash2, X } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'

interface Props {
  portfolio: Portfolio
}

interface AddForm {
  ticker: string
  bucket: AssetBucket
  shares: string
  cost_basis: string
  current_price: string
}

const EMPTY_FORM: AddForm = {
  ticker: '',
  bucket: 'US_EQUITY_LARGE',
  shares: '',
  cost_basis: '',
  current_price: '',
}

export default function HoldingsTable({ portfolio }: Props) {
  const { refresh } = usePortfolio()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [fetchingPrice, setFetchingPrice] = useState(false)
  const tickerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function fetchPriceForTicker(ticker: string) {
    if (!ticker) return
    setFetchingPrice(true)
    try {
      const { data, error } = await supabase.functions.invoke('fetch-alpha-vantage', {
        body: { function: 'GLOBAL_QUOTE', params: { symbol: ticker } },
      })
      if (error || !data) return
      const quote = data['Global Quote']
      const priceValue = Number(quote?.['05. price'])
      if (data.Note || data.Information || !Number.isFinite(priceValue) || priceValue <= 0) return

      const price = priceValue.toFixed(2)
      setForm((prev) => ({
        ...prev,
        current_price: price,
        cost_basis: prev.cost_basis || price,
      }))
    } finally {
      setFetchingPrice(false)
    }
  }

  function handleTickerChange(value: string) {
    updateForm('ticker', value.toUpperCase())
    if (tickerDebounce.current) clearTimeout(tickerDebounce.current)
    if (value.length >= 1) {
      tickerDebounce.current = setTimeout(() => fetchPriceForTicker(value.toUpperCase()), 600)
    }
  }

  const holdings = portfolio.holdings ?? []

  const totalValue = holdings.reduce((sum, holding) => sum + getHoldingMarketValue(holding), 0)

  function updateForm<K extends keyof AddForm>(key: K, val: AddForm[K]) {
    setForm((prev) => ({ ...prev, [key]: val }))
  }

  async function handleAdd() {
    if (!form.ticker.trim()) return
    setSaving(true)
    try {
      const shares     = parseFloat(form.shares) || undefined
      const costBasis  = parseFloat(form.cost_basis) || undefined
      const price      = parseFloat(form.current_price) || undefined
      const mktVal     = shares != null && price != null ? shares * price : undefined

      await upsertHolding(portfolio.id, {
        ticker:        form.ticker.trim().toUpperCase(),
        bucket:        form.bucket,
        shares,
        cost_basis:    costBasis,
        current_price: price,
        market_value:  mktVal,
      })
      await refresh()
      setForm(EMPTY_FORM)
      setShowForm(false)
      toast({ title: 'Holding added', description: form.ticker.toUpperCase() })
    } catch (e: unknown) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(ticker: string) {
    setDeleting(ticker)
    try {
      await deleteHolding(portfolio.id, ticker)
      await refresh()
      toast({ title: 'Holding removed', description: ticker })
    } catch (cause) {
      toast({
        title: 'Could not remove holding',
        description: cause instanceof Error ? cause.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold">Holdings</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="w-4 h-4" /> : <><PlusCircle className="w-4 h-4 mr-1" />Add position</>}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <h4 className="text-sm font-medium">New position</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">
                  Ticker{fetchingPrice && <span className="ml-1 text-muted-foreground animate-pulse">fetching price…</span>}
                </label>
                <Input placeholder="AAPL" value={form.ticker} onChange={(e) => handleTickerChange(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bucket</label>
                <select
                  className="w-full border rounded px-2 py-1.5 text-sm bg-background"
                  value={form.bucket}
                  onChange={(e) => updateForm('bucket', e.target.value as AssetBucket)}
                >
                  {Object.entries(BUCKET_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Shares</label>
                <Input type="number" placeholder="100" value={form.shares} onChange={(e) => updateForm('shares', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Cost basis / share</label>
                <Input type="number" placeholder="150.00" value={form.cost_basis} onChange={(e) => updateForm('cost_basis', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Current price / share</label>
                <Input type="number" placeholder="175.00" value={form.current_price} onChange={(e) => updateForm('current_price', e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleAdd} disabled={saving || !form.ticker.trim()}>
                {saving ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </div>
        )}

        {holdings.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2">Ticker</th>
                <th className="text-left py-2 hidden sm:table-cell">Bucket</th>
                <th className="text-right py-2">Shares</th>
                <th className="text-right py-2">Price</th>
                <th className="text-right py-2">Value</th>
                <th className="text-right py-2">Weight</th>
                <th className="text-right py-2">P&L</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const marketValue = getHoldingMarketValue(h)
                const gain = h.current_price != null && h.cost_basis != null && h.shares != null
                  ? (h.current_price - h.cost_basis) * h.shares
                  : null
                const gainPct = h.current_price != null && h.cost_basis != null && h.cost_basis > 0
                  ? (h.current_price - h.cost_basis) / h.cost_basis
                  : null
                const weight = totalValue !== 0 && marketValue !== 0
                  ? (marketValue / totalValue) * 100
                  : null
                return (
                  <tr key={h.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 font-semibold"><div className="flex flex-wrap items-center gap-1.5"><span>{h.ticker}</span>{h.source === 'schwab' && <Badge variant="secondary" className="text-[9px]">Schwab</Badge>}{h.is_stale && <Badge variant="outline" className="text-[9px] text-warning">Stale</Badge>}</div>{h.classification_source === 'inferred' && <span className="block text-[9px] font-normal text-muted-foreground">Bucket inferred — review</span>}</td>
                    <td className="py-2.5 hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">
                        {BUCKET_LABELS[h.bucket as AssetBucket]?.split(' ')[0]}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{h.shares?.toFixed(2) ?? '—'}</td>
                    <td className="py-2.5 text-right tabular-nums">{h.current_price != null ? `$${h.current_price.toFixed(2)}` : '—'}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{marketValue !== 0 ? formatUSD(marketValue) : '—'}</td>
                    <td className="py-2.5 text-right tabular-nums text-muted-foreground">{weight != null ? `${weight.toFixed(1)}%` : '—'}</td>
                    <td className={`py-2.5 text-right tabular-nums text-xs ${gain == null ? '' : gain >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {gain != null ? `${gain >= 0 ? '+' : ''}${formatUSD(gain)}` : '—'}
                      {gainPct != null && <span className="block">{(gainPct * 100).toFixed(1)}%</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      {h.source !== 'schwab' && <button
                        onClick={() => handleDelete(h.ticker)}
                        disabled={deleting === h.ticker}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-center text-muted-foreground py-6">
            No positions yet. Add your first holding above.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
