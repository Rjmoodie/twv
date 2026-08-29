import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2, CalendarClock, Check, CheckCircle2, Loader2, Mail, MessageSquarePlus,
  Phone, Plus, Search, ShieldAlert, UserRound, Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/app/AuthProvider';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';

type Result = { data: unknown; error: { message: string } | null };
interface QueryChain extends PromiseLike<Result> {
  eq(column: string, value: unknown): QueryChain;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): QueryChain;
}
interface Table { select(columns?: string): QueryChain; insert(values: Record<string, unknown>): QueryChain; update(values: Record<string, unknown>): QueryChain; }
interface CRMDatabase { from(table: string): Table; rpc(name: string, args?: Record<string, unknown>): Promise<Result>; }
const database = supabase as unknown as CRMDatabase;

type ContactKind = 'investor' | 'client' | 'vendor' | 'lender' | 'broker' | 'owner' | 'other';
/**
 * `crm_contacts` also has `last_contact_at`, `next_follow_up_at` and `tags`.
 * None of them are selected here, because nothing in the product writes them —
 * follow-ups live in `crm_activities.due_at`, which is what this screen reads.
 * The list used to be ordered by `next_follow_up_at`, so every row sorted on
 * NULL and the order was whatever Postgres felt like returning.
 */
interface Contact {
  id: string; organization_id: string; kind: ContactKind; first_name: string; last_name: string;
  company_name: string | null; email: string | null; phone: string | null; status: string;
  created_at: string;
}
interface Activity {
  id: string; organization_id: string; contact_id: string; project_id: string | null;
  activity_type: 'note' | 'call' | 'email' | 'meeting' | 'task'; subject: string;
  body: string | null; due_at: string | null; completed_at: string | null; created_at: string;
}
interface PortfolioChoice { project_id: string; organization_id: string; project_name: string; can_manage: boolean; }
interface ContactProject { contact_id: string; project_id: string; relationship: string; }

const pretty = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString() : 'Not scheduled';

