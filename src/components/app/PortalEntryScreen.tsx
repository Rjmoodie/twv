import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { PortalIntent } from '@/lib/portalRouting';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { Button } from '@/components/ui/button';

const portalCopy: Record<PortalIntent, {
  label: string;
  title: string;
  description: string;
  features: string[];
}> = {
  project_manager: {
    label: 'Project Manager',
    title: 'Run the work from one clear project record.',
    description: 'Coordinate portfolio work, publish updates, manage documents, and keep decisions moving without hunting through disconnected tools.',
    features: ['Portfolio and project health', 'Milestones, documents, and updates', 'Client and investor coordination'],
  },
  investor: {
    label: 'Investor',
    title: 'See the work behind your investment.',
    description: 'Review the projects connected to you, follow progress, and keep important updates and documents within reach.',
    features: ['Assigned project visibility', 'Progress and milestone updates', 'Shared project documents'],
  },
  client: {
    label: 'Client',
    title: 'Your project, without the information chase.',
    description: 'Follow current work, review shared details, and send requests to the TW Ventures team from one secure place.',
    features: ['Project status at a glance', 'Shared updates and documents', 'A direct request path'],
  },
};

export default function PortalEntryScreen({
  intent,
  onSignIn,
}: {
  intent: PortalIntent;
  onSignIn: () => void;
}) {
  const navigate = useNavigate();
  const copy = portalCopy[intent];

  return (
    <main className="public-page min-h-screen bg-[#071a33]">
      <PublicBrandHeader
        section={`${copy.label} Portal`}
        actions={(
          <Button variant="ghost" className="gap-2 text-[#071a33]" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4" />
            <span className="brand-nav-label">Website</span>
          </Button>
        )}
      />
      <section className="brand-hero flex min-h-[calc(100vh-89px)] items-center px-5 py-12 sm:px-8 sm:py-16">
        <div className="relative mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.08fr_.92fr]">
          <div>
            <p className="brand-kicker">Secure {copy.label.toLowerCase()} workspace</p>
            <h1 className="brand-serif mt-4 max-w-3xl text-4xl leading-[1.05] sm:text-6xl">{copy.title}</h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">{copy.description}</p>
            <Button size="lg" className="mt-8 gap-2 bg-white text-[#071a33] hover:bg-slate-100" onClick={onSignIn}>
              Sign in to {copy.label} portal <ArrowRight className="h-4 w-4" />
            </Button>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-400">Use the exact email connected to your TW Ventures organization or project invitation.</p>
          </div>

          <div className="brand-card-dark p-6 text-white sm:p-8">
            <div className="flex items-center gap-3 border-b border-white/10 pb-5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-white/10"><LockKeyhole className="h-5 w-5" /></span>
              <div>
                <p className="font-semibold">Inside your portal</p>
                <p className="mt-0.5 text-sm text-slate-400">Access follows your assigned role.</p>
              </div>
            </div>
            <ul className="mt-5 space-y-4">
              {copy.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-slate-200">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#dfc48e]/15 text-[#dfc48e]"><Check className="h-3.5 w-3.5" /></span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
