import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Check, Trash2, Plus,
  CalendarDays, CalendarRange, Loader2, Flag,
  ExternalLink, AlertTriangle, Search, X, List, Download, SlidersHorizontal, Star,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button }   from '@/components/ui/button';
import { Badge }    from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Input }    from '@/components/ui/input';
import { Label }    from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn }       from '@/lib/utils';
import { useAuth }  from '@/components/somatech/AuthProvider';
import { useCalendarEvents, useCalendarMutations } from '@/hooks/useFinancialCalendar';
import { NavigationWrapper } from '@/components/somatech/navigation/NavigationWrapper';
import type { FinancialEvent, EventCategory, EventType } from '@/services/financialCalendarService';
import { marketCalendarAPI } from '@/services/api/market-calendar-api';
import { toast } from '@/hooks/use-toast';
import { addCalendarDays, calendarDayInTimeZone, formatCalendarDay, startOfWeek } from '@/lib/calendarDate';
import { downloadCalendar } from '@/services/calendarUtility';
import { scheduleCalendarReminder, type ReminderChannels } from '@/services/calendarReminderService';
import {
  filterCalendarEvents,
  type CalendarSourceFilter,
  type CalendarStatusFilter,
} from './financialCalendarFilters';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function isoToday(): string {
  return calendarDayInTimeZone();
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ── Event styling ─────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<EventType, string> = {
  journey_milestone: 'Milestone',
  check_in:          'Check-in',
  coach_reminder:    'Reminder',
  savings_target:    'Target',
  earnings:          'Earnings',
  pdufa:             'PDUFA',
  macro:             'US Macro',
  bill:              'Bill',
  custom:            'Custom',
};

const TYPE_META: Record<EventType, { dot: string; badge: string }> = {
  earnings:          { dot: 'bg-blue-500',    badge: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  pdufa:             { dot: 'bg-violet-500',  badge: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300' },
  macro:             { dot: 'bg-rose-500',    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300' },
  journey_milestone: { dot: 'bg-emerald-500', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  savings_target:    { dot: 'bg-teal-500',    badge: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300' },
  check_in:          { dot: 'bg-cyan-500',    badge: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300' },
  coach_reminder:    { dot: 'bg-amber-500',   badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  bill:              { dot: 'bg-orange-500',  badge: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  custom:            { dot: 'bg-slate-500',   badge: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300' },
};

// ── Event Detail Drawer ───────────────────────────────────────────────────────

interface EventDrawerProps {
  event:    FinancialEvent | null;
  open:     boolean;
  onClose:  () => void;
  onToggle: (e: FinancialEvent) => void;
  onDelete: (e: FinancialEvent) => void;
  onRemind: (e: FinancialEvent, daysBefore: number, channels: ReminderChannels[]) => Promise<void>;
}

function EventDrawer({ event, open, onClose, onToggle, onDelete, onRemind }: EventDrawerProps) {
  const [reminderLead, setReminderLead] = useState('1');
  const [reminderChannel, setReminderChannel] = useState('in_app');
  const [reminderSaving, setReminderSaving] = useState(false);
  useEffect(() => {
    if (event && addCalendarDays(event.event_date, -Number(reminderLead)) < isoToday()) setReminderLead('0');
  }, [event, reminderLead]);
  if (!event) return null;
  const meta  = TYPE_META[event.event_type];
  const label = TYPE_LABEL[event.event_type];
  const isReadOnly = event.metadata.readOnly === true;
  const sourceUrl = typeof event.metadata.sourceUrl === 'string' ? event.metadata.sourceUrl : null;
  const source = typeof event.metadata.source === 'string' ? event.metadata.source : null;
  const time = typeof event.metadata.time === 'string' ? event.metadata.time : null;
  const timezone = typeof event.metadata.timezone === 'string' ? event.metadata.timezone : null;
  const confidence = typeof event.metadata.confidence === 'number' ? event.metadata.confidence : null;
  const approximate = event.metadata.datePrecision === 'approximate';
  const relevant = event.metadata.relevant === true;
  const effectivelyCompleted = event.is_completed || (isReadOnly && (event.event_date < isoToday() || /decision announced|decided|approved|rejected|withdrawn|complete response/i.test(String(event.metadata.status ?? ''))));

  const handleToggle = () => { onToggle(event); onClose(); };
  const handleDelete = () => { onDelete(event); onClose(); };

  const dateStr = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent className="max-w-lg mx-auto">
        <DrawerHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className={cn('text-xs', meta.badge)}>
              {label}
            </Badge>
            {effectivelyCompleted && (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                Completed
              </Badge>
            )}
          </div>
          <DrawerTitle className={cn('text-left text-base', effectivelyCompleted && 'opacity-60', event.is_completed && 'line-through')}>
            {event.title}
          </DrawerTitle>
          <DrawerDescription className="text-left text-xs text-muted-foreground">
            {dateStr}{time ? ` · ${time}${timezone ? ` ${timezone === 'America/New_York' ? 'ET' : timezone}` : ''}` : ''}
          </DrawerDescription>
        </DrawerHeader>

        {event.description && (
          <div className="px-4 pb-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
          </div>
        )}
        {(source || confidence != null || approximate || relevant) && <div className="mx-4 mb-3 flex flex-wrap gap-2 text-xs"><Badge variant="secondary">{source ?? 'Market source'}</Badge>{confidence != null && <Badge variant="outline">{confidence}% confidence</Badge>}{approximate && <Badge variant="outline">Approximate date</Badge>}{relevant && <Badge className="gap-1"><Star className="h-3 w-3" />In your holdings or watchlist</Badge>}</div>}

        <DrawerFooter className="pt-2 flex-row gap-2">
          {event.event_date >= isoToday() && <div className="flex flex-1 flex-wrap gap-2"><Select value={reminderLead} onValueChange={setReminderLead}><SelectTrigger className="min-w-[125px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Same day</SelectItem><SelectItem value="1" disabled={addCalendarDays(event.event_date, -1) < isoToday()}>1 day before</SelectItem><SelectItem value="7" disabled={addCalendarDays(event.event_date, -7) < isoToday()}>1 week before</SelectItem><SelectItem value="30" disabled={addCalendarDays(event.event_date, -30) < isoToday()}>30 days before</SelectItem></SelectContent></Select><Select value={reminderChannel} onValueChange={setReminderChannel}><SelectTrigger className="min-w-[115px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in_app">In-app</SelectItem><SelectItem value="email">In-app + email</SelectItem><SelectItem value="all">All channels</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={reminderSaving} onClick={async () => { setReminderSaving(true); const channels: ReminderChannels[] = reminderChannel === 'all' ? ['in_app', 'email', 'push'] : reminderChannel === 'email' ? ['in_app', 'email'] : ['in_app']; try { await onRemind(event, Number(reminderLead), channels); } finally { setReminderSaving(false); } }}>{reminderSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remind me'}</Button></div>}
          {isReadOnly ? (
            sourceUrl && <Button asChild size="sm" className="flex-1"><a href={sourceUrl} target="_blank" rel="noreferrer">View source<ExternalLink className="ml-1 h-4 w-4" /></a></Button>
          ) : (
            <>
              <Button
                size="sm"
                variant={event.is_completed ? 'outline' : 'default'}
                className="flex-1"
                onClick={handleToggle}
              >
                <Check className="h-4 w-4 mr-1" />
                {event.is_completed ? 'Mark incomplete' : 'Mark complete'}
              </Button>
              {event.event_type === 'custom' && (
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ── Add Event Drawer ──────────────────────────────────────────────────────────

interface AddEventDrawerProps {
  open:          boolean;
  defaultDate:   string;
  onClose:       () => void;
  onSave:        (params: { title: string; description: string; event_date: string; category: EventCategory }) => Promise<void>;
  isSaving:      boolean;
}

function AddEventDrawer({ open, defaultDate, onClose, onSave, isSaving }: AddEventDrawerProps) {
  const [title, setTitle]       = useState('');
  const [desc, setDesc]         = useState('');
  const [date, setDate]         = useState(defaultDate);
  const [category, setCategory] = useState<EventCategory>('general');

  // Sync date when the caller changes the target day
  useEffect(() => { setDate(defaultDate); }, [defaultDate]);

  const handleSave = async () => {
    if (!title.trim()) return;
    try {
      await onSave({ title: title.trim(), description: desc.trim(), event_date: date, category });
      setTitle(''); setDesc(''); setDate(defaultDate); setCategory('general');
      onClose();
    } catch { /* Parent mutation reports the actionable error and keeps the form open. */ }
  };

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent className="max-w-lg mx-auto">
        <DrawerHeader>
          <DrawerTitle className="text-left">Add event</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 space-y-3 pb-2">
          <div className="space-y-1">
            <Label className="text-xs">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={v => setCategory(v as EventCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="debt">Debt</SelectItem>
                <SelectItem value="investment">Investment</SelectItem>
                <SelectItem value="home">Home</SelectItem>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="bill">Bill</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Details…" />
          </div>
        </div>
        <DrawerFooter className="flex-row gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button size="sm" className="flex-1" onClick={() => void handleSave()} disabled={!title.trim() || !date || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add event'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ── Upcoming events strip ─────────────────────────────────────────────────────

interface UpcomingStripProps {
  events:   FinancialEvent[];
  onSelect: (e: FinancialEvent) => void;
}

function UpcomingStrip({ events, onSelect }: UpcomingStripProps) {
  const today   = isoToday();
  const upcoming = events
    .filter(e => !e.is_completed && e.event_date >= today)
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">Coming up</p>
      <div className="space-y-1.5">
        {upcoming.map(e => {
          const meta = TYPE_META[e.event_type];
          const d    = new Date(e.event_date + 'T00:00:00');
          const dayStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-card/60 border border-border/40 hover:border-border/80 text-left transition-colors"
            >
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', meta.dot)} />
              <span className="flex-1 text-sm truncate">{e.title}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">{dayStr}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Day cell ──────────────────────────────────────────────────────────────────

interface DayCellProps {
  day:        number;
  label:      string;
  isToday:    boolean;
  isSelected: boolean;
  events:     FinancialEvent[];
  onSelect:   () => void;
}

function DayCell({ day, label, isToday, isSelected, events, onSelect }: DayCellProps) {
  const hasMilestone  = events.some(e => e.event_type === 'journey_milestone' || e.event_type === 'savings_target');
  const dots          = events.slice(0, 3);

  return (
    <button
      onClick={onSelect}
      aria-label={`${label}, ${events.length} ${events.length === 1 ? 'event' : 'events'}`}
      className={cn(
        'relative flex min-h-[76px] flex-col items-center justify-start rounded-xl px-1 py-2 text-sm transition-all select-none md:min-h-[104px] md:items-stretch',
        isSelected
          ? 'bg-primary text-primary-foreground shadow-sm'
          : isToday
          ? 'bg-primary/10 text-primary font-semibold'
          : 'hover:bg-muted/60 text-foreground',
        events.length === 0 && 'opacity-70',
      )}
    >
      <span className={cn('font-medium tabular-nums leading-none md:self-end md:pr-1', isToday && !isSelected && 'underline underline-offset-2')}>
        {day}
      </span>
      {hasMilestone && !isSelected && (
        <Flag className="h-2.5 w-2.5 mt-0.5 text-accent" />
      )}
      {dots.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1 md:hidden">
          {dots.map((e, i) => (
            <div
              key={i}
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                e.is_completed ? 'opacity-40' : '',
                TYPE_META[e.event_type].dot,
              )}
            />
          ))}
        </div>
      )}
      <div className="mt-2 hidden space-y-1 md:block">
        {events.slice(0, 2).map((event) => (
          <div key={event.id} className={cn('flex items-center gap-1 rounded border px-1.5 py-1 text-left text-[10px] font-medium', TYPE_META[event.event_type].badge, event.is_completed && 'opacity-45 line-through')}>
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TYPE_META[event.event_type].dot)} />
            <span className="truncate">{event.title}</span>
          </div>
        ))}
        {events.length > 2 && <p className="px-1 text-left text-[10px] text-muted-foreground">+{events.length - 2} more</p>}
      </div>
    </button>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

interface WeekViewProps {
  events:   FinancialEvent[];
  onSelect: (e: FinancialEvent) => void;
  onDayClick: (dateStr: string) => void;
  weekAnchor: string;
  selectedDate: string;
}

function WeekView({ events, onSelect, onDayClick, weekAnchor, selectedDate }: WeekViewProps) {
  const today  = isoToday();
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(weekAnchor, i));

  // Use a stable string key so array-reference churn doesn't bust the memo
  const eventsKey = events.map(e => `${e.id}:${e.is_completed}`).join(',');
  const eventsByDate = useMemo(() => {
    const map: Record<string, FinancialEvent[]> = {};
    for (const e of events) {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    }
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventsKey]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground font-medium py-1">{d}</div>
        ))}
        {days.map(ds => {
          const evs   = eventsByDate[ds] ?? [];
          const isT   = ds === today;
          const selected = ds === selectedDate;
          return (
            <button
              key={ds}
              onClick={() => onDayClick(ds)}
              className={cn(
                'flex flex-col items-center pt-1 pb-1 rounded-xl min-h-[56px] text-sm transition-all',
                selected ? 'bg-primary text-primary-foreground' : isT ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/60',
              )}
            >
              <span className={cn('tabular-nums leading-none', isT && 'underline underline-offset-2')}>
                {Number(ds.slice(8, 10))}
              </span>
              <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                {evs.slice(0, 3).map((e, i) => (
                  <div key={i} className={cn('w-1.5 h-1.5 rounded-full', TYPE_META[e.event_type].dot, e.is_completed && 'opacity-40')} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Events for each day of the week */}
      <div className="space-y-2">
        {days.map(ds => {
          const evs = eventsByDate[ds] ?? [];
          if (evs.length === 0) return null;
          const label = formatCalendarDay(ds, { weekday: 'short', month: 'short', day: 'numeric' });
          return (
            <div key={ds}>
              <p className="text-xs text-muted-foreground font-medium mb-1 px-1">{label}</p>
              <div className="space-y-1">
                {evs.map(e => {
                  const meta = TYPE_META[e.event_type];
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-card/60 border border-border/40 hover:border-border/80 text-left transition-colors"
                    >
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', meta.dot, e.is_completed && 'opacity-40')} />
                      <span className={cn('flex-1 text-sm truncate', e.is_completed && 'line-through opacity-50')}>
                        {e.title}
                      </span>
                      <Badge variant="outline" className={cn('text-xs hidden sm:flex', meta.badge)}>
                        {TYPE_LABEL[e.event_type]}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ events, onSelect }: { events: FinancialEvent[]; onSelect: (event: FinancialEvent) => void }) {
  const grouped = events.reduce<Record<string, FinancialEvent[]>>((result, event) => {
    (result[event.event_date] ??= []).push(event);
    return result;
  }, {});
  const allDays = Object.keys(grouped).sort();
  const days = allDays.slice(0, 90);
  if (!days.length) return null;
  return <Card className="border-border/60 bg-card/60"><CardContent className="divide-y p-0">{days.map((day) => <section key={day} className="grid gap-2 p-4 md:grid-cols-[150px_1fr]"><div><p className="font-medium">{formatCalendarDay(day, { weekday: 'short', month: 'short', day: 'numeric' })}</p><p className="text-xs text-muted-foreground">{grouped[day].length} {grouped[day].length === 1 ? 'event' : 'events'}</p></div><div className="space-y-2">{grouped[day].map((event) => <button key={event.id} onClick={() => onSelect(event)} className="flex w-full items-center gap-3 rounded-xl border border-border/50 p-3 text-left hover:bg-muted/40"><span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TYPE_META[event.event_type].dot)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{event.title}</span><span className="block truncate text-xs text-muted-foreground">{event.description}</span></span>{event.metadata.relevant === true && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" />}<Badge variant="outline" className={cn('hidden sm:flex', TYPE_META[event.event_type].badge)}>{TYPE_LABEL[event.event_type]}</Badge></button>)}</div></section>)}{allDays.length > days.length && <p className="p-4 text-center text-xs text-muted-foreground">Showing the first 90 event dates. Narrow the source, status, or search filters to see later dates.</p>}</CardContent></Card>;
}

// ── Selected day events list ───────────────────────────────────────────────────

interface DayEventsProps {
  dateStr:  string;
  events:   FinancialEvent[];
  onSelect: (e: FinancialEvent) => void;
}

function DayEvents({ dateStr, events, onSelect }: DayEventsProps) {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (events.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">No events</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground px-1">{label}</p>
      {events.map(e => {
        const meta = TYPE_META[e.event_type];
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-card/60 border border-border/40 hover:border-border/80 text-left transition-colors"
          >
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', meta.dot, e.is_completed && 'opacity-40')} />
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-medium truncate', e.is_completed && 'line-through opacity-50')}>
                {e.title}
              </p>
              {e.description && (
                <p className="text-xs text-muted-foreground truncate">{e.description}</p>
              )}
            </div>
            <Badge variant="outline" className={cn('text-xs hidden sm:flex flex-shrink-0', meta.badge)}>
              {TYPE_LABEL[e.event_type]}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type CalView = 'month' | 'week' | 'agenda';

export default function FinancialCalendar() {
  const { user } = useAuth();
  const { data: personalEvents = [], isLoading: personalEventsLoading } = useCalendarEvents(user?.id);
  const earningsQuery = useQuery({
    queryKey: ['financial-calendar', 'market', 'earnings'],
    queryFn: () => marketCalendarAPI.earnings(),
    enabled: !!user?.id,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const regulatoryQuery = useQuery({
    queryKey: ['financial-calendar', 'market', 'pdufa'],
    queryFn: () => marketCalendarAPI.regulatory(),
    enabled: !!user?.id,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const macroQuery = useQuery({
    queryKey: ['financial-calendar', 'market', 'macro'],
    queryFn: () => marketCalendarAPI.macro(),
    enabled: !!user?.id,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const { updateMut, deleteMut, createMut } = useCalendarMutations(user?.id);

  const today   = isoToday();
  const todayD  = new Date(today + 'T00:00:00');

  const saved = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('tw-calendar-preferences') ?? '{}') as Record<string, string | boolean>; }
    catch { return {}; }
  }, []);
  const [view,         setView]         = useState<CalView>(saved.view === 'week' || saved.view === 'agenda' ? saved.view : 'month');
  const [year,         setYear]         = useState(todayD.getFullYear());
  const [month,        setMonth]        = useState(todayD.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [detailEvent,  setDetailEvent]  = useState<FinancialEvent | null>(null);
  const [addOpen,      setAddOpen]      = useState(false);
  const [addDate,      setAddDate]      = useState(today);
  const [sourceFilter, setSourceFilter] = useState<CalendarSourceFilter>(['earnings','pdufa','macro','personal','relevant'].includes(String(saved.source)) ? saved.source as CalendarSourceFilter : 'all');
  // Forward-looking by default; past events stay one click away via the
  // status filter ('completed' or 'all').
  const [statusFilter, setStatusFilter] = useState<CalendarStatusFilter>(saved.status === 'all' || saved.status === 'completed' ? saved.status : 'upcoming');
  const [search,       setSearch]       = useState('');
  const [filtersOpen, setFiltersOpen] = useState(saved.filtersOpen !== false);
  const [highImpactOnly, setHighImpactOnly] = useState(saved.highImpact === true);
  const [exactDatesOnly, setExactDatesOnly] = useState(saved.exactDates === true);
  const [weekAnchor, setWeekAnchor] = useState(startOfWeek(today));

  useEffect(() => {
    try { localStorage.setItem('tw-calendar-preferences', JSON.stringify({ view, source: sourceFilter, status: statusFilter, filtersOpen, highImpact: highImpactOnly, exactDates: exactDatesOnly })); }
    catch { /* Storage may be unavailable in hardened/private browser contexts. */ }
  }, [view, sourceFilter, statusFilter, filtersOpen, highImpactOnly, exactDatesOnly]);

  // Held-position relevance came from the watchlist and portfolio modules, both
  // removed with the non-real-estate cut. The "relevant" filter stays wired but
  // matches nothing until this is repointed at the deal pipeline in Phase 2.
  const relevantTickers = useMemo(() => new Set<string>(), []);

  const marketEvents = useMemo<FinancialEvent[]>(() => {
    const timestamp = new Date().toISOString();
    const earnings = (earningsQuery.data?.items ?? []).map((item) => ({
      id: `market-earnings-${item.symbol}-${item.reportDate}`,
      user_id: user?.id ?? '',
      title: `${item.symbol} earnings`,
      description: `${item.name}${item.time === 'bmo' ? ' · Before market open' : item.time === 'amc' ? ' · After market close' : ' · Time TBD'}`,
      event_date: item.reportDate,
      event_type: 'earnings' as const,
      journey_id: null,
      category: 'market' as const,
      is_completed: false,
      completed_at: null,
      color: null,
      metadata: { readOnly: true, sourceUrl: item.sourceUrl, source: earningsQuery.data?.source ?? 'Alpha Vantage', symbol: item.symbol, ticker: item.symbol, fiscalDateEnding: item.fiscalDateEnding, time: item.time === 'bmo' ? 'Before market open' : item.time === 'amc' ? 'After market close' : 'Time TBD', timezone: 'America/New_York', relevant: relevantTickers.has(item.symbol.toUpperCase()) },
      created_at: timestamp,
      updated_at: timestamp,
    }));
    const regulatory = (regulatoryQuery.data?.items ?? []).map((item) => ({
      id: `market-pdufa-${item.id}`,
      user_id: user?.id ?? '',
      title: `${item.ticker ? `${item.ticker} ` : ''}${item.drug} · ${item.company}`,
      description: [item.eventType, item.status, item.applicationNumber].filter(Boolean).join(' · '),
      event_date: item.eventDate,
      event_type: 'pdufa' as const,
      journey_id: null,
      category: 'market' as const,
      is_completed: false,
      completed_at: null,
      color: null,
      metadata: { readOnly: true, sourceUrl: item.sourceUrl, source: item.sourceType === 'official_action' ? 'FDA Drugs@FDA' : 'pdufa.bio', applicationNumber: item.applicationNumber, ticker: item.ticker, company: item.company, drug: item.drug, eventType: item.eventType, confidence: item.confidence, datePrecision: item.datePrecision, sourceType: item.sourceType, status: item.status, relevant: !!item.ticker && relevantTickers.has(item.ticker.toUpperCase()) },
      created_at: timestamp,
      updated_at: timestamp,
    }));
    const macro = (macroQuery.data?.items ?? []).map((item) => ({
      id: `market-macro-${item.id}`,
      user_id: user?.id ?? '',
      title: item.title,
      description: `${item.agency} · ${item.time} ET · ${item.impact === 'high' ? 'High impact' : 'Medium impact'}${item.period ? ` · ${item.period}` : ''}`,
      event_date: item.eventDate,
      event_type: 'macro' as const,
      journey_id: null,
      category: 'market' as const,
      is_completed: false,
      completed_at: null,
      color: null,
      metadata: { readOnly: true, sourceUrl: item.sourceUrl, source: item.agency, agency: item.agency, impact: item.impact, period: item.period, time: item.time, timezone: item.timezone },
      created_at: timestamp,
      updated_at: timestamp,
    }));
    return [...earnings, ...regulatory, ...macro];
  }, [earningsQuery.data?.items, earningsQuery.data?.source, regulatoryQuery.data?.items, macroQuery.data?.items, user?.id, relevantTickers]);

  const events = useMemo(
    () => [...personalEvents, ...marketEvents].sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [personalEvents, marketEvents],
  );
  const filteredEvents = useMemo(() => filterCalendarEvents(events, { source: sourceFilter, status: statusFilter, search, today })
    .filter((event) => !highImpactOnly || event.metadata.impact === 'high')
    .filter((event) => !exactDatesOnly || event.event_type !== 'pdufa' || event.metadata.datePrecision !== 'approximate'),
  [events, search, sourceFilter, statusFilter, today, highImpactOnly, exactDatesOnly]);
  // Market feeds render independently as they arrive; one slow provider must
  // not hold the user's personal calendar hostage behind a full-page spinner.
  const isLoading = personalEventsLoading;
  const providerStates = [
    { label: 'Earnings', query: earningsQuery },
    { label: 'FDA / PDUFA', query: regulatoryQuery },
    { label: 'US Macro', query: macroQuery },
  ];
  const providerProblems = providerStates.filter(({ query }) => query.error || query.data?.warning);

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<string, FinancialEvent[]> = {};
    for (const e of filteredEvents) {
      if (!map[e.event_date]) map[e.event_date] = [];
      map[e.event_date].push(e);
    }
    return map;
  }, [filteredEvents]);

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  // Calendar grid
  const firstDay = firstWeekdayOfMonth(year, month);
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const prevMonth = () => {
    const targetYear = month === 0 ? year - 1 : year;
    const targetMonth = month === 0 ? 11 : month - 1;
    setYear(targetYear); setMonth(targetMonth); setSelectedDate(isoDate(targetYear, targetMonth, 1));
  };
  const nextMonth = () => {
    const targetYear = month === 11 ? year + 1 : year;
    const targetMonth = month === 11 ? 0 : month + 1;
    setYear(targetYear); setMonth(targetMonth); setSelectedDate(isoDate(targetYear, targetMonth, 1));
  };
  const goToToday = () => {
    setYear(todayD.getFullYear());
    setMonth(todayD.getMonth());
    setSelectedDate(today);
    setWeekAnchor(startOfWeek(today));
  };

  const handleToggle = useCallback((e: FinancialEvent) => {
    updateMut.mutate({ id: e.id, patch: { is_completed: !e.is_completed } }, {
      onSuccess: () => toast({ title: e.is_completed ? 'Marked incomplete' : 'Completed!', description: e.title }),
      onError: (cause) => toast({ title: 'Event was not updated', description: cause instanceof Error ? cause.message : 'Please try again.', variant: 'destructive' }),
    });
  }, [updateMut]);

  const handleDelete = useCallback((e: FinancialEvent) => {
    deleteMut.mutate(e.id, {
      onSuccess: () => toast({ title: 'Event deleted', description: e.title }),
      onError: (cause) => toast({ title: 'Event was not deleted', description: cause instanceof Error ? cause.message : 'Please try again.', variant: 'destructive' }),
    });
  }, [deleteMut]);

  const handleAddSave = useCallback(async ({ title, description, event_date, category }: {
    title: string; description: string; event_date: string; category: EventCategory;
  }) => {
    try {
      await createMut.mutateAsync({ title, description, event_date, event_type: 'custom', journey_id: null, category });
      toast({ title: 'Event added', description: title });
    } catch (cause) {
      toast({ title: 'Event was not added', description: cause instanceof Error ? cause.message : 'Please try again.', variant: 'destructive' });
      throw cause;
    }
  }, [createMut]);

  const handleRemind = useCallback(async (event: FinancialEvent, daysBefore: number, channels: ReminderChannels[]) => {
    if (!user?.id) throw new Error('Sign in to create reminders.');
    try {
      await scheduleCalendarReminder(user.id, event, daysBefore, channels);
      toast({ title: 'Reminder scheduled', description: daysBefore === 0 ? `On ${event.event_date} at 9:00 AM ET` : `${daysBefore} ${daysBefore === 1 ? 'day' : 'days'} before at 9:00 AM ET` });
    } catch (cause) {
      toast({ title: 'Reminder not saved', description: cause instanceof Error ? cause.message : 'Please try again.', variant: 'destructive' });
      throw cause;
    }
  }, [user?.id]);

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const openAdd = (dateStr: string) => {
    setAddDate(dateStr);
    setAddOpen(true);
  };

  const upcomingCount  = filterCalendarEvents(events, { source: 'all', status: 'upcoming', search: '', today }).length;
  const relevantUpcomingCount = filterCalendarEvents(events, { source: 'relevant', status: 'upcoming', search: '', today }).length;

  return (
    <NavigationWrapper showBackButton={false} showBreadcrumbs={false}>
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total events', value: events.length },
            { label: 'Upcoming',     value: upcomingCount },
            { label: 'Market events', value: marketEvents.length },
            { label: 'Relevant to you', value: relevantUpcomingCount },
          ].map(s => (
            <Card key={s.label} className="border-border/60 bg-card/60">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-label="Calendar source health">
          <span className="font-medium text-foreground">Sources</span>
          {providerStates.map(({ label, query }) => {
            const failed = !!query.error;
            const delayed = query.data?.stale || !!query.data?.warning;
            return <Badge key={label} variant="outline" className={cn('gap-1.5', failed ? 'border-destructive/40 text-destructive' : delayed ? 'border-amber-500/40 text-amber-700 dark:text-amber-300' : 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300')}><span className={cn('h-1.5 w-1.5 rounded-full', failed ? 'bg-destructive' : delayed ? 'bg-amber-500' : query.isLoading ? 'animate-pulse bg-muted-foreground' : 'bg-emerald-500')} />{label}{query.data?.fetchedAt && <span className="font-normal opacity-70">· {new Date(query.data.fetchedAt).toLocaleDateString()}</span>}</Badge>;
          })}
          <span className="ml-auto">Market dates use ET; personal dates remain all-day.</span>
        </div>

        {providerProblems.length > 0 && <div className="space-y-2">{providerProblems.map(({ label, query }) => <div key={label} className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>{label}:</strong> {query.error instanceof Error ? query.error.message : query.data?.warning}</span></div>)}</div>}

        <Card className="border-border/60 bg-card/60">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between"><div><p className="text-sm font-medium">Find the events that matter</p><p className="text-xs text-muted-foreground">Filters are saved on this device.</p></div><Button size="sm" variant="ghost" className="gap-2" onClick={() => setFiltersOpen((open) => !open)}><SlidersHorizontal className="h-4 w-4" />{filtersOpen ? 'Hide filters' : 'Show filters'}</Button></div>
            {filtersOpen && <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search macro releases, companies, drugs, or reminders" className="pl-9 pr-9" />
                {search && <button type="button" aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>}
              </div>
              <Select value={sourceFilter} onValueChange={(value) => setSourceFilter(value as CalendarSourceFilter)}><SelectTrigger aria-label="Event source" className="w-full lg:w-[220px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources ({events.length})</SelectItem><SelectItem value="relevant">My holdings & watchlist ({events.filter((event) => event.metadata.relevant === true).length})</SelectItem><SelectItem value="earnings">Earnings ({events.filter((event) => event.event_type === 'earnings').length})</SelectItem><SelectItem value="pdufa">FDA / PDUFA ({events.filter((event) => event.event_type === 'pdufa').length})</SelectItem><SelectItem value="macro">US Macro ({events.filter((event) => event.event_type === 'macro').length})</SelectItem><SelectItem value="personal">Personal ({personalEvents.length})</SelectItem></SelectContent></Select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {(Object.keys(TYPE_META) as EventType[]).map((type) => <span key={type} className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', TYPE_META[type].dot)} />{TYPE_LABEL[type]}</span>)}
              </div>
              <div className="flex flex-wrap gap-2"><Button size="sm" variant={highImpactOnly ? 'default' : 'outline'} onClick={() => setHighImpactOnly((value) => !value)}>High-impact macro</Button><Button size="sm" variant={exactDatesOnly ? 'default' : 'outline'} onClick={() => setExactDatesOnly((value) => !value)}>Exact dates only</Button><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as CalendarStatusFilter)}><SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any status</SelectItem><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent></Select></div>
            </div>
            <p className="text-xs text-muted-foreground">Showing {filteredEvents.length.toLocaleString()} of {events.length.toLocaleString()} events</p>
            </>}
          </CardContent>
        </Card>

        {/* View toggle + nav */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
            <Button
              size="sm"
              variant={view === 'month' ? 'default' : 'ghost'}
              className="h-7 px-3 rounded-lg text-xs"
              onClick={() => setView('month')}
            >
              <CalendarDays className="h-3.5 w-3.5 mr-1" /> Month
            </Button>
            <Button
              size="sm"
              variant={view === 'week' ? 'default' : 'ghost'}
              className="h-7 px-3 rounded-lg text-xs"
              onClick={() => setView('week')}
            >
              <CalendarRange className="h-3.5 w-3.5 mr-1" /> Week
            </Button>
            <Button size="sm" variant={view === 'agenda' ? 'default' : 'ghost'} className="h-7 rounded-lg px-3 text-xs" onClick={() => setView('agenda')}><List className="mr-1 h-3.5 w-3.5" /> Agenda</Button>
          </div>

          <div className="flex items-center gap-1">
            {view === 'month' && (
              <>
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={goToToday}>
                  Today
                </Button>
                <Button aria-label="Previous month" size="icon" variant="ghost" className="h-8 w-8" onClick={prevMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {MONTH_NAMES[month]} {year}
                </span>
                <Button aria-label="Next month" size="icon" variant="ghost" className="h-8 w-8" onClick={nextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {view === 'week' && <><Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={goToToday}>Today</Button><Button aria-label="Previous week" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { const target = addCalendarDays(weekAnchor, -7); setWeekAnchor(target); setSelectedDate(target); }}><ChevronLeft className="h-4 w-4" /></Button><span className="min-w-[145px] text-center text-sm font-medium">{formatCalendarDay(weekAnchor, { month: 'short', day: 'numeric' })} – {formatCalendarDay(addCalendarDays(weekAnchor, 6), { month: 'short', day: 'numeric' })}</span><Button aria-label="Next week" size="icon" variant="ghost" className="h-8 w-8" onClick={() => { const target = addCalendarDays(weekAnchor, 7); setWeekAnchor(target); setSelectedDate(target); }}><ChevronRight className="h-4 w-4" /></Button></>}
            <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2" disabled={!filteredEvents.length} onClick={() => { downloadCalendar(filteredEvents); toast({ title: 'Calendar exported', description: `${filteredEvents.length} visible events saved as an .ics file.` }); }}><Download className="h-4 w-4" /><span className="hidden sm:inline">Export</span></Button>
            <Button aria-label="Add calendar event" size="icon" variant="outline" className="h-8 w-8 ml-1" onClick={() => openAdd(selectedDate)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (
          <>
            {/* Month calendar grid */}
            {view === 'month' && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                <Card className="border-border/60 bg-card/60">
                  <CardContent className="p-3 sm:p-4">
                    <div className="mb-1 grid grid-cols-7 gap-1">
                      {DAY_NAMES.map(d => (
                        <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {cells.map((day, i) => {
                        if (day === null) return <div key={`e-${i}`} />;
                        const ds       = isoDate(year, month, day);
                        const dayEvs   = eventsByDate[ds] ?? [];
                        const isToday  = ds === today;
                        const isSel    = ds === selectedDate;
                        const label = new Date(`${ds}T00:00:00`).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                        });
                        return (
                          <DayCell
                            key={ds}
                            day={day}
                            label={label}
                            isToday={isToday}
                            isSelected={isSel}
                            events={dayEvs}
                            onSelect={() => handleDayClick(ds)}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60 bg-card/60 xl:sticky xl:top-4">
                  <CardContent className="p-4">
                    <DayEvents
                      dateStr={selectedDate}
                      events={selectedEvents}
                      onSelect={setDetailEvent}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => openAdd(selectedDate)}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add event on this day
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Week view */}
            {view === 'week' && (
              <Card className="border-border/60 bg-card/60">
                <CardContent className="p-3 sm:p-4">
                  <WeekView
                    events={filteredEvents}
                    onSelect={setDetailEvent}
                    onDayClick={handleDayClick}
                    weekAnchor={weekAnchor}
                    selectedDate={selectedDate}
                  />
                </CardContent>
              </Card>
            )}
            {view === 'agenda' && <AgendaView events={filteredEvents} onSelect={setDetailEvent} />}

            {/* Upcoming strip */}
            {filteredEvents.length > 0 && (
              <UpcomingStrip events={filteredEvents} onSelect={setDetailEvent} />
            )}

            {/* Empty state */}
            {filteredEvents.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="text-sm font-medium">No matching events</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Adjust the filters or search, or add a personal event manually.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openAdd(today)}>
                  <Plus className="h-4 w-4 mr-1" /> Add first event
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawers */}
      <EventDrawer
        event={detailEvent}
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onRemind={handleRemind}
      />
      <AddEventDrawer
        open={addOpen}
        defaultDate={addDate}
        onClose={() => setAddOpen(false)}
        onSave={handleAddSave}
        isSaving={createMut.isPending}
      />
    </NavigationWrapper>
  );
}