export default function CRM() {
  const { user, access, accessLoading, hasPersona } = useAuth();
  const queryClient = useQueryClient();
  const canUseCRM = hasPersona('admin') || hasPersona('project_manager');
  const canCreate = hasPersona('admin');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | ContactKind | 'follow_up'>('all');
  const [selected, setSelected] = useState<Contact | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);

  const contactsQuery = useQuery({
    queryKey: ['crm-contacts'], enabled: canUseCRM && !accessLoading,
    queryFn: async () => {
      const result = await database.from('crm_contacts').select('id, organization_id, kind, first_name, last_name, company_name, email, phone, status, created_at').order('created_at', { ascending: false });
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as Contact[];
    },
  });
  const projectsQuery = useQuery({
    queryKey: ['crm-project-choices'], enabled: canUseCRM && !accessLoading,
    queryFn: async () => {
      const result = await database.rpc('get_portfolio_projects');
      if (result.error) throw new Error(result.error.message);
      return ((result.data ?? []) as PortfolioChoice[]).filter((project) => project.can_manage);
    },
  });
  const activitiesQuery = useQuery({
    queryKey: ['crm-activities'], enabled: canUseCRM && !accessLoading,
    queryFn: async () => {
      const result = await database.from('crm_activities').select('id, organization_id, contact_id, project_id, activity_type, subject, body, due_at, completed_at, created_at').order('created_at', { ascending: false });
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as Activity[];
    },
  });
  const linksQuery = useQuery({
    queryKey: ['crm-contact-projects'], enabled: canUseCRM && !accessLoading,
    queryFn: async () => {
      const result = await database.from('crm_contact_projects').select('contact_id, project_id, relationship').order('created_at', { ascending: false });
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as ContactProject[];
    },
  });

  const contacts = useMemo(() => contactsQuery.data ?? [], [contactsQuery.data]);
  const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
  const contactLinks = useMemo(() => linksQuery.data ?? [], [linksQuery.data]);
  const projectNames = useMemo(() => new Map((projectsQuery.data ?? []).map((project) => [project.project_id, project.project_name])), [projectsQuery.data]);
  const dueContactIds = useMemo(() => new Set(activities.filter((activity) => activity.activity_type === 'task' && !activity.completed_at && activity.due_at && new Date(activity.due_at) <= new Date()).map((activity) => activity.contact_id)), [activities]);

  // Soonest open task per contact. This is the only real "next action" signal in
  // the data, so it drives ordering: what is due soonest comes first, and
  // contacts with nothing scheduled fall to the bottom alphabetically rather
  // than into arbitrary database order.
  const nextDueByContact = useMemo(() => {
    const map = new Map<string, number>();
    for (const activity of activities) {
      if (activity.activity_type !== 'task' || activity.completed_at || !activity.due_at) continue;
      const due = new Date(activity.due_at).getTime();
      if (Number.isNaN(due)) continue;
      const current = map.get(activity.contact_id);
      if (current === undefined || due < current) map.set(activity.contact_id, due);
    }
    return map;
  }, [activities]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const byName = (contact: Contact) => `${contact.last_name} ${contact.first_name}`.toLowerCase();
    return contacts
      .filter((contact) => {
        if (filter === 'follow_up' && !dueContactIds.has(contact.id)) return false;
        if (filter !== 'all' && filter !== 'follow_up' && contact.kind !== filter) return false;
        return !needle || [contact.first_name, contact.last_name, contact.company_name, contact.email, contact.phone].some((value) => value?.toLowerCase().includes(needle));
      })
      .sort((a, b) => {
        const dueA = nextDueByContact.get(a.id);
        const dueB = nextDueByContact.get(b.id);
        if (dueA !== undefined && dueB !== undefined) return dueA - dueB;
        if (dueA !== undefined) return -1;
        if (dueB !== undefined) return 1;
        return byName(a).localeCompare(byName(b));
      });
  }, [contacts, filter, search, dueContactIds, nextDueByContact]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] }),
      queryClient.invalidateQueries({ queryKey: ['crm-activities'] }),
    ]);
  };

  if (accessLoading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!canUseCRM) return <Card><CardContent className="flex min-h-[380px] flex-col items-center justify-center p-8 text-center"><ShieldAlert className="mb-4 h-10 w-10 text-muted-foreground" /><h1 className="text-xl font-semibold">CRM access is internal</h1><p className="mt-2 max-w-md text-sm text-muted-foreground">Project contacts and communication history are available only to organization administrators and assigned project managers.</p></CardContent></Card>;
  if (contactsQuery.error || activitiesQuery.error || linksQuery.error) return <Card><CardContent className="p-8 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" /><h2 className="font-semibold">CRM could not be loaded</h2><p className="mt-2 text-sm text-muted-foreground">{contactsQuery.error?.message ?? activitiesQuery.error?.message ?? linksQuery.error?.message}</p><Button className="mt-5" onClick={() => { contactsQuery.refetch(); activitiesQuery.refetch(); linksQuery.refetch(); }}>Try again</Button></CardContent></Card>;

  const openTasks = activities.filter((activity) => activity.activity_type === 'task' && !activity.completed_at);
  const overdue = openTasks.filter((activity) => activity.due_at && new Date(activity.due_at) <= new Date());
  const actionQueue = [...openTasks].sort((a, b) => {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  }).slice(0, 5);
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  return <div className="space-y-6 pb-24 lg:pb-8">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex gap-2"><Badge variant="outline">Relationship operations</Badge>{hasPersona('project_manager') && !canCreate && <Badge variant="secondary">Assigned projects only</Badge>}</div><h1 className="text-3xl font-bold tracking-tight">CRM</h1><p className="mt-1 text-muted-foreground">Every relationship has an owner, history, and next action.</p></div>{canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add contact</Button>}</header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat icon={Users} label="Visible contacts" value={contacts.length} active={filter === 'all'} onClick={() => setFilter('all')} />
      <Stat icon={Building2} label="Investors" value={contacts.filter((contact) => contact.kind === 'investor').length} active={filter === 'investor'} onClick={() => setFilter('investor')} />
      <Stat icon={UserRound} label="Clients" value={contacts.filter((contact) => contact.kind === 'client').length} active={filter === 'client'} onClick={() => setFilter('client')} />
      <Stat icon={CalendarClock} label="Follow-ups due" value={overdue.length} active={filter === 'follow_up'} onClick={() => setFilter('follow_up')} />
    </div>
    <div className="relative max-w-lg"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people, companies, email, or phone" /></div>
    {actionQueue.length > 0 && <Card><CardContent className="p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Next-action queue</h2><p className="text-sm text-muted-foreground">The most urgent open follow-ups across your visible relationships.</p></div><Badge variant={overdue.length ? 'destructive' : 'secondary'}>{overdue.length ? `${overdue.length} overdue` : 'On track'}</Badge></div><div className="divide-y">{actionQueue.map((task) => { const contact = contactById.get(task.contact_id); const isOverdue = !!task.due_at && new Date(task.due_at) <= new Date(); return <button key={task.id} type="button" onClick={() => contact && setSelected(contact)} className="flex w-full items-center gap-3 py-3 text-left transition first:pt-0 last:pb-0 hover:text-primary"><CalendarClock className={cn('h-4 w-4 shrink-0', isOverdue ? 'text-destructive' : 'text-muted-foreground')} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{task.subject}</p><p className="truncate text-xs text-muted-foreground">{contact ? `${contact.first_name} ${contact.last_name}` : 'Contact'} · {dateTime(task.due_at)}</p></div><Badge variant="outline">{isOverdue ? 'Overdue' : 'Upcoming'}</Badge></button>; })}</div></CardContent></Card>}
    {contactsQuery.isLoading ? <div className="flex min-h-[260px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin" /></div> : contacts.length === 0 ? <Card><CardContent className="flex min-h-[330px] flex-col items-center justify-center p-8 text-center"><Users className="mb-4 h-10 w-10 text-muted-foreground" /><h2 className="text-xl font-semibold">No relationships recorded yet</h2><p className="mt-2 max-w-md text-sm text-muted-foreground">{canCreate ? 'Add an investor, client, lender, broker, or vendor and connect them to a project.' : 'Contacts linked to your assigned projects will appear here.'}</p>{canCreate && <Button className="mt-6" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add first contact</Button>}</CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="p-10 text-center"><p className="font-medium">No contacts match this view.</p><Button variant="link" onClick={() => { setFilter('all'); setSearch(''); }}>Clear filters</Button></CardContent></Card> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((contact) => {
      const contactActivities = activities.filter((activity) => activity.contact_id === contact.id);
      const linkedProjects = contactLinks.filter((link) => link.contact_id === contact.id);
      const nextTask = contactActivities.filter((activity) => activity.activity_type === 'task' && !activity.completed_at).sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      })[0];
      return <Card key={contact.id} className="transition hover:border-primary/30 hover:shadow-sm"><CardContent className="p-5"><button className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setSelected(contact)}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold">{contact.first_name} {contact.last_name}</h2><p className="truncate text-sm text-muted-foreground">{contact.company_name ?? pretty(contact.kind)}</p></div><Badge variant="outline">{pretty(contact.kind)}</Badge></div>{linkedProjects.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{linkedProjects.slice(0, 2).map((link) => <Badge key={`${link.project_id}-${link.relationship}`} variant="secondary">{projectNames.get(link.project_id) ?? 'Assigned project'}</Badge>)}{linkedProjects.length > 2 && <Badge variant="secondary">+{linkedProjects.length - 2}</Badge>}</div>}<div className="mt-4 space-y-1.5 text-sm text-muted-foreground">{contact.email && <p className="flex items-center gap-2 truncate"><Mail className="h-3.5 w-3.5" />{contact.email}</p>}{contact.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{contact.phone}</p>}<p className={cn('flex items-center gap-2', nextTask?.due_at && new Date(nextTask.due_at) <= new Date() && 'font-medium text-destructive')}><CalendarClock className="h-3.5 w-3.5" />{nextTask ? `${nextTask.subject} · ${dateTime(nextTask.due_at)}` : 'No follow-up scheduled'}</p></div></button><div className="mt-4 flex gap-2"><Button size="sm" className="flex-1" onClick={() => { setSelected(contact); setActivityOpen(true); }}><MessageSquarePlus className="mr-2 h-4 w-4" />Log / follow up</Button>{contact.email && <Button size="icon" variant="outline" asChild><a href={`mailto:${contact.email}`} aria-label={`Email ${contact.first_name}`}><Mail className="h-4 w-4" /></a></Button>}</div></CardContent></Card>;
    })}</div>}
    <ContactSheet contact={selected} activities={activities.filter((activity) => activity.contact_id === selected?.id)} isAdmin={canCreate} onClose={() => setSelected(null)} onLog={() => setActivityOpen(true)} onRefresh={refresh} />
    <CreateContactDialog open={createOpen} onOpenChange={setCreateOpen} organizationIds={access.organizations.filter((item) => item.role === 'owner' || item.role === 'admin').map((item) => item.organization_id)} projects={projectsQuery.data ?? []} onCreated={refresh} />
    <ActivityDialog open={activityOpen} onOpenChange={setActivityOpen} contact={selected} projects={projectsQuery.data ?? []} userId={user?.id ?? ''} canLogWithoutProject={canCreate} onCreated={refresh} />
  </div>;
}

