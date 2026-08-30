import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, Building2, CalendarClock, CircleDollarSign,
  BriefcaseBusiness, CheckCircle2, ClipboardPlus, Copy, Download, FileText, LayoutList, Loader2,
  Map, MapPin, MessageSquarePlus, Plus, Search, Send, Upload, Users, WalletCards,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/app/AuthProvider';
import { useNavigation } from '@/contexts/NavigationContext';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { toast } from '@/hooks/use-toast';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PortfolioMap from './PortfolioMap';
import PMPortfolioStudio from './PMPortfolioStudio';
import type { PortfolioHealth, PortfolioProject, ProjectDocument, ProjectMilestone, ProjectRequest, ProjectUpdate } from './types';

type ViewMode = 'list' | 'map' | 'split';
type Result = { data: unknown; error: { message: string } | null };
interface QueryChain extends PromiseLike<Result> {
  eq(column: string, value: unknown): QueryChain;
  order(column: string, options?: { ascending?: boolean }): QueryChain;
  limit(count: number): QueryChain;
}
interface DataTable {
  select(columns?: string): QueryChain;
  insert(values: Record<string, unknown>): QueryChain;
  update(values: Record<string, unknown>): QueryChain;
}
interface PortfolioDatabase {
  rpc(name: string, args?: Record<string, unknown>): Promise<Result>;
  from(table: string): DataTable;
}

const database = supabase as unknown as PortfolioDatabase;

const healthLabels: Record<PortfolioHealth, string> = {
  on_track: 'On track',
  attention: 'Attention',
  at_risk: 'At risk',
  needs_plan: 'Needs plan',
};

const healthClasses: Record<PortfolioHealth, string> = {
  on_track: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  attention: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  at_risk: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  needs_plan: 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300',
};

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const pretty = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
const personaLabel = (value: string) => value === 'admin'
  ? 'Organization administrator'
  : value === 'project_manager'
    ? 'Project manager'
    : value === 'client' || value === 'investor'
      ? 'Investor partner'
      : pretty(value);
const shortDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
  : 'Not scheduled';

const numberFields: Array<keyof PortfolioProject> = [
  'latitude', 'longitude', 'approved_budget', 'committed_amount', 'paid_amount',
  'budget_variance', 'overdue_milestones', 'commitment_amount', 'contributed_amount', 'distributed_amount',
];

const normalizeProject = (row: Record<string, unknown>): PortfolioProject => {
  const normalized = { ...row } as unknown as PortfolioProject;
  numberFields.forEach((field) => {
    const value = row[field];
    (normalized as unknown as Record<string, unknown>)[field] = value == null ? null : Number(value);
  });
  return normalized;
};

