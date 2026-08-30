import { useState } from 'react';
import { ArrowRight, BellRing, Building2, CheckCircle2, FileText, FolderKanban, LogIn, MessageSquareText, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthDialog from '@/components/app/AuthDialog';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { useAuth } from '@/components/app/AuthProvider';
import { getPreferredPortalPath } from '@/lib/portalRouting';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const portalFeatures = [
  { icon: FolderKanban, title: 'See the whole asset', description: 'Review every active and completed project connected to your investment relationship.' },
  { icon: BellRing, title: 'Follow execution', description: 'Receive clear milestone, schedule, and status updates from the TW Ventures team.' },
  { icon: FileText, title: 'Keep decisions together', description: 'Access project documents, decisions, and important information in one secure place.' },
  { icon: MessageSquareText, title: 'Plan what comes next', description: 'Begin the conversation for your next acquisition, development, or managed project.' },
];

export default function ClientOnboardingPage() {
  const { user, access, accessLoading } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  const enterPortal = () => {
    if (user) {
      if (!accessLoading) navigate(getPreferredPortalPath(access.personas));
      return;
    }
    setAuthOpen(true);
  };

  return (
    <main className="public-page">
      <PublicBrandHeader section="Investor Partnerships" actions={<><Button variant="ghost" className="gap-2 text-[#071a33]" onClick={() => navigate('/investors')}><TrendingUp className="h-4 w-4" /><span className="brand-nav-label">Our approach</span></Button><Button variant="ghost" className="gap-2 text-[#071a33]" onClick={enterPortal}><LogIn className="h-4 w-4" /><span className="brand-nav-label">{user ? 'Open portal' : 'Project access'}</span></Button></>} />

      <section className="brand-hero px-5 py-20 sm:px-8 sm:py-28">
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="brand-kicker mb-5">Acquire · Build · Manage</p>
            <h1 className="brand-serif max-w-3xl text-5xl leading-[1.02] sm:text-7xl">Real estate, managed with clarity.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">From first conversation through final delivery, TW Ventures gives investor partners one accountable team and one clear view of every project.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="gap-2 bg-white text-[#071a33] hover:bg-slate-100" onClick={enterPortal}>
                {user ? 'View my projects' : 'Access your projects'} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                <button type="button" onClick={() => navigate('/get-started')}>Start a new project</button>
              </Button>
            </div>
            <p className="mt-5 text-sm text-slate-400">Already connected to TW Ventures? Use the email address that received your invitation.</p>
          </div>

          <Card className="brand-card-dark text-white">
            <CardContent className="p-7 sm:p-9">
              <div className="mb-7 flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#071a33]"><Building2 className="h-6 w-6" /></span>
                <div><p className="font-semibold">How engagement begins</p><p className="text-sm text-slate-300">A direct line to the people doing the work</p></div>
              </div>
              <ol className="space-y-5">
                {['Tell us about the property and the outcome you need', 'Align scope, responsibilities, and delivery expectations', 'Receive secure access to your active project', 'Follow decisions, milestones, documents, and progress'].map((step, index) => (
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

      <section className="bg-[#f3f0e9] px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="brand-kicker !text-[#9a7b4f]">Built around the asset</p><h2 className="brand-serif mt-3 text-4xl sm:text-5xl">One operating view from acquisition to completion.</h2><div className="brand-rule mt-6 w-36" /></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {portalFeatures.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="brand-card"><CardContent className="p-6"><Icon className="h-6 w-6 text-[#9a7b4f]" /><h3 className="brand-serif mt-5 text-xl">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></CardContent></Card>
            ))}
          </div>
          <div className="brand-card mt-12 flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center sm:p-9">
            <div className="flex gap-4"><CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-[#9a7b4f]" /><div><h2 className="brand-serif text-2xl">Already an investor partner?</h2><p className="mt-1 text-sm text-slate-600">Sign in once to see the projects, updates, and information assigned to your account.</p></div></div>
            <Button className="shrink-0 gap-2" onClick={enterPortal}>{user ? 'Open my portal' : 'Sign in'} <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">Ready to discuss a project? <button className="font-medium text-[#071a33] underline underline-offset-4" onClick={() => navigate('/get-started')}>Tell us what you need</button></footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthSuccess={() => { setAuthOpen(false); navigate('/client'); }} message="Use the email connected to your TW Ventures invitation. We will route you to the projects and investor information assigned to your account." />
    </main>
  );
}
