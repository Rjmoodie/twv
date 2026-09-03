import { useState, type ReactNode } from 'react';
import { ArrowRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/app/AuthProvider';
import type { PortalIntent } from '@/lib/portalRouting';
import { canEnterPortal, getPreferredPortalPath } from '@/lib/portalRouting';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { Button } from '@/components/ui/button';

interface PortalRouteGuardProps {
  intent: PortalIntent;
  children: ReactNode;
}

export default function PortalRouteGuard({ intent, children }: PortalRouteGuardProps) {
  const { user, loading, accessLoading, access, signOut } = useAuth();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  // Signed-out visitors stay on the requested portal so its contextual auth
  // prompt can explain which invitation they need.
  if (!user || loading) return children;

  // Membership is a second authenticated request. Never decide from the empty
  // initial persona list or a legitimate PM could be redirected as a client.
  if (accessLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" aria-label="Checking portal access" /></div>;
  }

  if (!canEnterPortal(intent, access.personas)) {
    const intendedLabel = intent === 'project_manager' ? 'Project Manager' : intent.charAt(0).toUpperCase() + intent.slice(1);
    const assignedPath = getPreferredPortalPath(access.personas);
    const hasAssignedPortal = assignedPath !== '/get-started';
    const handleDifferentAccount = async () => {
      setSigningOut(true);
      await signOut();
      navigate(intent === 'project_manager' ? '/pm' : assignedPath, { replace: true });
      setSigningOut(false);
    };

    return <main className="public-page min-h-screen bg-[#f3f0e9]">
      <PublicBrandHeader section={`${intendedLabel} access`} />
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl items-center px-5 py-16 sm:px-8">
        <div className="brand-card w-full p-7 sm:p-10">
          <p className="brand-kicker !text-[#9a7b4f]">Secure portal routing</p>
          <h1 className="brand-serif mt-3 text-4xl text-[#071a33]">This account does not have {intendedLabel} access.</h1>
          <p className="mt-5 leading-7 text-slate-600">You are signed in as <strong className="text-[#071a33]">{user.email}</strong>. Access comes from the organization and project memberships assigned to this exact account.</p>
          {intent === 'project_manager' && <div className="mt-6 rounded-lg border border-[#9a7b4f]/30 bg-[#faf8f3] p-5 text-sm leading-6 text-slate-700"><strong className="text-[#071a33]">Kareem / Services:</strong> sign out and use <strong className="text-[#071a33]">services@twv-llc.com</strong>.</div>}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button disabled={signingOut} className="gap-2" onClick={handleDifferentAccount}><LogOut className="h-4 w-4" />{signingOut ? 'Signing out…' : 'Sign out and use another account'}</Button>
            {hasAssignedPortal && <Button variant="outline" className="gap-2" onClick={() => navigate(assignedPath, { replace: true })}>Open my assigned portal <ArrowRight className="h-4 w-4" /></Button>}
            {!hasAssignedPortal && <Button variant="outline" onClick={() => navigate('/', { replace: true })}>Return to TW Ventures</Button>}
          </div>
        </div>
      </section>
    </main>;
  }

  return children;
}
