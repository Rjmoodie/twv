import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BellRing, Building2, Calculator, Check, CheckCircle2, CircleDollarSign, FileText, FolderKanban, HardHat, ImageIcon, Info, LogIn, MapPin, MessageSquareText, ShieldCheck, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import AuthDialog from '@/components/app/AuthDialog';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { useAuth } from '@/components/app/AuthProvider';
import { getPreferredPortalPath } from '@/lib/portalRouting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { estimateProjectManagementSavings, SAVINGS_LIMITS } from '@/lib/projectManagementSavings';
import { supabase } from '@/integrations/supabase/client';

const portalFeatures = [
  { icon: FolderKanban, title: 'See the whole asset', description: 'Review every active and completed project connected to your investment relationship.' },
  { icon: BellRing, title: 'Follow execution', description: 'Receive clear milestone, schedule, and status updates from the TW Ventures team.' },
  { icon: FileText, title: 'Keep decisions together', description: 'Access project documents, decisions, and important information in one secure place.' },
  { icon: MessageSquareText, title: 'Plan what comes next', description: 'Begin the conversation for your next acquisition, development, or managed project.' },
];

const comparisonRows = [
  ['Primary role', 'Contracts to deliver the construction scope', 'Represents and coordinates the investor’s project'],
  ['Contractor relationships', 'Typically hires and manages subcontractors', 'Coordinates contractors under the agreed project structure'],
  ['Cost structure', 'Construction cost commonly includes overhead and profit', 'Separate, visible project-management fee'],
  ['Investor visibility', 'Varies by contract and contractor', 'Budget, schedule, decisions, and progress kept visible'],
  ['Permits & inspections', 'Typically managed within the GC’s construction scope', 'Can manage and file applicable permits as the owner’s authorized agent, as scoped'],
  ['Decision control', 'GC manages delivery within its construction contract', 'Investor retains the approvals defined in the engagement'],
  ['Best fit', 'Turnkey responsibility under one construction contract', 'Investors seeking owner-side oversight and cost visibility'],
] as const;

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function SavingsEstimator() {
  const [baseBudget, setBaseBudget] = useState(250_000);
  const [gcMarkupPercent, setGcMarkupPercent] = useState(30);
  const [projectManagementPercent, setProjectManagementPercent] = useState(5);
  const estimate = estimateProjectManagementSavings({ baseBudget, gcMarkupPercent, projectManagementPercent });
  const maxTotal = Math.max(estimate.traditionalGcTotal, estimate.projectManagementTotal, 1);
  const differenceIsPositive = estimate.potentialDifference > 0;

  const numberValue = (value: string, fallback: number) => value.trim() === '' ? fallback : Number(value);

  return <Card className="brand-card overflow-hidden">
    <CardContent className="p-0">
      <div className="grid lg:grid-cols-[.82fr_1.18fr]">
        <div className="bg-[#071a33] p-6 text-white sm:p-8">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><Calculator className="h-5 w-5" /></span><div><p className="font-semibold">Potential cost difference</p><p className="text-xs text-slate-300">Adjust every assumption</p></div></div>
          <div className="mt-7 space-y-5">
            <EstimatorField label="Base trade & material budget" prefix="$" value={baseBudget} min={SAVINGS_LIMITS.budget.min} max={SAVINGS_LIMITS.budget.max} step={5_000} onChange={(value) => setBaseBudget(numberValue(value, SAVINGS_LIMITS.budget.min))} />
            <EstimatorField label="Assumed traditional GC markup" suffix="%" value={gcMarkupPercent} min={SAVINGS_LIMITS.rate.min} max={SAVINGS_LIMITS.rate.max} step={1} onChange={(value) => setGcMarkupPercent(numberValue(value, 0))} />
            <EstimatorField label="Assumed project-management fee" suffix="%" value={projectManagementPercent} min={SAVINGS_LIMITS.rate.min} max={SAVINGS_LIMITS.rate.max} step={1} onChange={(value) => setProjectManagementPercent(numberValue(value, 0))} />
          </div>
          <div className="mt-7 border-t border-white/15 pt-6" aria-live="polite">
            <p className="text-xs font-semibold uppercase tracking-[.2em] text-slate-300">Illustrative difference</p>
            <p className={`mt-2 text-4xl font-semibold ${differenceIsPositive ? 'text-[#dfc48e]' : 'text-white'}`}>{differenceIsPositive ? money.format(estimate.potentialDifference) : money.format(Math.abs(estimate.potentialDifference))}</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">{differenceIsPositive ? `${estimate.potentialDifferencePercent.toFixed(1)}% lower in this example—not a guaranteed saving.` : estimate.potentialDifference < 0 ? 'The project-management assumption is higher in this example.' : 'Both assumptions produce the same estimated total.'}</p>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <h3 className="brand-serif text-2xl text-[#071a33]">Where the estimate comes from</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">The same base construction budget is used for both models. Only the selected delivery cost changes.</p>
          <div className="mt-7 space-y-7">
            <CostBar label="Traditional GC model" detail={`${money.format(estimate.baseBudget)} base + ${money.format(estimate.gcDeliveryCost)} assumed markup`} total={estimate.traditionalGcTotal} max={maxTotal} tone="bg-slate-500" />
            <CostBar label="Project-management model" detail={`${money.format(estimate.baseBudget)} base + ${money.format(estimate.projectManagementCost)} assumed PM fee`} total={estimate.projectManagementTotal} max={maxTotal} tone="bg-[#9a7b4f]" />
          </div>
          <div className="mt-8 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-950"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>Illustration only, not a quote or promise of savings. Actual bids, insurance, bonds, permits, design, change orders, site conditions, financing, owner responsibilities, and the final contract structure can change either total. A traditional GC may be the better fit when the owner wants a single construction contract and turnkey responsibility.</p></div>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function EstimatorField({ label, prefix, suffix, value, min, max, step, onChange }: { label: string; prefix?: string; suffix?: string; value: number; min: number; max: number; step: number; onChange: (value: string) => void }) {
  return <div><Label className="text-xs text-slate-200">{label}</Label><div className="relative mt-2">{prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{prefix}</span>}<Input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''} min={min} max={max} step={step} onChange={(event) => onChange(event.target.value)} className={`border-white/20 bg-white text-[#071a33] ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`} aria-label={label} />{suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">{suffix}</span>}</div></div>;
}

function CostBar({ label, detail, total, max, tone }: { label: string; detail: string; total: number; max: number; tone: string }) {
  return <div><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold text-[#071a33]">{label}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><p className="shrink-0 font-semibold text-[#071a33]">{money.format(total)}</p></div><div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${money.format(total)}`}><div className={`h-full rounded-full transition-[width] duration-300 ${tone}`} style={{ width: `${Math.max(3, total / max * 100)}%` }} /></div></div>;
}

type FeaturedProject = {
  id: string;
  slug: string;
  title: string;
  project_type: string;
  location_public: string | null;
  summary: string;
  featured_image_url: string;
  article_title: string | null;
  article_excerpt: string | null;
};

function FeaturedProjects() {
  const projects = useQuery({
    queryKey: ['landing-featured-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_portfolio_entries')
        .select('id, slug, title, project_type, location_public, summary, featured_image_url, article_title, article_excerpt')
        .eq('status', 'published')
        .not('featured_image_url', 'is', null)
        .order('published_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as FeaturedProject[];
    },
  });

  const entries = projects.data ?? [];

  return <section id="selected-projects" className="bg-[#071a33] px-5 py-16 text-white sm:px-8 sm:py-24">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="max-w-3xl"><p className="brand-kicker !text-[#dfc48e]">Selected project work</p><h2 className="brand-serif mt-3 text-4xl sm:text-5xl">See the work—not just the promise.</h2><p className="mt-5 max-w-2xl leading-7 text-slate-300">Published project photography and case studies from the TW Ventures team appear here as the portfolio grows.</p></div>
        <Button variant="outline" className="w-fit border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => document.getElementById('model-comparison')?.scrollIntoView({ behavior: 'smooth' })}>How we manage projects</Button>
      </div>

      {entries.length > 0 ? <div className="mt-10 grid gap-5 md:grid-cols-3">
        {entries.map((entry) => <Link key={entry.id} to={`/work/${entry.slug}`} className="group overflow-hidden rounded-lg border border-white/15 bg-white/[.06] transition hover:-translate-y-1 hover:border-[#dfc48e]/60">
          <img src={entry.featured_image_url} alt={`${entry.title} project`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          <div className="p-6"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#dfc48e]">{entry.project_type}</p><h3 className="brand-serif mt-3 text-2xl">{entry.article_title || entry.title}</h3>{entry.location_public && <p className="mt-3 flex items-center gap-2 text-sm text-slate-400"><MapPin className="h-4 w-4" />{entry.location_public}</p>}<p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-300">{entry.article_excerpt || entry.summary}</p><span className="mt-5 inline-flex items-center text-sm font-semibold text-white">View project <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" /></span></div>
        </Link>)}
      </div> : <div className="mt-10 grid gap-5 md:grid-cols-[1.35fr_.65fr]">
        <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/25 bg-gradient-to-br from-white/[.08] to-transparent p-8 text-center"><div><ImageIcon className="mx-auto h-9 w-9 text-[#dfc48e]" /><p className="brand-serif mt-5 text-2xl">Project photography is ready to publish here.</p><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300">Only real, approved portfolio images will be shown—never generic stock work presented as a TW Ventures project.</p></div></div>
        <div className="grid min-h-72 place-items-center rounded-lg border border-white/15 bg-white/[.05] p-8"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#dfc48e]">Portfolio-ready</p><p className="brand-serif mt-4 text-3xl">Photos, project facts, and the delivery story in one place.</p></div></div>
      </div>}
      {projects.isError && <p className="mt-4 text-sm text-slate-400">Published projects are temporarily unavailable. The rest of the site remains available.</p>}
    </div>
  </section>;
}

export default function ClientOnboardingPage() {
  const { user, access, accessLoading } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [routeAfterAuth, setRouteAfterAuth] = useState(false);

  useEffect(() => {
    if (!routeAfterAuth || !user || accessLoading) return;
    setRouteAfterAuth(false);
    navigate(getPreferredPortalPath(access.personas));
  }, [access.personas, accessLoading, navigate, routeAfterAuth, user]);

  const enterPortal = () => {
    if (user) {
      if (!accessLoading) navigate(getPreferredPortalPath(access.personas));
      return;
    }
    setAuthOpen(true);
  };

  return (
    <main className="public-page">
      <PublicBrandHeader section="Investor Project Management" actions={<><Button aria-label="How it differs" variant="ghost" className="gap-2 text-[#071a33]" onClick={() => document.getElementById('model-comparison')?.scrollIntoView({ behavior: 'smooth' })}><HardHat className="h-4 w-4" /><span className="brand-nav-label">How it differs</span></Button><Button aria-label={user ? 'Open portal' : 'Portal sign in'} variant="ghost" className="gap-2 text-[#071a33]" onClick={enterPortal}><LogIn className="h-4 w-4" /><span className="brand-nav-label">{user ? 'Open portal' : 'Portal sign in'}</span></Button></>} />

      <section className="brand-hero px-5 py-20 sm:px-8 sm:py-28">
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="brand-kicker mb-5">Owner-side construction project management</p>
            <h1 className="brand-serif max-w-3xl text-5xl leading-[1.02] sm:text-7xl">Build smarter. Protect your investment.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">Professional renovation and construction project management for real estate investors—built around cost visibility, contractor coordination, and accountable execution rather than a traditional full-service GC structure.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="gap-2 bg-white text-[#071a33] hover:bg-slate-100" onClick={() => user ? enterPortal() : navigate('/get-started')}>
                {user ? 'View my projects' : 'Get a project consultation'} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                <button type="button" onClick={() => document.getElementById('savings-estimator')?.scrollIntoView({ behavior: 'smooth' })}>Estimate potential difference</button>
              </Button>
            </div>
            <div className="mt-5 flex flex-col items-start gap-2 text-sm text-slate-400 sm:flex-row sm:items-center"><span>Already connected? Use the email on your invitation.</span><button type="button" className="font-semibold text-white underline underline-offset-4" onClick={() => navigate('/pm')}>Project Manager sign in</button></div>
          </div>

          <Card className="brand-card-dark text-white">
            <CardContent className="p-7 sm:p-9">
              <div className="mb-7 flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#071a33]"><Building2 className="h-6 w-6" /></span>
                <div><p className="font-semibold">Your project-management team</p><p className="text-sm text-slate-300">Owner-side coordination with clearly defined responsibilities</p></div>
              </div>
              <ol className="space-y-5">
                {['Define the scope, budget, schedule, and decision rights', 'Manage and file applicable permits; coordinate inspections as agreed', 'Track bids, changes, milestones, and project risks', 'Keep the investor informed through closeout'].map((step, index) => (
                  <li key={step} className="flex gap-4">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-blue-300/40 bg-blue-300/10 text-xs font-semibold text-blue-100">{index + 1}</span>
                    <span className="pt-0.5 text-sm leading-6 text-slate-200">{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </section>

      <FeaturedProjects />

      <section id="model-comparison" className="scroll-mt-24 bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center"><p className="brand-kicker !text-[#9a7b4f]">Two different delivery models</p><h2 className="brand-serif mt-3 text-4xl text-[#071a33] sm:text-5xl">A project manager is not simply a lower-cost general contractor.</h2><p className="mt-5 text-base leading-7 text-slate-600">A traditional GC contracts to deliver construction. TW Ventures’ project-management model is designed to represent and coordinate the investor’s project. The final agreement defines who contracts with trades, carries each responsibility, and makes approvals.</p></div>
          <div className="mt-12 overflow-hidden rounded-lg border border-slate-200" role="table" aria-label="Traditional general contractor and project management comparison">
            <div className="hidden grid-cols-[.65fr_1fr_1fr] bg-[#071a33] text-white md:grid" role="row"><div className="p-5 text-xs font-semibold uppercase tracking-wider" role="columnheader">Project question</div><div className="border-l border-white/15 p-5" role="columnheader"><HardHat className="mb-2 h-5 w-5 text-slate-300" /><span className="font-semibold">Traditional general contractor</span></div><div className="border-l border-white/15 bg-white/5 p-5" role="columnheader"><Users className="mb-2 h-5 w-5 text-[#dfc48e]" /><span className="font-semibold">TW Ventures project management</span></div></div>
            {comparisonRows.map(([label, gc, pm]) => <div key={label} className="grid border-t border-slate-200 first:border-t-0 md:grid-cols-[.65fr_1fr_1fr]" role="row"><div className="bg-slate-50 p-4 text-sm font-semibold text-[#071a33] md:p-5" role="rowheader">{label}</div><div className="p-4 text-sm leading-6 text-slate-600 md:border-l md:p-5" role="cell"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400 md:hidden">Traditional GC</span>{gc}</div><div className="border-t border-slate-100 bg-[#faf8f3] p-4 text-sm leading-6 text-[#071a33] md:border-l md:border-t-0 md:p-5" role="cell"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#9a7b4f] md:hidden">TW Ventures PM model</span><Check className="mr-2 inline h-4 w-4 text-[#9a7b4f]" />{pm}</div></div>)}
          </div>
          <div className="mt-6 flex gap-4 rounded-lg border border-[#9a7b4f]/30 bg-[#faf8f3] p-6"><ShieldCheck className="mt-1 h-6 w-6 shrink-0 text-[#9a7b4f]" /><div><h3 className="font-semibold text-[#071a33]">Can TW Ventures pull permits?</h3><p className="mt-2 text-sm leading-6 text-slate-600">Yes—when included in the engagement, TW Ventures can manage and file applicable permit applications as the owner’s authorized agent. Some applications and regulated work must involve a licensed contractor, design professional, or expediter; TW Ventures coordinates those parties and requirements without claiming credentials it does not hold.</p></div></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3"><ValuePoint icon={CircleDollarSign} title="Cost visibility" copy="See the assumptions, approved changes, and project-management fee." /><ValuePoint icon={FolderKanban} title="Investor control" copy="Keep the approvals and visibility defined in your engagement." /><ValuePoint icon={BellRing} title="Accountable reporting" copy="Follow schedule, decisions, risks, documents, and progress." /></div>
        </div>
      </section>

      <section id="savings-estimator" className="scroll-mt-24 bg-[#f3f0e9] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-6xl"><div className="mb-10 max-w-3xl"><p className="brand-kicker !text-[#9a7b4f]">Explore the cost structure</p><h2 className="brand-serif mt-3 text-4xl text-[#071a33] sm:text-5xl">Model a potential difference—using your assumptions.</h2><p className="mt-5 leading-7 text-slate-600">This itemized illustration helps investors compare delivery fees on the same starting construction budget. It does not assume every project, bid, responsibility, or risk is identical.</p></div><SavingsEstimator /></div>
      </section>

      <section className="bg-[#f3f0e9] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="brand-kicker !text-[#9a7b4f]">Built around the asset</p><h2 className="brand-serif mt-3 text-4xl sm:text-5xl">Professional oversight from planning through closeout.</h2><div className="brand-rule mt-6 w-36" /></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {portalFeatures.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="brand-card"><CardContent className="p-6"><Icon className="h-6 w-6 text-[#9a7b4f]" /><h3 className="brand-serif mt-5 text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></CardContent></Card>
            ))}
          </div>
          <div className="brand-card mt-12 flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center sm:p-9">
            <div className="flex gap-4"><CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-[#9a7b4f]" /><div><h2 className="brand-serif text-2xl">Already working with TW Ventures?</h2><p className="mt-1 text-sm text-slate-600">Use the portal assigned to your role. Project Managers should open the dedicated PM sign-in.</p></div></div>
            <div className="flex flex-wrap gap-3"><Button variant="outline" className="shrink-0" onClick={enterPortal}>{user ? 'Open my portal' : 'Investor / client sign in'}</Button><Button className="shrink-0 gap-2" onClick={() => navigate('/pm')}>Project Manager sign in <ArrowRight className="h-4 w-4" /></Button></div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">Ready to discuss a project? <button className="font-medium text-[#071a33] underline underline-offset-4" onClick={() => navigate('/get-started')}>Tell us what you need</button></footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthSuccess={() => { setAuthOpen(false); setRouteAfterAuth(true); }} message="Use the email connected to your TW Ventures invitation. After sign-in, we will open the portal assigned to your account." />
    </main>
  );
}

function ValuePoint({ icon: Icon, title, copy }: { icon: typeof Building2; title: string; copy: string }) {
  return <div className="brand-card p-5"><Icon className="h-5 w-5 text-[#9a7b4f]" /><h3 className="mt-4 font-semibold text-[#071a33]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></div>;
}
