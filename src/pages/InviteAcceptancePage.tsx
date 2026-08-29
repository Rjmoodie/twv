import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import AuthDialog from '@/components/app/AuthDialog';
import { useAuth } from '@/components/app/AuthProvider';
import Logo from '@/components/app/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';

interface InvitationClient {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
}

const InviteAcceptancePage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading, refreshAccess } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [state, setState] = useState<'waiting' | 'accepting' | 'accepted' | 'error'>('waiting');
  const [error, setError] = useState('');
  const acceptingRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    window.sessionStorage.setItem('tw-pending-project-invite', token);
  }, [token]);

  useEffect(() => {
    if (loading) return;
    if (!user) { setAuthOpen(true); return; }
    if (!token || acceptingRef.current) return;
    acceptingRef.current = true;
    setState('accepting');
    const accept = async () => {
      const result = await (supabase as unknown as InvitationClient).rpc('accept_project_invitation', { invitation_token: token });
      if (result.error) {
        setError(result.error.message);
        setState('error');
        acceptingRef.current = false;
        return;
      }
      window.sessionStorage.removeItem('tw-pending-project-invite');
      await refreshAccess();
      const role = String(result.data);
      setState('accepted');
      window.setTimeout(() => navigate(role === 'project_manager' ? '/pm' : role === 'investor' ? '/investor' : '/client', { replace: true }), 700);
    };
    void accept();
  }, [loading, user, token, refreshAccess, navigate]);

  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
    <Card className="w-full max-w-lg"><CardContent className="p-8 text-center">
      <Logo className="mx-auto mb-8 h-10" />
      {state === 'accepting' && <><Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" /><h1 className="text-xl font-semibold">Connecting your project access</h1><p className="mt-2 text-sm text-muted-foreground">We are verifying the invitation and its assigned role.</p></>}
      {state === 'accepted' && <><CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-emerald-600" /><h1 className="text-xl font-semibold">Invitation accepted</h1><p className="mt-2 text-sm text-muted-foreground">Taking you to your project portal…</p></>}
      {state === 'error' && <><ShieldCheck className="mx-auto mb-4 h-10 w-10 text-destructive" /><h1 className="text-xl font-semibold">This invitation cannot be accepted</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-6" variant="outline" onClick={() => navigate('/')}>Return to TW Ventures</Button></>}
      {state === 'waiting' && !loading && !user && <><ShieldCheck className="mx-auto mb-4 h-10 w-10 text-primary" /><h1 className="text-xl font-semibold">Sign in to accept your invitation</h1><p className="mt-2 text-sm text-muted-foreground">Use the exact email address that received the project invitation.</p><Button className="mt-6" onClick={() => setAuthOpen(true)}>Sign in</Button></>}
    </CardContent></Card>
    <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthSuccess={() => setAuthOpen(false)} message="Sign in with the email address that received this project invitation." />
  </main>;
};

export default InviteAcceptancePage;
