import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { useTrades } from './context/TradesProvider'

export default function TradeLogTable() {
  const { trades, updateTradeStrategy } = useTrades()
  const [saving, setSaving] = useState<string | null>(null)
  if (!trades.length) return <p className="text-sm text-muted-foreground">Once supported fills are imported this log populates automatically.</p>

  async function saveStrategy(id: string, strategy: string) {
    setSaving(id)
    try { await updateTradeStrategy(id, strategy) } finally { setSaving(null) }
  }

  return <Table>
    <TableHeader><TableRow>
      <TableHead className="w-[150px]">Filled</TableHead><TableHead>Ticker</TableHead><TableHead>Side</TableHead>
      <TableHead className="hidden sm:table-cell text-right">Quantity</TableHead><TableHead className="hidden md:table-cell text-right">Price</TableHead>
      <TableHead className="min-w-[180px]">Journal strategy</TableHead>
    </TableRow></TableHeader>
    <TableBody>{trades.map(trade => <TableRow key={trade.id}>
      <TableCell className="font-medium">{trade.filled_at ? <div><span>{format(parseISO(trade.filled_at), 'MMM d, yyyy')}</span><span className="block text-xs font-normal text-muted-foreground">{format(parseISO(trade.filled_at), 'HH:mm')}</span></div> : 'N/A'}</TableCell>
      <TableCell><div className="flex items-center gap-2"><span className="font-semibold">{trade.ticker}</span><Badge variant="secondary" className="text-[9px]">{trade.provider}</Badge></div></TableCell>
      <TableCell><Badge variant={trade.side === 'buy' ? 'outline' : 'secondary'} className={trade.side === 'buy' ? 'border-emerald-500 text-accent' : ''}>{trade.side.toUpperCase()}</Badge></TableCell>
      <TableCell className="hidden sm:table-cell text-right tabular-nums">{trade.qty.toLocaleString()}</TableCell>
      <TableCell className="hidden md:table-cell text-right tabular-nums">{trade.filled_avg_price == null ? 'N/A' : `$${trade.filled_avg_price.toFixed(2)}`}</TableCell>
      <TableCell><Input defaultValue={trade.strategy ?? ''} aria-label={`Strategy for ${trade.ticker} fill`} placeholder="Add strategy" disabled={saving === trade.id} onBlur={event => { if (event.target.value !== (trade.strategy ?? '')) void saveStrategy(trade.id, event.target.value) }} className="h-8 text-xs" /></TableCell>
    </TableRow>)}</TableBody>
    <TableCaption>Broker fills are immutable. Strategy is your private journal overlay; sharing requires a separate publication review.</TableCaption>
  </Table>
}