const Portfolio = () => {
  const { access, accessLoading, hasPersona } = useAuth();
  const { navigateToModule } = useNavigation();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [view, setView] = useState<ViewMode>(() => {
    const stored = new URLSearchParams(window.location.search).get('portfolio-view');
    return stored === 'map' || stored === 'split' ? stored : 'list';
  });
  const [search, setSearch] = useState('');
  const [health, setHealth] = useState<'all' | PortfolioHealth>('all');
  const [selected, setSelected] = useState<PortfolioProject | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [portfolioStudioOpen, setPortfolioStudioOpen] = useState(false);
  const busy = false;

  const portfolioQuery = useQuery({
    queryKey: ['portfolio-projects'],
    queryFn: async () => {
      const result = await database.rpc('get_portfolio_projects');
      if (result.error) throw new Error(result.error.message);
      return ((result.data ?? []) as Record<string, unknown>[]).map(normalizeProject);
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    track('portfolio_viewed', { persona: access.personas.join(',') || 'unknown' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const changeView = (next: ViewMode) => {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set('portfolio-view', next);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    track('portfolio_view_toggled', { view: next });
  };

  const projects = useMemo(() => portfolioQuery.data ?? [], [portfolioQuery.data]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (health !== 'all' && project.health !== health) return false;
      if (!needle) return true;
      return [project.project_name, project.property_name, project.address, project.city, project.state, project.stage]
        .some((value) => value?.toLowerCase().includes(needle));
    });
  }, [projects, search, health]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['portfolio-projects'] });
    if (selected) await queryClient.invalidateQueries({ queryKey: ['project-updates', selected.project_id] });
  };

  const runPrimaryAction = async (project: PortfolioProject) => {
    setSelected(project);
    if (project.next_action === 'view_update') {
      window.setTimeout(() => document.getElementById('project-updates-panel')?.scrollIntoView({ behavior: 'smooth' }), 100);
      return;
    }
    if (project.next_action === 'invite_project_manager') {
      setInviteOpen(true);
      return;
    }
    if ((project.next_action === 'update_milestone' || project.next_action === 'resolve_overdue') && project.next_milestone_id) {
      window.setTimeout(() => document.getElementById('project-milestones-panel')?.scrollIntoView({ behavior: 'smooth' }), 100);
      return;
    }
    setUpdateOpen(true);
  };

  const canCreate = hasPersona('admin');
  const portalMode = hasPersona('client') && !hasPersona('admin') && !hasPersona('project_manager')
    ? 'client' : hasPersona('project_manager') && !hasPersona('admin') ? 'project_manager' : 'operations';
  const counts = {
    all: projects.length,
    at_risk: projects.filter((item) => item.health === 'at_risk').length,
    attention: projects.filter((item) => item.health === 'attention').length,
    needs_plan: projects.filter((item) => item.health === 'needs_plan').length,
  };

  if (portfolioQuery.isLoading || accessLoading) {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (portfolioQuery.error) {
    return (
      <Card><CardContent className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="mb-3 h-8 w-8 text-destructive" />
        <h2 className="text-lg font-semibold">Portfolio could not be loaded</h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">{portfolioQuery.error.message}</p>
        <Button className="mt-5" onClick={() => portfolioQuery.refetch()}>Try again</Button>
      </CardContent></Card>
    );
  }

  return (
    <div className="operations-module space-y-6 pb-24 lg:pb-8">
      <header className="operations-module__header flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="operations-eyebrow">Asset operations</span>
            {access.personas.map((persona) => <Badge key={persona} variant="outline">{personaLabel(persona)}</Badge>)}
          </div>
          <h1 className="operations-title text-4xl tracking-tight">{portalMode === 'client' ? 'My projects' : portalMode === 'project_manager' ? 'Project command center' : 'Project portfolio'}</h1>
          <p className="mt-1 text-muted-foreground">{portalMode === 'client' ? 'Follow progress, upcoming milestones, shared documents, and the latest decisions.' : portalMode === 'project_manager' ? 'Prioritize schedule risk, communicate progress, and keep every assignment moving.' : 'Properties, project health, capital, and the next action in one operating view.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">{hasPersona('project_manager') && <Button variant="outline" onClick={() => setPortfolioStudioOpen(true)}><BriefcaseBusiness className="mr-2 h-4 w-4" />Public portfolio</Button>}{canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add project</Button>}</div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {([
          ['all', 'All projects', counts.all, Building2],
          ['at_risk', 'At risk', counts.at_risk, AlertTriangle],
          ['attention', 'Attention', counts.attention, CalendarClock],
          ['needs_plan', 'Needs plan', counts.needs_plan, MapPin],
        ] as const).map(([key, label, count, Icon]) => (
          <button key={key} type="button" onClick={() => setHealth(key)} className={cn(
            'operations-stat border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm',
            health === key && 'border-primary ring-2 ring-primary/10',
          )}>
            <Icon className="mb-3 h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold">{count}</p><p className="text-sm text-muted-foreground">{label}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects or locations" className="pl-9" />
        </div>
        <div className="operations-view-toggle grid grid-cols-2 border bg-card p-1 sm:grid-cols-3">
          <Button size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => changeView('list')}><LayoutList className="mr-2 h-4 w-4" />List</Button>
          <Button size="sm" variant={view === 'map' ? 'secondary' : 'ghost'} onClick={() => changeView('map')}><Map className="mr-2 h-4 w-4" />Map</Button>
          {!isMobile && <Button size="sm" variant={view === 'split' ? 'secondary' : 'ghost'} onClick={() => changeView('split')}>Split</Button>}
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="operations-empty-state"><CardContent className="flex min-h-[390px] flex-col items-center justify-center p-8 text-center">
          <div className="operations-empty-state__icon"><Building2 className="h-9 w-9" /></div>
          <span className="operations-eyebrow mt-5">Property record 01</span>
          <h2 className="operations-title mt-2 text-3xl">Establish your first asset</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {canCreate ? 'Create the property and operating record together, then assign the project team and investor partners.' : 'Your assigned properties will appear here as soon as an administrator grants project access.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {canCreate && <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add first asset</Button>}
            {canCreate && <Button variant="outline" onClick={() => navigateToModule('real-estate')}>Underwrite a deal</Button>}
          </div>
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex min-h-[240px] flex-col items-center justify-center text-center">
          <Search className="mb-3 h-7 w-7 text-muted-foreground" /><h2 className="font-semibold">No projects match</h2>
          <Button variant="link" onClick={() => { setSearch(''); setHealth('all'); }}>Clear filters</Button>
        </CardContent></Card>
      ) : (
        <div className={cn(view === 'split' && !isMobile && 'grid grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)] gap-4')}>
          {(view === 'list' || (view === 'split' && !isMobile)) && (
            <div className={cn('space-y-3', view === 'split' && 'max-h-[620px] overflow-y-auto pr-1')}>
              {filtered.map((project) => (
                <ProjectCard key={project.project_id} project={project} busy={busy} onOpen={() => setSelected(project)} onAction={() => runPrimaryAction(project)} />
              ))}
            </div>
          )}
          {(view === 'map' || (view === 'split' && !isMobile)) && (
            <PortfolioMap projects={filtered} selectedId={selected?.project_id ?? null} onSelect={setSelected} />
          )}
        </div>
      )}

      <ProjectDetail project={selected} onClose={() => setSelected(null)} onAction={runPrimaryAction} busy={busy} onRefresh={refresh} />
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} organizationIds={access.organizations.filter((item) => item.role === 'owner' || item.role === 'admin').map((item) => item.organization_id)} onCreated={refresh} />
      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} project={selected} onCreated={refresh} />
      <PublishUpdateDialog open={updateOpen} onOpenChange={setUpdateOpen} project={selected} onCreated={refresh} />
      <PMPortfolioStudio open={portfolioStudioOpen} onOpenChange={setPortfolioStudioOpen} projects={projects} />
    </div>
  );
};

