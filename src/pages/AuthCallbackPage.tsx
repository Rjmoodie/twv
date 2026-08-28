import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const finish = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const { data: existing, error: existingError } = await supabase.auth.getSession();
      if (!existingError && existing.session) {
        if (active) setTimeout(() => navigate('/', { replace: true }), 500);
        return;
      }
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError('This sign-in link is invalid or has expired. Request a new link and try again.');
          return;
        }
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        if (active) setError('We could not confirm this sign-in. The link may have expired.');
        return;
      }
      if (active) setTimeout(() => navigate('/', { replace: true }), 500);
    };
    void finish();
    return () => { active = false; };
  }, [navigate]);

  return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center">{error ? <><AlertCircle className="mx-auto h-10 w-10 text-destructive" /><h1 className="mt-4 text-xl font-semibold">Sign-in link could not be confirmed</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button asChild className="mt-6"><Link to="/">Return to SomaTech</Link></Button></> : <><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><h1 className="mt-4 text-xl font-semibold">Confirming your account</h1><p className="mt-2 text-sm text-muted-foreground">You’ll be returned to SomaTech automatically.</p><CheckCircle2 className="sr-only" /></>}</div></main>;
}
