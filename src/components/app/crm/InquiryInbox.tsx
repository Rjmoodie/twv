import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, CalendarClock, Inbox, Loader2, Mail, Phone, Sparkles, TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/app/AuthProvider';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

/**
 * Inbound enquiries, from the two public forms.
 *
 * Both tables captured more than anyone could see: the notification email
 * carried name, email, accreditation and range, while phone, timeframe, how
 * they heard of TW and up to 4,000 characters of what they actually wrote were
 * only ever readable in the database. The `status`, `reviewed_at` and
 * `internal_notes` columns existed with nothing to drive them, and the
 * notification's "Open CRM" button pointed at a screen that never read either
 * table. This is that screen.
 */

type Kind = 'investor' | 'project';

interface Inquiry {
  id: string;
  kind: Kind;
  full_name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: string;
  internal_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  /** Everything the form asked that is specific to one of the two funnels. */
  detail: Array<{ label: string; value: string }>;
}

const STATUSES = ['new', 'contacted', 'qualified', 'converted', 'declined', 'spam'] as const;

const STATUS_TONE: Record<string, string> = {
  new:       'bg-primary/10 text-primary',
  contacted: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  qualified: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  converted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  declined:  'bg-muted text-muted-foreground',
  spam:      'bg-destructive/10 text-destructive',
};

// The forms store machine values; nobody should have to read `500k_1m`.
const LABELS: Record<string, string> = {
  under_50k: 'Under $50k', '50k_100k': '$50k–$100k', '100k_250k': '$100k–$250k',
  '250k_500k': '$250k–$500k', '500k_plus': '$500k+',
  under_100k: 'Under $100k', '100k_500k': '$100k–$500k', '500k_1m': '$500k–$1m',
  '1m_5m': '$1m–$5m', '5m_plus': '$5m+', undecided: 'Undecided',
  accredited: 'Accredited', not_accredited: 'Not accredited', unsure: 'Unsure',
  immediate: 'Immediately', three_months: 'Within 3 months',
  six_months: 'Within 6 months', exploring: 'Exploring',
  acquisition: 'Acquisition', development: 'Development', construction: 'Construction',
  renovation: 'Renovation', management: 'Management', consultation: 'Consultation', other: 'Other',
};
const pretty = (value: string | null) => (value ? LABELS[value] ?? value : null);

const detailRow = (label: string, value: string | null | undefined) =>
  value ? [{ label, value }] : [];