const ProjectCard = ({ project, onOpen, onAction, busy }: { project: PortfolioProject; onOpen: () => void; onAction: () => void; busy: boolean }) => (
  <Card className="transition hover:border-primary/30 hover:shadow-sm"><CardContent className="p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <button type="button" onClick={onOpen} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-semibold">{project.project_name}</h2><Badge className={healthClasses[project.health]} variant="outline">{healthLabels[project.health]}</Badge></div>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{project.address}, {project.city}, {project.state} {project.postal_code}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span><span className="text-muted-foreground">Stage </span>{pretty(project.stage)}</span>
          <span><span className="text-muted-foreground">Target </span>{shortDate(project.target_completion_date)}</span>
          {project.commitment_amount != null && <span><span className="text-muted-foreground">Commitment </span>{money.format(project.commitment_amount)}</span>}
          {project.can_manage && <span><span className="text-muted-foreground">Budget remaining </span>{money.format(project.budget_variance)}</span>}
        </div>
      </button>
      <Button size="sm" variant={project.health === 'at_risk' ? 'default' : 'outline'} onClick={onAction} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{project.next_action_label}</Button>
    </div>
  </CardContent></Card>
);

const ProjectDetail = ({ project, onClose, onAction, busy, onRefresh }: { project: PortfolioProject | null; onClose: () => void; onAction: (project: PortfolioProject) => void; busy: boolean; onRefresh: () => Promise<void> }) => {
  const { user } = useAuth();
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const updates = useQuery({
    queryKey: ['project-updates', project?.project_id],
    enabled: !!project,
    queryFn: async () => {
      const result = await database.from('project_updates').select('id, title, body, visibility, published_at, created_at').eq('project_id', project!.project_id).order('published_at', { ascending: false }).limit(10);
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as ProjectUpdate[];
    },
  });
  const milestones = useQuery({
    queryKey: ['project-milestones', project?.project_id], enabled: !!project,
    queryFn: async () => {
      const result = await database.from('project_milestones').select('id, title, description, due_date, status, completed_at, visibility').eq('project_id', project!.project_id).order('due_date', { ascending: true });
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as ProjectMilestone[];
    },
  });
  const documents = useQuery({
    queryKey: ['project-documents', project?.project_id], enabled: !!project,
    queryFn: async () => {
      const result = await database.from('project_documents').select('id, name, document_type, storage_path, visibility, created_at').eq('project_id', project!.project_id).order('created_at', { ascending: false }).limit(25);
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as ProjectDocument[];
    },
  });
  const requests = useQuery({
    queryKey: ['project-requests', project?.project_id], enabled: !!project,
    queryFn: async () => {
      const result = await database.from('project_requests').select('id, request_type, title, description, status, priority, requested_by, assigned_to, resolution_note, resolved_at, created_at, updated_at').eq('project_id', project!.project_id).order('created_at', { ascending: false }).limit(50);
      if (result.error) throw new Error(result.error.message);
      return (result.data ?? []) as ProjectRequest[];
    },
  });
  const completeMilestone = async (milestone: ProjectMilestone) => {
    if (!project) return;
    const result = await database.from('project_milestones').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', milestone.id).eq('project_id', project.project_id);
    if (result.error) { toast({ title: 'Milestone was not updated', description: result.error.message, variant: 'destructive' }); return; }
    track('portfolio_action_completed', { action: 'complete_milestone', project_id: project.project_id });
    toast({ title: 'Milestone completed', description: milestone.title });
    await Promise.all([milestones.refetch(), onRefresh()]);
  };
  const updateRequestStatus = async (request: ProjectRequest, status: ProjectRequest['status']) => {
    const closed = ['approved', 'declined', 'resolved'].includes(status);
    const result = await database.from('project_requests').update({ status, resolved_at: closed ? new Date().toISOString() : null }).eq('id', request.id).eq('project_id', project!.project_id);
    if (result.error) { toast({ title: 'Request was not updated', description: result.error.message, variant: 'destructive' }); return; }
    toast({ title: 'Request updated', description: `${request.title} is now ${pretty(status).toLowerCase()}.` });
    await requests.refetch();
  };
  const openDocument = async (document: ProjectDocument) => {
    const result = await supabase.storage.from('project-documents').createSignedUrl(document.storage_path, 60);
    if (result.error) { toast({ title: 'Document could not be opened', description: result.error.message, variant: 'destructive' }); return; }
    window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer');
  };
  return <Sheet open={!!project} onOpenChange={(open) => { if (!open) onClose(); }}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">
    {project && <>
      <SheetHeader><SheetTitle>{project.project_name}</SheetTitle><SheetDescription>{project.address}, {project.city}, {project.state} {project.postal_code}</SheetDescription></SheetHeader>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Metric icon={CircleDollarSign} label="Approved budget" value={money.format(project.approved_budget)} />
        <Metric icon={WalletCards} label={project.can_manage ? 'Paid to date' : 'Contributed'} value={money.format(project.can_manage ? project.paid_amount : (project.contributed_amount ?? 0))} />
        <Metric icon={CalendarClock} label="Target completion" value={shortDate(project.target_completion_date)} />
        <Metric icon={Users} label="Your access" value={pretty(project.access_role)} />
      </div>
      <Button className="mt-5 w-full" onClick={() => onAction(project)} disabled={busy}>{project.next_action_label}</Button>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {project.can_manage && <Button variant="outline" onClick={() => setMilestoneOpen(true)}><CalendarClock className="mr-2 h-4 w-4" />Add milestone</Button>}
        {project.can_manage && <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="mr-2 h-4 w-4" />Upload file</Button>}
        {!project.can_manage && <Button className="col-span-2" variant="outline" onClick={() => setRequestOpen(true)}><ClipboardPlus className="mr-2 h-4 w-4" />Ask or request a change</Button>}
      </div>
      <Tabs key={project.project_id} defaultValue={project.can_manage ? 'schedule' : 'updates'} className="mt-7">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4"><TabsTrigger value="schedule">Schedule</TabsTrigger><TabsTrigger value="updates">Updates</TabsTrigger><TabsTrigger value="documents">Documents</TabsTrigger><TabsTrigger value="requests">Requests{requests.data?.filter((item) => item.status === 'open' || item.status === 'in_review').length ? ` (${requests.data.filter((item) => item.status === 'open' || item.status === 'in_review').length})` : ''}</TabsTrigger></TabsList>
        <TabsContent value="schedule" id="project-milestones-panel" className="mt-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Milestones</h3><Badge variant="secondary">{milestones.data?.filter((item) => item.status === 'completed').length ?? 0}/{milestones.data?.length ?? 0} complete</Badge></div>
          {milestones.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : milestones.error ? <InlineError message={milestones.error.message} onRetry={() => milestones.refetch()} /> : milestones.data?.length ? <div className="space-y-3">{milestones.data.map((milestone) => <article key={milestone.id} className={cn('rounded-xl border p-4', milestone.status === 'completed' && 'bg-muted/30')}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">{milestone.title}</h4><Badge variant="outline">{pretty(milestone.status)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{milestone.due_date ? `Due ${shortDate(milestone.due_date)}` : 'No due date'} · {pretty(milestone.visibility)}</p></div>{project.can_manage && milestone.status !== 'completed' && <Button size="sm" variant="outline" onClick={() => completeMilestone(milestone)}><CheckCircle2 className="mr-2 h-4 w-4" />Complete</Button>}</div>{milestone.description && <p className="mt-3 text-sm text-muted-foreground">{milestone.description}</p>}</article>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No milestones are visible yet. {project.can_manage ? 'Publish an update while the schedule is being prepared.' : 'Your project team will share the schedule here.'}</p>}
        </TabsContent>
        <TabsContent value="updates" id="project-updates-panel" className="mt-4"><h3 className="mb-3 font-semibold">Project updates</h3>
          {updates.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : updates.error ? <InlineError message={updates.error.message} onRetry={() => updates.refetch()} /> : updates.data?.length ? <div className="space-y-3">{updates.data.map((update) => <article key={update.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><h4 className="font-medium">{update.title}</h4><Badge variant="outline">{pretty(update.visibility)}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{update.body}</p><p className="mt-3 text-xs text-muted-foreground">{new Date(update.published_at ?? update.created_at).toLocaleString()}</p></article>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No visible updates yet.</p>}
        </TabsContent>
        <TabsContent value="documents" className="mt-4"><h3 className="mb-3 font-semibold">Shared documents</h3>
          {documents.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : documents.error ? <InlineError message={documents.error.message} onRetry={() => documents.refetch()} /> : documents.data?.length ? <div className="space-y-2">{documents.data.map((document) => <button type="button" onClick={() => openDocument(document)} key={document.id} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition hover:border-primary/40"><FileText className="h-5 w-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{document.name}</p><p className="text-xs text-muted-foreground">{pretty(document.document_type)} · {new Date(document.created_at).toLocaleDateString()}</p></div><Badge variant="outline">{pretty(document.visibility)}</Badge><Download className="h-4 w-4 text-muted-foreground" /></button>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No documents have been shared with your role yet.</p>}
        </TabsContent>
        <TabsContent value="requests" className="mt-4"><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Questions and requests</h3>{!project.can_manage && <Button size="sm" onClick={() => setRequestOpen(true)}><Plus className="mr-2 h-4 w-4" />New</Button>}</div>
          {requests.isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : requests.error ? <InlineError message={requests.error.message} onRetry={() => requests.refetch()} /> : requests.data?.length ? <div className="space-y-3">{requests.data.map((request) => <article key={request.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><Badge variant="outline">{pretty(request.request_type)}</Badge>{request.priority !== 'normal' && <Badge variant={request.priority === 'urgent' ? 'destructive' : 'secondary'}>{pretty(request.priority)}</Badge>}</div><h4 className="mt-2 font-medium">{request.title}</h4></div><Badge variant={request.status === 'open' ? 'default' : 'secondary'}>{pretty(request.status)}</Badge></div><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{request.description}</p>{request.resolution_note && <p className="mt-3 rounded-lg bg-muted p-3 text-sm"><span className="font-medium">Resolution: </span>{request.resolution_note}</p>}{project.can_manage && <div className="mt-4 flex flex-wrap gap-2">{request.status === 'open' && <Button size="sm" variant="outline" onClick={() => updateRequestStatus(request, 'in_review')}>Start review</Button>}{!['approved','declined','resolved'].includes(request.status) && <><Button size="sm" onClick={() => updateRequestStatus(request, request.request_type === 'approval' ? 'approved' : 'resolved')}>{request.request_type === 'approval' ? 'Approve' : 'Resolve'}</Button>{request.request_type === 'approval' && <Button size="sm" variant="outline" onClick={() => updateRequestStatus(request, 'declined')}>Decline</Button>}</>}</div>}</article>)}</div> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No questions or requests yet. This is the shared decision log for the project.</p>}
        </TabsContent>
      </Tabs>
      <MilestoneDialog open={milestoneOpen} onOpenChange={setMilestoneOpen} project={project} userId={user?.id ?? ''} onCreated={async () => { await milestones.refetch(); await onRefresh(); }} />
      <DocumentUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} project={project} userId={user?.id ?? ''} onCreated={() => documents.refetch()} />
      <ProjectRequestDialog open={requestOpen} onOpenChange={setRequestOpen} project={project} userId={user?.id ?? ''} onCreated={() => requests.refetch()} />
    </>}
  </SheetContent></Sheet>;
};

const Metric = ({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) => <div className="rounded-xl border bg-muted/20 p-3"><Icon className="mb-2 h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-semibold">{value}</p></div>;
const InlineError = ({ message, onRetry }: { message: string; onRetry: () => void }) => <div className="rounded-xl border border-destructive/30 p-4 text-sm"><p className="text-destructive">{message}</p><Button className="mt-3" size="sm" variant="outline" onClick={onRetry}>Try again</Button></div>;

const MilestoneDialog = ({ open, onOpenChange, project, userId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; project: PortfolioProject; userId: string; onCreated: () => Promise<unknown> }) => {
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [dueDate, setDueDate] = useState(''); const [visibility, setVisibility] = useState('all_members');
  useEffect(() => { if (open) { setTitle(''); setDescription(''); setDueDate(''); setVisibility('all_members'); } }, [open]);
  const submit = async () => {
    if (!title.trim() || !userId) return;
    setBusy(true);
    const result = await database.from('project_milestones').insert({ organization_id: project.organization_id, project_id: project.project_id, title: title.trim(), description: description.trim() || null, due_date: dueDate || null, status: 'planned', visibility, created_by: userId });
    setBusy(false);
    if (result.error) { toast({ title: 'Milestone was not created', description: result.error.message, variant: 'destructive' }); return; }
    track('portfolio_action_completed', { action: 'create_milestone', project_id: project.project_id });
    toast({ title: 'Milestone added', description: title.trim() }); onOpenChange(false); await onCreated();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add milestone</DialogTitle><DialogDescription>Define one clear outcome. Audience controls keep internal work private.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Milestone *"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Final inspection complete" /></Field><Field label="Description"><Textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Success criteria, dependencies, or context" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Due date"><Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field><Field label="Visible to"><AudienceSelect value={visibility} onChange={setVisibility} /></Field></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={busy || !title.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add milestone</Button></DialogFooter></DialogContent></Dialog>;
};

const DocumentUploadDialog = ({ open, onOpenChange, project, userId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; project: PortfolioProject; userId: string; onCreated: () => Promise<unknown> }) => {
  const [busy, setBusy] = useState(false); const [file, setFile] = useState<File | null>(null); const [documentType, setDocumentType] = useState('project_file'); const [visibility, setVisibility] = useState('all_members');
  useEffect(() => { if (open) { setFile(null); setDocumentType('project_file'); setVisibility('all_members'); } }, [open]);
  const submit = async () => {
    if (!file || !userId) return;
    const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'document';
    const storagePath = `${project.organization_id}/${project.project_id}/${crypto.randomUUID()}-${safeName}`;
    setBusy(true);
    const upload = await supabase.storage.from('project-documents').upload(storagePath, file, { contentType: file.type || undefined, upsert: false });
    if (upload.error) { setBusy(false); toast({ title: 'Upload failed', description: upload.error.message, variant: 'destructive' }); return; }
    const metadata = await database.from('project_documents').insert({ organization_id: project.organization_id, project_id: project.project_id, name: file.name, document_type: documentType, storage_path: storagePath, visibility, uploaded_by: userId });
    if (metadata.error) {
      await supabase.storage.from('project-documents').remove([storagePath]); setBusy(false);
      toast({ title: 'Document was not saved', description: metadata.error.message, variant: 'destructive' }); return;
    }
    setBusy(false); track('portfolio_action_completed', { action: 'upload_document', project_id: project.project_id, visibility });
    toast({ title: 'Document shared', description: `${file.name} is available to ${pretty(visibility).toLowerCase()}.` }); onOpenChange(false); await onCreated();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Upload project document</DialogTitle><DialogDescription>Files are private and available only to the audience you select.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="File *"><Input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Document type"><Select value={documentType} onValueChange={setDocumentType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['project_file','contract','invoice','drawing','permit','report','photo'].map((value) => <SelectItem key={value} value={value}>{pretty(value)}</SelectItem>)}</SelectContent></Select></Field><Field label="Visible to"><AudienceSelect value={visibility} onChange={setVisibility} /></Field></div><p className="text-xs text-muted-foreground">PDF, image, Office, text, or CSV files up to 25 MB.</p></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={busy || !file}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Upload and share</Button></DialogFooter></DialogContent></Dialog>;
};

const ProjectRequestDialog = ({ open, onOpenChange, project, userId, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; project: PortfolioProject; userId: string; onCreated: () => Promise<unknown> }) => {
  const [busy, setBusy] = useState(false); const [type, setType] = useState<ProjectRequest['request_type']>('question'); const [priority, setPriority] = useState<ProjectRequest['priority']>('normal'); const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  useEffect(() => { if (open) { setType('question'); setPriority('normal'); setTitle(''); setDescription(''); } }, [open]);
  const submit = async () => {
    if (!title.trim() || !description.trim() || !userId) return;
    setBusy(true);
    const result = await database.from('project_requests').insert({ organization_id: project.organization_id, project_id: project.project_id, request_type: type, title: title.trim(), description: description.trim(), priority, requested_by: userId });
    setBusy(false);
    if (result.error) { toast({ title: 'Request was not sent', description: result.error.message, variant: 'destructive' }); return; }
    track('portfolio_action_completed', { action: 'create_project_request', project_id: project.project_id, request_type: type, priority }); toast({ title: 'Request sent', description: 'Your project team can now review and respond.' }); onOpenChange(false); await onCreated();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Ask or request a change</DialogTitle><DialogDescription>Keep questions and decisions attached to the project instead of losing them in email.</DialogDescription></DialogHeader><div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Request type"><Select value={type} onValueChange={(value) => setType(value as ProjectRequest['request_type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="question">Question</SelectItem><SelectItem value="change_request">Change request</SelectItem><SelectItem value="approval">Approval needed</SelectItem><SelectItem value="document_request">Document request</SelectItem></SelectContent></Select></Field><Field label="Priority"><Select value={priority} onValueChange={(value) => setPriority(value as ProjectRequest['priority'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></Field></div><Field label="Subject *"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Confirm kitchen finish selection" /></Field><Field label="Details *"><Textarea rows={6} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the decision, question, or requested outcome." /></Field></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={busy || !title.trim() || !description.trim()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send request</Button></DialogFooter></DialogContent></Dialog>;
};

const AudienceSelect = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all_members">All project members</SelectItem><SelectItem value="client">Investor partners · project access</SelectItem><SelectItem value="investor">Investor partners · capital access</SelectItem><SelectItem value="internal">Internal team only</SelectItem></SelectContent></Select>;

const CreateProjectDialog = ({ open, onOpenChange, organizationIds, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; organizationIds: string[]; onCreated: () => Promise<void> }) => {
  const [busy, setBusy] = useState(false);
  const [organizationId, setOrganizationId] = useState(organizationIds[0] ?? '');
  const [form, setForm] = useState({ project_name: '', property_name: '', address_line1: '', city: '', state: '', postal_code: '', project_stage: 'acquisition', start_date: '', target_completion_date: '', approved_budget: '', latitude: '', longitude: '' });
  useEffect(() => { if (!organizationId && organizationIds[0]) setOrganizationId(organizationIds[0]); }, [organizationId, organizationIds]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    if (!organizationId || !form.project_name.trim() || !form.address_line1.trim() || !form.city.trim() || !form.state.trim() || !form.postal_code.trim()) {
      toast({ title: 'Complete the required fields', description: 'Project name and full property address are required.', variant: 'destructive' }); return;
    }
    setBusy(true);
    const result = await database.rpc('create_portfolio_project', { target_organization: organizationId, ...form, approved_budget: Number(form.approved_budget || 0), latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null, start_date: form.start_date || null, target_completion_date: form.target_completion_date || null });
    setBusy(false);
    if (result.error) { toast({ title: 'Project was not created', description: result.error.message, variant: 'destructive' }); return; }
    track('portfolio_action_completed', { action: 'create_project', project_id: String(result.data) });
    toast({ title: 'Project created', description: 'It is ready for assignments, milestones, and updates.' });
    onOpenChange(false); await onCreated();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Add a portfolio project</DialogTitle><DialogDescription>The property and project are created together so the operating record is complete.</DialogDescription></DialogHeader>
    <div className="grid gap-4 py-2 sm:grid-cols-2">
      {organizationIds.length > 1 && <Field label="Workspace"><Select value={organizationId} onValueChange={setOrganizationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{organizationIds.map((id, index) => <SelectItem key={id} value={id}>Workspace {index + 1}</SelectItem>)}</SelectContent></Select></Field>}
      <Field label="Project name *"><Input value={form.project_name} onChange={(e) => update('project_name', e.target.value)} /></Field>
      <Field label="Property name"><Input value={form.property_name} onChange={(e) => update('property_name', e.target.value)} /></Field>
      <Field label="Street address *" wide><Input value={form.address_line1} onChange={(e) => update('address_line1', e.target.value)} /></Field>
      <Field label="City *"><Input value={form.city} onChange={(e) => update('city', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="State *"><Input maxLength={3} value={form.state} onChange={(e) => update('state', e.target.value)} /></Field><Field label="ZIP *"><Input value={form.postal_code} onChange={(e) => update('postal_code', e.target.value)} /></Field></div>
      <Field label="Stage"><Select value={form.project_stage} onValueChange={(value) => update('project_stage', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['acquisition','development','construction','stabilization','management'].map((stage) => <SelectItem key={stage} value={stage}>{pretty(stage)}</SelectItem>)}</SelectContent></Select></Field>
      <Field label="Approved budget"><Input type="number" min="0" value={form.approved_budget} onChange={(e) => update('approved_budget', e.target.value)} /></Field>
      <Field label="Start date"><Input type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} /></Field>
      <Field label="Target completion"><Input type="date" value={form.target_completion_date} onChange={(e) => update('target_completion_date', e.target.value)} /></Field>
      <Field label="Latitude"><Input type="number" min="-90" max="90" step="any" value={form.latitude} onChange={(e) => update('latitude', e.target.value)} /></Field>
      <Field label="Longitude"><Input type="number" min="-180" max="180" step="any" value={form.longitude} onChange={(e) => update('longitude', e.target.value)} /></Field>
    </div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create project</Button></DialogFooter>
  </DialogContent></Dialog>;
};

const InviteDialog = ({ open, onOpenChange, project, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; project: PortfolioProject | null; onCreated: () => Promise<void> }) => {
  const [email, setEmail] = useState(''); const [role, setRole] = useState('project_manager'); const [busy, setBusy] = useState(false); const [link, setLink] = useState(''); const [emailSent, setEmailSent] = useState(false);
  const submit = async () => { if (!project || !email.trim()) return; setBusy(true); const result = await database.rpc('create_project_invitation', { target_project: project.project_id, invite_email: email.trim(), invite_role: role }); if (result.error) { setBusy(false); toast({ title: 'Invitation was not created', description: result.error.message, variant: 'destructive' }); return; } const rows = result.data as Array<{ invitation_token: string }>; const token = rows[0].invitation_token; const invitationLink = `${window.location.origin}/invite/${token}`; setLink(invitationLink); track('project_invitation_created', { project_id: project.project_id, role }); const delivery = await supabase.functions.invoke('send-project-invitation', { body: { invitationToken: token } }); setBusy(false); if (delivery.error) { setEmailSent(false); toast({ title: 'Invitation created—copy the link to deliver it', description: delivery.error.message, variant: 'destructive' }); } else { setEmailSent(true); toast({ title: 'Invitation email sent', description: `Secure ${pretty(role)} access was sent to ${email.trim()}.` }); } await onCreated(); };
  const copy = async () => { await navigator.clipboard.writeText(link); toast({ title: 'Invitation link copied' }); };
  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { setLink(''); setEmailSent(false); } }}><DialogContent><DialogHeader><DialogTitle>Invite to {project?.project_name}</DialogTitle><DialogDescription>Access is scoped to this project and bound to the invited email address.</DialogDescription></DialogHeader>{link ? <div className="space-y-3"><div className={cn('rounded-xl border p-3 text-sm', emailSent ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>{emailSent ? `Invitation email sent to ${email}.` : 'Email delivery was unavailable. Copy and send the secure link below.'}</div><Label>Secure invitation link</Label><div className="flex gap-2"><Input readOnly value={link} /><Button onClick={copy} size="icon"><Copy className="h-4 w-4" /></Button></div><p className="text-xs text-muted-foreground">This link expires in seven days and can only be accepted by {email}.</p></div> : <div className="space-y-4"><Field label="Email address"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field><Field label="Access profile"><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project_manager">Project manager · operating access</SelectItem><SelectItem value="investor">Investor partner · capital access</SelectItem><SelectItem value="client">Investor partner · project access</SelectItem><SelectItem value="viewer">Advisor · view only</SelectItem></SelectContent></Select></Field><p className="text-xs text-muted-foreground">Investor partners use one project-access identity. Choose the information scope that matches the relationship.</p></div>}<DialogFooter>{!link && <Button onClick={submit} disabled={busy || !email.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Create and send invitation</Button>}</DialogFooter></DialogContent></Dialog>;
};

const PublishUpdateDialog = ({ open, onOpenChange, project, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; project: PortfolioProject | null; onCreated: () => Promise<void> }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [visibility, setVisibility] = useState('all_members'); const [busy, setBusy] = useState(false);
  const submit = async () => { if (!project || !title.trim() || !body.trim()) return; setBusy(true); const result = await database.from('project_updates').insert({ organization_id: project.organization_id, project_id: project.project_id, title: title.trim(), body: body.trim(), visibility, status: 'published', published_at: new Date().toISOString(), created_by: user?.id }); setBusy(false); if (result.error) { toast({ title: 'Update was not published', description: result.error.message, variant: 'destructive' }); return; } track('portfolio_action_completed', { action: 'publish_update', project_id: project.project_id, visibility }); toast({ title: 'Project update published' }); setTitle(''); setBody(''); onOpenChange(false); await onCreated(); };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Publish project update</DialogTitle><DialogDescription>Make progress visible to the right project audience.</DialogDescription></DialogHeader><div className="space-y-4"><Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Permits approved" /></Field><Field label="Update"><Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What changed, why it matters, and what happens next?" /></Field><Field label="Visible to"><AudienceSelect value={visibility} onChange={setVisibility} /></Field></div><DialogFooter><Button onClick={submit} disabled={busy || !title.trim() || !body.trim()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquarePlus className="mr-2 h-4 w-4" />}Publish update</Button></DialogFooter></DialogContent></Dialog>;
};

const Field = ({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) => <div className={cn('space-y-2', wide && 'sm:col-span-2')}><Label>{label}</Label>{children}</div>;

export default Portfolio;
