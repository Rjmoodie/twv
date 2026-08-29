import { useState } from 'react';
import { ArrowRight, BellRing, Building2, CheckCircle2, FileText, FolderKanban, LogIn, MessageSquareText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthDialog from '@/components/app/AuthDialog';
import Logo from '@/components/app/Logo';
import { useAuth } from '@/components/app/AuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const portalFeatures = [
  { icon: FolderKanban, title: 'View your projects', description: 'See every active and completed project connected to your account.' },
  { icon: BellRing, title: 'Follow progress', description: 'Receive clear milestone, schedule, and status updates from the TWV team.' },
  { icon: FileText, title: 'Keep details together', description: 'Access project documents, decisions, and important information in one place.' },
  { icon: MessageSquareText, title: 'Plan what is next', description: 'Start the conversation for your next acquisition, build, or managed project.' },
];

export default function ClientOnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);

  const enterPortal = () => {
    if (user) navigate('/client');
    else setAuthOpen(true);
  };

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-[#071a33]">
      <nav className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-3" aria-label="TW Ventures home">
            <span className="h-11 w-11 overflow-hidden rounded-full border border-slate-200 shadow-sm"><Logo width={44} height={44} /></span>
            <span className="text-left">
              <span className="block text-lg font-bold leading-tight">TW Ventures</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Client Services</span>
            </span>
          </button>
          <Button variant="ghost" className="gap-2 text-[#071a33]" onClick={enterPortal}>
            <LogIn className="h-4 w-4" />
            {user ? 'Open portal' : 'Client sign in'}
          </Button>
        </div>
      </nav>

      <section className="relative overflow-hidden bg-[#07111f] px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 75% 25%, #244f7a 0, transparent 35%), linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: 'auto, 44px 44px, 44px 44px' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-blue-200">Your projects. One clear view.</p>
            <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">Welcome to your TWV client experience.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">Onboard with our team, view the projects connected to you, follow progress, and begin planning what comes next.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="gap-2 bg-white text-[#071a33] hover:bg-slate-100" onClick={enterPortal}>
                {user ? 'Go to my projects' : 'Access client portal'} <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                <a href="mailto:services@twv-llc.com?subject=New%20project%20inquiry">Start a new project</a>
              </Button>
            </div>
            <p className="mt-5 text-sm text-slate-400">Have an invitation? Sign in using the email address that received it.</p>
          </div>

          <Card className="border-white/10 bg-white/[0.07] text-white shadow-2xl backdrop-blur-xl">
            <CardContent className="p-7 sm:p-9">
              <div className="mb-7 flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#071a33]"><Building2 className="h-6 w-6" /></span>
                <div><p className="font-semibold">Client onboarding</p><p className="text-sm text-slate-300">A direct path to your project team</p></div>
              </div>
              <ol className="space-y-5">
                {['Create or access your secure client account', 'Connect to projects assigned by the TWV team', 'Review updates, milestones, and project documents', 'Request your next project when you are ready'].map((step, index) => (
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

      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-700">Built for active clients</p><h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Stay connected from kickoff through completion.</h2></div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {portalFeatures.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="border-slate-200 bg-white shadow-sm"><CardContent className="p-6"><Icon className="h-6 w-6 text-blue-700" /><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></CardContent></Card>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:p-9">
            <div className="flex gap-4"><CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-emerald-600" /><div><h2 className="text-xl font-semibold">Already working with TW Ventures?</h2><p className="mt-1 text-sm text-slate-600">Sign in to see the projects and updates available to your account.</p></div></div>
            <Button className="shrink-0 gap-2" onClick={enterPortal}>{user ? 'Open my portal' : 'Sign in'} <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center text-sm text-slate-500">Questions about access? <a className="font-medium text-[#071a33] underline underline-offset-4" href="mailto:services@twv-llc.com">services@twv-llc.com</a></footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthSuccess={() => { setAuthOpen(false); navigate('/client'); }} message="Sign in or create your TW Ventures client account. Use the email connected to your project invitation." />
    </main>
  );
}