const when = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function InquiryInbox() {
  const { user, hasPersona } = useAuth();
  // The CRM opens for admins and project managers, but the inquiry policies are
  // `is_organization_admin` -- owner and admin only, deliberately, because a
  // lead carries a name, an email and how much someone said they would invest.
  // Without this a project manager met a raw "permission denied for table
  // investor_inquiries" on every CRM visit. The gate matches the policy rather
  // than the surrounding screen.
  const canSeeInquiries = hasPersona('admin');
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [showHandled, setShowHandled] = useState(false);

  const inquiries = useQuery({
    queryKey: ['crm-inquiries'],
    enabled: canSeeInquiries,
    queryFn: async (): Promise<Inquiry[]> => {
      const [investor, project] = await Promise.all([
        supabase.from('investor_inquiries').select('*').order('created_at', { ascending: false }),
        supabase.from('project_inquiries').select('*').order('created_at', { ascending: false }),
      ]);
      if (investor.error) throw new Error(investor.error.message);
      if (project.error) throw new Error(project.error.message);

      const fromInvestor = (investor.data ?? []).map((row): Inquiry => ({
        id: row.id, kind: 'investor', full_name: row.full_name, email: row.email,
        phone: row.phone, message: row.message, status: row.status,
        internal_notes: row.internal_notes, created_at: row.created_at,
        reviewed_at: row.reviewed_at,
        detail: [
          ...detailRow('Accreditation', pretty(row.accreditation_self_report)),
          ...detailRow('Investment range', pretty(row.investment_range)),
          ...detailRow('Timeframe', pretty(row.timeframe)),
          ...detailRow('Heard via', row.heard_via),
        ],
      }));

      const fromProject = (project.data ?? []).map((row): Inquiry => ({
        id: row.id, kind: 'project', full_name: row.full_name, email: row.email,
        phone: row.phone, message: row.message, status: row.status,
        internal_notes: row.internal_notes, created_at: row.created_at,
        reviewed_at: row.reviewed_at,
        detail: [
          ...detailRow('Project type', pretty(row.project_type)),
          ...detailRow('Company', row.company_name),
          ...detailRow('Property', row.property_address),
          ...detailRow('Budget', pretty(row.budget_range)),
          ...detailRow('Timeline', row.desired_timeline),
        ],
      }));

      return [...fromInvestor, ...fromProject]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const all = useMemo(() => inquiries.data ?? [], [inquiries.data]);
  const open = all.filter((row) => row.status === 'new' || row.status === 'contacted');
  const visible = showHandled ? all : open;

  const save = async (row: Inquiry, changes: { status?: string; internal_notes?: string }) => {
    setBusy(true);
    const table = row.kind === 'investor' ? 'investor_inquiries' : 'project_inquiries';
    // reviewed_by/reviewed_at exist to record who triaged a lead and when;
    // stamping them here is what makes them meaningful rather than always null.
    const { error } = await supabase.from(table).update({
      ...changes,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never).eq('id', row.id);
    setBusy(false);
    if (error) {
      toast({ title: 'Enquiry not updated', description: error.message, variant: 'destructive' });
      return;
    }
    if (changes.status) track('inquiry_status_changed', { kind: row.kind, status: changes.status });
    toast({ title: changes.status ? `Marked ${changes.status}` : 'Notes saved' });
    setSelected((current) => (current ? { ...current, ...changes } : current));
    await queryClient.invalidateQueries({ queryKey: ['crm-inquiries'] });
  };

  if (!canSeeInquiries) return null;

  if (inquiries.isLoading) {
    return <Card><CardContent className="flex min-h-[160px] items-center justify-center p-6"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>;
  }
  if (inquiries.error) {
    return <Card><CardContent className="p-6 text-center">
      <p className="font-medium">Inbound enquiries could not be loaded</p>
      <p className="mt-1 text-sm text-muted-foreground">{(inquiries.error as Error).message}</p>
      <Button className="mt-4" variant="outline" onClick={() => inquiries.refetch()}>Try again</Button>
    </CardContent></Card>;
  }
  if (all.length === 0) return null;

  return <>
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Inbox className="h-4 w-4" />Inbound enquiries</h2>
            <p className="text-sm text-muted-foreground">Everything submitted through the investor and project forms.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={open.length ? 'default' : 'secondary'}>{open.length} open</Badge>
            <Button variant="ghost" size="sm" onClick={() => setShowHandled((value) => !value)}>
              {showHandled ? 'Open only' : `Show all ${all.length}`}
            </Button>
          </div>
        </div>

        {visible.length === 0
          ? <p className="py-6 text-center text-sm text-muted-foreground">No open enquiries. Every lead has been triaged.</p>
          : <div className="divide-y">
              {visible.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => { setSelected(row); setNotes(row.internal_notes ?? ''); }}
                  className="flex w-full items-start gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:text-primary"
                >
                  <div className={cn('mt-0.5 shrink-0 rounded-xl p-2', row.kind === 'investor'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-sky-500/10 text-sky-600 dark:text-sky-400')}>
                    {row.kind === 'investor' ? <TrendingUp className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.email}
                      {row.detail[0] ? ` · ${row.detail[0].value}` : ''}
                      {` · ${when(row.created_at)}`}
                    </p>
                  </div>
                  <Badge className={cn('shrink-0 border-0', STATUS_TONE[row.status])}>{row.status}</Badge>
                </button>
              ))}
            </div>}
      </CardContent>
    </Card>

    <Sheet open={!!selected} onOpenChange={(next) => !next && setSelected(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {selected && <>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selected.kind === 'investor' ? <TrendingUp className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
              {selected.full_name}
            </SheetTitle>
            <SheetDescription>
              {selected.kind === 'investor' ? 'Investor enquiry' : 'Project enquiry'} · received {when(selected.created_at)}
              {selected.reviewed_at ? ` · last triaged ${when(selected.reviewed_at)}` : ''}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <a href={`mailto:${selected.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
                <Mail className="h-4 w-4 text-muted-foreground" />{selected.email}
              </a>
              {selected.phone && (
                <a href={`tel:${selected.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
                  <Phone className="h-4 w-4 text-muted-foreground" />{selected.phone}
                </a>
              )}
            </div>

            {selected.detail.length > 0 && (
              <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
                {selected.detail.map((item) => (
                  <div key={item.label} className="bg-card p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                    <dd className="mt-1 text-sm font-medium">{item.value}</dd>
                  </div>
                ))}
              </dl>
            )}

            {selected.message && (
              <div>
                <Label className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />What they wrote</Label>
                <p className="mt-2 whitespace-pre-wrap rounded-xl border bg-muted/40 p-3 text-sm">{selected.message}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="inquiry-status">Status</Label>
              <Select value={selected.status} onValueChange={(value) => void save(selected, { status: value })}>
                <SelectTrigger id="inquiry-status" disabled={busy}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inquiry-notes">Internal notes</Label>
              <Textarea
                id="inquiry-notes"
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Not shown to the enquirer."
              />
              <Button
                size="sm"
                disabled={busy || notes === (selected.internal_notes ?? '')}
                onClick={() => void save(selected, { internal_notes: notes })}
              >
                {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Save notes
              </Button>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />Received {when(selected.created_at)}
            </p>
          </div>
        </>}
      </SheetContent>
    </Sheet>
  </>;
}