const Stat = ({ icon: Icon, label, value, active, onClick }: { icon: typeof Users; label: string; value: number; active: boolean; onClick: () => void }) => <button type="button" onClick={onClick} className={cn('rounded-xl border bg-card p-4 text-left transition hover:border-primary/50', active && 'border-primary ring-2 ring-primary/10')}><Icon className="mb-3 h-5 w-5 text-muted-foreground" /><p className="text-2xl font-bold">{value}</p><p className="text-sm text-muted-foreground">{label}</p></button>;

const ContactSheet = ({ contact, activities, isAdmin, onClose, onLog, onRefresh }: { contact: Contact | null; activities: Activity[]; isAdmin: boolean; onClose: () => void; onLog: () => void; onRefresh: () => Promise<void> }) => {
  const complete = async (activity: Activity) => { const result = await database.from('crm_activities').update({ completed_at: new Date().toISOString() }).eq('id', activity.id); if (result.error) { toast({ title: 'Task was not completed', description: result.error.message, variant: 'destructive' }); return; } track('crm_task_completed', { activity_id: activity.id }); toast({ title: 'Follow-up completed' }); await onRefresh(); };
  return <Sheet open={!!contact} onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">{contact && <><SheetHeader><SheetTitle>{contact.first_name} {contact.last_name}</SheetTitle><SheetDescription>{contact.company_name ?? pretty(contact.kind)} · {pretty(contact.status)}</SheetDescription></SheetHeader><div className="mt-5 flex flex-wrap gap-2"><Button onClick={onLog}><MessageSquarePlus className="mr-2 h-4 w-4" />Log activity</Button>{contact.email && <Button variant="outline" asChild><a href={`mailto:${contact.email}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button>}{contact.phone && <Button variant="outline" asChild><a href={`tel:${contact.phone}`}><Phone className="mr-2 h-4 w-4" />Call</a></Button>}</div><div className="mt-7"><h3 className="font-semibold">Relationship timeline</h3>{activities.length ? <div className="mt-3 space-y-3">{activities.map((activity) => <article key={activity.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{pretty(activity.activity_type)}</Badge><h4 className="mt-2 font-medium">{activity.subject}</h4></div>{activity.activity_type === 'task' && !activity.completed_at && <Button size="sm" variant="outline" onClick={() => complete(activity)}><Check className="mr-2 h-4 w-4" />Complete</Button>}{activity.completed_at && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}</div>{activity.body && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{activity.body}</p>}<p className="mt-3 text-xs text-muted-foreground">{activity.due_at ? `Due ${dateTime(activity.due_at)} · ` : ''}{new Date(activity.created_at).toLocaleString()}</p></article>)}</div> : <p className="mt-3 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{isAdmin ? 'No activity logged yet. Record the first conversation or schedule the next follow-up.' : 'No activity you can see. Organization-wide notes are visible only to administrators.'}</p>}{!isAdmin && <p className="mt-3 text-xs text-muted-foreground">This timeline shows activity on your assigned projects. Notes recorded against the organization rather than a project are not shown.</p>}</div></>}</SheetContent></Sheet>;
};

