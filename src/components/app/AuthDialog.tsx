import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useHaptics } from "@/hooks/useHaptics";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail, CheckCircle, ArrowLeft,
  Building2, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "./AuthProvider";
import Logo from "./Logo";

// SVG icons for OAuth providers — inline to avoid dependency on icon packs
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);


interface AuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthSuccess?: () => void;
  message?: string | null;
}

// Two steps: ask for the address, then for the code it was sent.
type AuthView = 'email' | 'code';

const AuthDialog = ({ open, onOpenChange, onAuthSuccess, message }: AuthDialogProps) => {
  const { sendLoginCode, verifyLoginCode, signInWithOAuth } = useAuth();
  const haptics = useHaptics();
  const { dismiss } = useToast();

  // Dismiss any lingering "Sign in required" toasts when dialog opens
  useEffect(() => {
    if (open) dismiss();
  }, [open, dismiss]);

  // Track keyboard height so the sheet slides up on iOS.
  // useNativeApp dispatches 'keyboardWillShow' with { detail: { keyboardHeight } }.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const onShow = (e: Event) => {
      const height = (e as CustomEvent).detail?.keyboardHeight ?? 0;
      setKeyboardHeight(height);
    };
    const onHide = () => setKeyboardHeight(0);
    window.addEventListener('keyboardWillShow', onShow);
    window.addEventListener('keyboardWillHide', onHide);
    return () => {
      window.removeEventListener('keyboardWillShow', onShow);
      window.removeEventListener('keyboardWillHide', onHide);
    };
  }, []);

  const [view, setView] = useState<AuthView>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [formError, setFormError] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setView('email');
      setEmail('');
      setCode('');
      setLoading(false);
      setOauthLoading(null);
      setEmailError('');
      setCodeError('');
      setFormError('');
    }
  }, [open]);

  // Re-focus email when switching views — desktop only.
  // On mobile, auto-focus triggers the keyboard before the user sees the form.
  useEffect(() => {
    if (open && window.innerWidth >= 640) setTimeout(() => emailRef.current?.focus(), 80);
  }, [view, open]);

  const validateEmail = () => {
    if (!email.trim()) { setEmailError('Email is required'); return false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Enter a valid email address'); return false; }
    return true;
  };

  const validateCode = () => {
    const trimmed = code.trim();
    if (!trimmed) { setCodeError('Enter the code from your email'); return false; }
    if (!/^\d{6}$/.test(trimmed)) { setCodeError('The code is six digits'); return false; }
    return true;
  };

  const clearErrors = () => {
    setEmailError('');
    setCodeError('');
    setFormError('');
  };

  // ── OAuth ──────────────────────────────────────────────────────────────────

  const handleOAuth = async (provider: 'google') => {
    setOauthLoading(provider);
    try {
      const { error } = await signInWithOAuth(provider);
      if (error) throw error;
      // Supabase redirects the browser — nothing more to do here
    } catch (err) {
      toast({
        title: 'Sign in failed',
        description: err instanceof Error ? err.message : 'Could not connect to provider.',
        variant: 'destructive',
      });
      setOauthLoading(null);
    }
  };

  // ── One-time code ──────────────────────────────────────────────────────────

  const handleSendCode = async () => {
    clearErrors();
    if (!validateEmail()) { haptics.error(); return; }

    haptics.medium();
    setLoading(true);
    try {
      const { error } = await sendLoginCode(email);
      if (error) {
        haptics.error();
        setFormError(
          error.message?.toLowerCase().includes('rate')
            ? 'Too many requests just now. Wait a moment and try again.'
            : error.message || 'The code could not be sent.',
        );
        return;
      }
      setView('code');
      setCode('');
      // The same call signs an existing person in and creates a first-time one,
      // so the copy must not promise either.
      toast({ title: 'Code sent', description: `Check ${email} for a six-digit code.` });
    } catch {
      haptics.error();
      setFormError('Unable to reach TW Ventures right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    clearErrors();
    if (!validateCode()) { haptics.error(); return; }

    haptics.medium();
    setLoading(true);
    try {
      const { error } = await verifyLoginCode(email, code.trim());
      if (error) {
        haptics.error();
        const text = error.message?.toLowerCase() ?? '';
        setCodeError(
          text.includes('expired')
            ? 'That code has expired. Send a new one.'
            : text.includes('invalid') || text.includes('token')
              ? 'That code is not right. Check it and try again.'
              : error.message || 'The code could not be verified.',
        );
        return;
      }
      haptics.success();
      toast({ title: 'Signed in' });
      onOpenChange(false);
      onAuthSuccess?.();
    } catch {
      haptics.error();
      setFormError('Unable to reach TW Ventures right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const onEmailChange = (v: string) => { setEmail(v); setEmailError(''); setFormError(''); };
  const onCodeChange = (v: string) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setCodeError(''); setFormError(''); };

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderOAuthButtons = () => (
    <Button
      variant="outline"
      className="w-full gap-2.5 font-medium h-11 border-border/70 hover:bg-muted/60 transition-colors"
      onClick={() => handleOAuth('google')}
      disabled={!!oauthLoading || loading}
    >
      {oauthLoading === 'google'
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <GoogleIcon />}
      Continue with Google
    </Button>
  );

  const renderDivider = () => (
    <div className="relative my-4">
      <Separator />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="bg-background px-2 text-xs text-muted-foreground">or continue with email</span>
      </span>
    </div>
  );

  const renderEmailField = () => (
    <div className="space-y-1">
      <Label htmlFor="auth-email" className="text-sm font-medium">Email</Label>
      <Input
        id="auth-email"
        ref={emailRef}
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !loading && handleSendCode()}
        placeholder="you@example.com"
        autoComplete="email"
        className={emailError ? 'border-destructive' : ''}
        disabled={loading}
      />
      {emailError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{emailError}
        </p>
      )}
    </div>
  );

  const renderCodeField = () => (
    <div className="space-y-1">
      <Label htmlFor="auth-code" className="text-sm font-medium">Six-digit code</Label>
      <Input
        id="auth-code"
        ref={codeRef}
        // Numeric so phones show the number pad; one-time-code lets iOS and
        // Android offer the value straight from the notification.
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => onCodeChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !loading && handleVerifyCode()}
        placeholder="000000"
        maxLength={6}
        className={`text-center text-lg tracking-[0.4em] ${codeError ? 'border-destructive' : ''}`}
        disabled={loading}
      />
      {codeError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{codeError}
        </p>
      )}
    </div>
  );

  const renderFormError = () =>
    formError ? (
      <Alert variant="destructive" className="py-2">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">{formError}</AlertDescription>
      </Alert>
    ) : null;

  // ── Views ──────────────────────────────────────────────────────────────────

  const renderEmailStep = () => (
    <>
      {renderOAuthButtons()}
      {renderDivider()}
      <form onSubmit={(e) => { e.preventDefault(); handleSendCode(); }} className="space-y-4" noValidate>
        {renderEmailField()}
        {renderFormError()}
        <Button type="submit" disabled={loading || !!oauthLoading} className="w-full h-11 font-medium">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          {loading ? 'Sending…' : 'Email me a code'}
        </Button>
      </form>
      <p className="pt-2 text-center text-xs text-muted-foreground">
        No password needed — we email you a one-time sign-in.
      </p>
    </>
  );

  const renderCodeStep = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleVerifyCode(); }} className="space-y-4" noValidate>
      <div className="flex items-start gap-2.5 border-l-2 border-[#9a7b4f] bg-[#071a33]/[.035] px-4 py-3 text-sm">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9a7b4f]" />
        {/* Supabase blocks template edits on the free tier while its own sender
            is in use, so until custom SMTP is configured the mail arrives as a
            link rather than a code. Both sign in, and both are described here
            rather than promising one and delivering the other. This copy stays
            correct after SMTP lands, when the code becomes the only form. */}
        <p>
          We emailed <strong>{email}</strong>. If it contains a six-digit code, enter it below.
          If it contains a sign-in link, open that instead — either signs you in, and both expire shortly.
        </p>
      </div>
      {renderCodeField()}
      {renderFormError()}
      <Button type="submit" disabled={loading} className="h-11 w-full font-medium">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {loading ? 'Verifying…' : 'Sign in with code'}
      </Button>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { clearErrors(); setCode(''); setView('email'); }}
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-3 w-3" />Use a different email
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => { clearErrors(); handleSendCode(); }}
          className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
        >
          Resend code
        </button>
      </div>
    </form>
  );

  const title = view === 'code' ? 'Enter your code' : 'Welcome to TW Ventures';

  const accessLabel = message?.toLowerCase().includes('investor') ? 'Investor partnerships'
    : message?.toLowerCase().includes('project manager') ? 'Project delivery'
      : message?.toLowerCase().includes('client') || message?.toLowerCase().includes('project invitation') ? 'Investor partnerships'
        : 'Secure project access';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading && !oauthLoading) onOpenChange(v); }}>
      {/* Mobile: bottom sheet that lifts above the keyboard.
          keyboardHeight is tracked from Capacitor keyboard events and applied as bottom offset. */}
      <DialogContent
        className="brand-dialog max-sm:max-h-[90dvh] overflow-y-auto border-[#071a33]/20 bg-[#fbfaf7] p-0 pb-[max(0rem,env(safe-area-inset-bottom))] sm:max-w-[760px] sm:grid-cols-[.82fr_1.18fr] sm:gap-0 sm:overflow-hidden sm:rounded-lg"
        style={keyboardHeight > 0 ? { bottom: keyboardHeight, transition: 'bottom 0.25s ease-out' } : undefined}
      >
        <aside className="relative hidden overflow-hidden bg-[#071a33] p-8 text-white sm:flex sm:flex-col sm:justify-between">
          <div className="absolute inset-0 opacity-[.07]" style={{ backgroundImage: 'linear-gradient(90deg, white 1px, transparent 1px), linear-gradient(white 1px, transparent 1px)', backgroundSize: '44px 44px' }} />
          <div className="relative"><div className="inline-flex bg-white p-2"><Logo width={92} height={72} /></div><p className="mt-8 text-[10px] font-bold uppercase tracking-[.28em] text-[#cfbd9b]">{accessLabel}</p><h3 className="brand-serif mt-4 text-3xl leading-tight">One accountable view of the work.</h3><p className="mt-4 text-sm leading-6 text-slate-300">Secure access to the projects, decisions, documents, and next actions assigned to you.</p></div>
          <div className="relative"><div className="mb-4 h-px bg-gradient-to-r from-[#cfbd9b] to-transparent" /><p className="text-[10px] font-semibold uppercase tracking-[.24em] text-slate-300">Acquire · Build · Manage</p></div>
        </aside>

        <div className="brand-form p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3 sm:hidden"><Logo width={62} height={48} /><div><p className="brand-serif text-xl">TW Ventures</p><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#9a7b4f]">{accessLabel}</p></div></div>
          <DialogHeader>
            <DialogTitle className="brand-serif text-3xl font-normal leading-tight">{title}</DialogTitle>
            <DialogDescription className="leading-6">
              {view === 'code'
                ? 'Enter the six-digit code we just emailed you.'
                : 'Use the email connected to your TW Ventures relationship. New here? This creates your account.'}
            </DialogDescription>
          </DialogHeader>

          {message && view === 'email' && <div className="mt-5 flex items-start gap-2.5 border-l-2 border-[#9a7b4f] bg-[#071a33]/[.035] px-4 py-3 text-sm"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9a7b4f]" /><p>{message}</p></div>}

          <div className="mt-6">
            {view === 'email' && renderEmailStep()}
            {view === 'code' && renderCodeStep()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
