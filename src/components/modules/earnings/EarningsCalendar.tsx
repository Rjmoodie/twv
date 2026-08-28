import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, ExternalLink, RefreshCw, Search, Sparkles, TrendingUp } from 'lucide-react';
import { marketCalendarAPI } from '@/services/api/market-calendar-api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { addCalendarDays, calendarDayInTimeZone } from '@/lib/calendarDate';

const day = (value: string) => new Date(`${value}T12:00:00`);
const labelDate = (value: string) => day(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export default function EarningsCalendar() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [window, setWindow] = useState<'7' | '30' | '90' | '180' | '365'>('30');
  const query = useQuery({ queryKey: ['market-calendar', 'earnings'], queryFn: () => marketCalendarAPI.earnings(), staleTime: 30 * 60_000, retry: 1 });
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const visible = useMemo(() => {
    const today = calendarDayInTimeZone();
    const end = addCalendarDays(today, Number(window));
    const needle = search.trim().toLowerCase();
    return items.filter(item => item.reportDate >= today && item.reportDate <= end && (!needle || `${item.symbol} ${item.name}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.reportDate.localeCompare(b.reportDate) || a.symbol.localeCompare(b.symbol));
  }, [items, search, window]);
  const grouped = useMemo(() => Object.entries(visible.reduce<Record<string, typeof visible>>((acc, item) => { (acc[item.reportDate] ??= []).push(item); return acc; }, {})), [visible]);
  const today = calendarDayInTimeZone();
  const nextWeek = addCalendarDays(today, 7);
  const forceRefresh = () => queryClient.fetchQuery({ queryKey: ['market-calendar', 'earnings'], queryFn: () => marketCalendarAPI.earnings(true), staleTime: 0 });

  if (query.isLoading) return <div className="flex min-h-[420px] items-center justify-center gap-3 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin" />Loading live earnings calendar…</div>;

  const stats = [
    ['Upcoming', items.filter(i => i.reportDate >= today).length, CalendarDays],
    ['Today', items.filter(i => i.reportDate === today).length, Clock3],
    ['Next 7 days', items.filter(i => i.reportDate >= today && i.reportDate <= nextWeek).length, TrendingUp],
    ['Showing', visible.length, Search],
  ] as const;

  return <div className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
    <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge className="gap-1.5"><Sparkles className="h-3 w-3" />Live market calendar</Badge>{query.data?.cached && <Badge variant="secondary">Cached snapshot</Badge>}{query.data?.stale && <Badge variant="destructive">Refresh delayed</Badge>}</div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Earnings Calendar</h1><p className="max-w-2xl text-sm text-muted-foreground">Upcoming reported earnings dates, organized for fast research instead of a wall-sized calendar.</p></div><div className="flex flex-col items-start gap-2 text-xs text-muted-foreground lg:items-end"><a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={query.data?.sourceUrl} target="_blank" rel="noreferrer">{query.data?.source ?? 'Alpha Vantage'}<ExternalLink className="h-3 w-3" /></a><span>Provider snapshot {query.data?.fetchedAt ? new Date(query.data.fetchedAt).toLocaleString() : 'unavailable'}</span><Button size="sm" variant="outline" className="gap-2" onClick={() => void forceRefresh().catch(() => undefined)} disabled={query.isFetching}><RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? 'animate-spin' : ''}`} />Refresh</Button></div></div>
    </section>
    {(query.error || query.data?.warning) && <Alert variant={query.error ? 'destructive' : 'default'}><AlertDescription>{query.error instanceof Error ? query.error.message : query.data?.warning}</AlertDescription></Alert>}
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([name, value, Icon]) => <Card key={name}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{name}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}</div>
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticker or company" className="pl-9" /></div><div className="flex rounded-xl bg-muted p-1">{(['7', '30', '90', '180', '365'] as const).map(value => <Button key={value} size="sm" variant={window === value ? 'default' : 'ghost'} onClick={() => setWindow(value)}>{value === '365' ? '1 year' : `${value} days`}</Button>)}</div></div>
    <section className="overflow-hidden rounded-2xl border bg-card">{grouped.length === 0 ? <div className="p-12 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-medium">No matching earnings dates</h2><p className="mt-1 text-sm text-muted-foreground">Try a longer window or clear the search.</p></div> : grouped.map(([date, events]) => <div key={date} className="border-b last:border-0"><div className="flex items-center justify-between bg-muted/35 px-4 py-3"><p className="font-medium">{labelDate(date)}</p><Badge variant="secondary">{events.length} {events.length === 1 ? 'company' : 'companies'}</Badge></div><div className="divide-y">{events.map(event => <div key={`${event.symbol}-${event.reportDate}`} className="grid gap-3 px-4 py-3 hover:bg-muted/20 sm:grid-cols-[90px_1fr_140px_100px] sm:items-center"><div className="font-mono font-semibold text-primary">{event.symbol}</div><div className="min-w-0"><p className="truncate font-medium">{event.name}</p><p className="text-xs text-muted-foreground">Fiscal period ending {event.fiscalDateEnding || 'not supplied'}</p></div><div><p className="text-xs text-muted-foreground">EPS estimate</p><p className="font-mono tabular-nums">{event.estimate ? `${event.currency} ${event.estimate}` : 'Not supplied'}</p></div><Badge variant="outline" className="w-fit">{event.time === 'bmo' ? 'Before open' : event.time === 'amc' ? 'After close' : 'Time TBD'}</Badge></div>)}</div></div>)}</section>
    <p className="text-xs text-muted-foreground">Dates and estimates can change. Confirm material events with the issuer before trading.</p>
  </div>;
}