const CreateContactDialog = ({ open, onOpenChange, organizationIds, projects, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; organizationIds: string[]; projects: PortfolioChoice[]; onCreated: () => Promise<void> }) => {
  const [busy, setBusy] = useState(false); const [organizationId, setOrganizationId] = useState(''); const [kind, setKind] = useState<ContactKind>('client'); const [projectId, setProjectId] = useState('none'); const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', company_name: '' });

  // `organizationId` was seeded from `organizationIds[0]` at first render only,
  // so it never picked up a later value and stayed ''. Combined with the early
  // return in submit, that made "Create contact" a no-op with no feedback.
  // Re-seed whenever the dialog opens, and refuse to render the form at all
  // when there is no workspace to create into.
  useEffect(() => {
    if (!open) return;
    setOrganizationId(organizationIds[0] ?? '');
    setKind('client'); setProjectId('none');
    setForm({ first_name: '', last_name: '', email: '', phone: '', company_name: '' });
  }, [open, organizationIds]);

  const submit = async () => { if (!organizationId || !form.first_name.trim() || !form.last_name.trim()) return; setBusy(true); const result = await database.rpc('create_crm_contact', { target_organization: organizationId, contact_kind: kind, ...form, target_project: projectId === 'none' ? null : projectId }); setBusy(false); if (result.error) { toast({ title: 'Contact was not created', description: result.error.message, variant: 'destructive' }); return; } track('crm_contact_created', { contact_kind: kind, linked_to_project: projectId !== 'none' }); toast({ title: 'Contact created' }); onOpenChange(false); await onCreated(); };

  if (!organizationIds.length) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>No workspace available</DialogTitle><DialogDescription>Creating a contact requires owner or administrator rights on a workspace. Your account does not currently hold either, so ask a workspace owner to grant access.</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => onOpenChange(false)}>Close</Button></DialogFooter></DialogContent></Dialog>;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add CRM contact</DialogTitle><DialogDescription>Create a relationship record and optionally connect it to a project.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2">{organizationIds.length > 1 && <Field label="Workspace"><Select value={organizationId} onValueChange={setOrganizationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{organizationIds.map((id, index) => <SelectItem key={id} value={id}>Workspace {index + 1}</SelectItem>)}</SelectContent></Select></Field>}<Field label="Relationship type"><Select value={kind} onValueChange={(value) => setKind(value as ContactKind)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['investor','client','vendor','lender','broker','owner','other'].map((value) => <SelectItem key={value} value={value}>{pretty(value)}</SelectItem>)}</SelectContent></Select></Field><Field label="First name *"><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></Field><Field label="Last name *"><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></Field><Field label="Company"><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="Phone"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Initial project"><Select value={projectId} onValueChange={(value) => { setProjectId(value); const project = projects.find((item) => item.project_id === value); if (project) setOrganizationId(project.organization_id); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No project yet</SelectItem>{projects.map((project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name}</SelectItem>)}</SelectContent></Select></Field></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={busy || !form.first_name.trim() || !form.last_name.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create contact</Button></DialogFooter></DialogContent></Dialog>;
};

const ActivityDialog = ({ open, onOpenChange, contact, projects, userId, canLogWithoutProject, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; contact: Contact | null; projects: PortfolioChoice[]; userId: string; canLogWithoutProject: boolean; onCreated: () => Promise<void> }) => {
  const [busy, setBusy] = useState(false); const [type, setType] = useState<Activity['activity_type']>('note'); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [dueAt, setDueAt] = useState('');
  const availableProjects = useMemo(() => projects.filter((project) => project.organization_id === contact?.organization_id), [projects, contact?.organization_id]);
  const [projectId, setProjectId] = useState('');

  // Every field resets when the dialog opens on a different contact.
  //
  // Previously only subject/body/due were cleared on success, so `projectId`
  // and `type` survived. Logging a call for one contact and then opening the
  // dialog for another in the same organization silently filed the second
  // activity against the first contact's project — no error, wrong data. Across
  // organizations the (project_id, organization_id) foreign key caught it, but
  // as a raw Postgres error in a toast.
  useEffect(() => {
    if (!open) return;
    setType('note'); setSubject(''); setBody(''); setDueAt('');
    // An admin may log against no project at all. A project manager may not, so
    // preselect only when the choice is unambiguous and otherwise make them pick.
    setProjectId(canLogWithoutProject ? 'none' : (availableProjects.length === 1 ? availableProjects[0].project_id : ''));
  }, [open, contact?.id, canLogWithoutProject, availableProjects]);

  const chosenProject = projectId === 'none' ? null : projectId;
  const projectMissing = !canLogWithoutProject && !chosenProject;

  const submit = async () => { if (!contact || !subject.trim() || !userId || projectMissing) return; setBusy(true); const result = await database.from('crm_activities').insert({ organization_id: contact.organization_id, contact_id: contact.id, project_id: chosenProject, activity_type: type, subject: subject.trim(), body: body.trim() || null, due_at: type === 'task' && dueAt ? new Date(dueAt).toISOString() : null, assigned_to: type === 'task' ? userId : null, created_by: userId }); setBusy(false); if (result.error) { toast({ title: 'Activity was not recorded', description: result.error.message, variant: 'destructive' }); return; } track('crm_activity_created', { activity_type: type, project_id: chosenProject }); toast({ title: type === 'task' ? 'Follow-up scheduled' : 'Activity recorded' }); onOpenChange(false); await onCreated(); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Log activity for {contact?.first_name}</DialogTitle><DialogDescription>Capture what happened or assign the next concrete follow-up.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Activity"><Select value={type} onValueChange={(value) => setType(value as Activity['activity_type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['note','call','email','meeting','task'].map((value) => <SelectItem key={value} value={value}>{pretty(value)}</SelectItem>)}</SelectContent></Select></Field>{(availableProjects.length > 0 || canLogWithoutProject) && <Field label={canLogWithoutProject ? 'Project' : 'Project *'}><Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger><SelectContent>{canLogWithoutProject && <SelectItem value="none">No project</SelectItem>}{availableProjects.map((project) => <SelectItem key={project.project_id} value={project.project_id}>{project.project_name}</SelectItem>)}</SelectContent></Select></Field>}<Field label="Subject *"><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={type === 'task' ? 'Follow up on financing documents' : 'Quarterly project check-in'} /></Field><Field label="Details"><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>{type === 'task' && <Field label="Due"><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>}</div><DialogFooter><Button onClick={submit} disabled={busy || !subject.trim() || projectMissing}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{type === 'task' ? 'Schedule follow-up' : 'Record activity'}</Button></DialogFooter>{!canLogWithoutProject && availableProjects.length === 0 ? <p className="text-xs text-destructive">Connect this contact to an assigned project before logging activity.</p> : projectMissing && <p className="text-xs text-muted-foreground">Choose which project this belongs to.</p>}</DialogContent></Dialog>;
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-2"><Label>{label}</Label>{children}</div>;
