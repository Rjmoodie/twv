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
  Mail, Eye, EyeOff, CheckCircle, ArrowLeft,
  Building2, Sparkles, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "./AuthProvider";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";
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

type AuthView = 'signin' | 'signup' | 'forgot' | 'forgot-sent' | 'signup-sent';

const AuthDialog = ({ open, onOpenChange, onAuthSuccess, message }: AuthDialogProps) => {
  const { signIn, signUp, signInWithOAuth } = useAuth();
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

  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setView('signin');
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setLoading(false);
      setOauthLoading(null);
      setEmailError('');
      setPasswordError('');
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

  const validatePassword = (min = 8) => {
    if (!password.trim()) { setPasswordError('Password is required'); return false; }
    if (password.length < min) { setPasswordError(`Password must be at least ${min} characters`); return false; }
    return true;
  };

  const clearErrors = () => {
    setEmailError('');
    setPasswordError('');
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

  // ── Email sign-in ──────────────────────────────────────────────────────────

  const handleSignIn = async () => {
    clearErrors();
    const emailOk = validateEmail();
    const pwOk = validatePassword(6);
    if (!emailOk || !pwOk) { haptics.error(); return; }

    haptics.medium();
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        haptics.error();
        if (error.message?.includes('Invalid login credentials')) {
          setFormError('Incorrect email or password. Please try again.');
        } else {
          setFormError(error.message || 'Sign in failed.');
        }
        return;
      }
      haptics.success();
      toast({ title: 'Welcome back!' });
      onOpenChange(false);
      onAuthSuccess?.();
    } catch (err) {
      haptics.error();
      setFormError(
        'Unable to reach TW Ventures right now. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Email sign-up ──────────────────────────────────────────────────────────

  const handleSignUp = async () => {
    clearErrors();
    const emailOk = validateEmail();
    const pwOk = validatePassword(8);
    if (!emailOk || !pwOk) return;

    setLoading(true);
    try {
      const { error, requiresEmailConfirmation } = await signUp(email, password);
      if (error) {
        if (error.message?.includes('User already registered')) {
          setFormError('An account with this email already exists. Sign in instead.');
        } else {
          setFormError(error.message || 'Sign up failed.');
        }
        return;
      }
      if (requiresEmailConfirmation) {
        setView('signup-sent');
      } else {
        toast({ title: 'Account created', description: 'Welcome to TW Ventures.' });
        onOpenChange(false);
        onAuthSuccess?.();
      }
    } catch (err) {
      setFormError(
        'Unable to reach TW Ventures right now. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Password reset ─────────────────────────────────────────────────────────

  const handleForgotPassword = async () => {
    clearErrors();
    if (!validateEmail()) return;

    setLoading(true);
    try {
      const { error } = await (await import('@/integrations/supabase/client')).supabase.auth
        .resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (error) throw error;
      setView('forgot-sent');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  // ── Shared field handlers ──────────────────────────────────────────────────

  const onEmailChange = (v: string) => { setEmail(v); setEmailError(''); setFormError(''); };
  const onPasswordChange = (v: string) => { setPassword(v); setPasswordError(''); setFormError(''); };

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
        onKeyDown={(e) => e.key === 'Enter' && passwordRef.current?.focus()}
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

  const renderPasswordField = (onSubmit: () => void, showStrength = false) => (
    <div className="space-y-1">
      <Label htmlFor="auth-password" className="text-sm font-medium">Password</Label>
      <div className="relative">
        <Input
          id="auth-password"
          ref={passwordRef}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && onSubmit()}
          placeholder={showStrength ? 'Create a strong password' : 'Your password'}
          autoComplete={showStrength ? 'new-password' : 'current-password'}
          className={`pr-10 ${passwordError ? 'border-destructive' : ''}`}
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && <PasswordStrengthIndicator password={password} />}
      {passwordError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3 shrink-0" />{passwordError}
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

  const renderSignIn = () => (
    <>
      {renderOAuthButtons()}
      {renderDivider()}
      <form onSubmit={(e) => { e.preventDefault(); handleSignIn(); }} className="space-y-4" noValidate>
        {renderEmailField()}
        {renderPasswordField(handleSignIn)}
        {renderFormError()}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { clearErrors(); setView('forgot'); }}
            className="text-xs text-primary hover:underline underline-offset-2"
          >
            Forgot password?
          </button>
        </div>
        <Button type="submit" disabled={loading || !!oauthLoading} className="w-full h-11 font-medium">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground pt-2">
        No account?{' '}
        <button type="button" onClick={() => { clearErrors(); setView('signup'); }} className="text-primary hover:underline underline-offset-2 font-medium">
          Create an account
        </button>
      </p>
    </>
  );

  const renderSignUp = () => (
    <>
      {renderOAuthButtons()}
      {renderDivider()}
      <form onSubmit={(e) => { e.preventDefault(); handleSignUp(); }} className="space-y-4" noValidate>
        {renderEmailField()}
        {renderPasswordField(handleSignUp, true)}
        {renderFormError()}
        <Button type="submit" disabled={loading || !!oauthLoading} className="w-full h-11 font-medium">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground pt-2">
        Already have an account?{' '}
        <button type="button" onClick={() => { clearErrors(); setView('signin'); }} className="text-primary hover:underline underline-offset-2 font-medium">
          Sign in
        </button>
      </p>
    </>
  );

  const renderForgot = () => (
    <form onSubmit={(e) => { e.preventDefault(); handleForgotPassword(); }} className="space-y-4" noValidate>
      <p className="text-sm text-muted-foreground">
        Enter your email and we'll send a link to reset your password.
      </p>
      {renderEmailField()}
      {renderFormError()}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => { clearErrors(); setView('signin'); }} className="flex-1" disabled={loading}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back
        </Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
          {loading ? 'Sending…' : 'Send Link'}
        </Button>
      </div>
    </form>
  );

  const renderCheckEmail = (isSignup: boolean) => {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="w-14 h-14 rounded-full bg-accent/10 dark:bg-accent/30 flex items-center justify-center mx-auto">
          <CheckCircle className="h-7 w-7 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Check your email</h3>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a link to <strong>{email}</strong>.
            {isSignup ? " Click it to confirm your account and sign in." : " Click it to reset your password."}
          </p>
        </div>
        <Button variant="outline" onClick={() => { clearErrors(); setView('signin'); setPassword(''); }} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Back to Sign In
        </Button>
      </div>
    );
  };

  const title = view === 'forgot' ? 'Reset Password'
    : view === 'forgot-sent' ? 'Email Sent'
    : view === 'signup-sent' ? 'Confirm Your Account'
    : view === 'signup' ? 'Create Your Account'
    : 'Welcome to TW Ventures';

  const accessLabel = message?.toLowerCase().includes('investor') ? 'Investor partnerships'
    : message?.toLowerCase().includes('project manager') ? 'Project delivery'
      : message?.toLowerCase().includes('client') || message?.toLowerCase().includes('project invitation') ? 'Investor partnerships'
        : 'Secure project access';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading && !oauthLoading) onOpenChange(v); }}>
      {/* Mobile: bottom sheet that lifts above the keyboard.
          keyboardHeight is tracked from Capacitor keyboard events and applied as bottom offset. */}
      <DialogContent
        className="max-sm:max-h-[90dvh] overflow-y-auto border-[#071a33]/20 bg-[#fbfaf7] p-0 pb-[max(0rem,env(safe-area-inset-bottom))] sm:max-w-[760px] sm:grid-cols-[.82fr_1.18fr] sm:gap-0 sm:overflow-hidden sm:rounded-lg"
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
              {view === 'signin' ? 'Use the email connected to your TW Ventures relationship.' : view === 'signup' ? 'Create a secure account. Project access is assigned separately.' : 'Enter your email and we will send a secure reset link.'}
            </DialogDescription>
          </DialogHeader>

          {message && view === 'signin' && <div className="mt-5 flex items-start gap-2.5 border-l-2 border-[#9a7b4f] bg-[#071a33]/[.035] px-4 py-3 text-sm"><Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#9a7b4f]" /><p>{message}</p></div>}
          {view === 'signup' && <div className="mt-5 border-l-2 border-[#9a7b4f] bg-[#071a33]/[.035] px-4 py-3 text-xs leading-5 text-muted-foreground"><p className="font-semibold text-foreground">Access follows a verified invitation</p><p>Each account sees only the projects and tools assigned to it.</p></div>}

          <div className="mt-6">
            {view === 'signin' && renderSignIn()}
            {view === 'signup' && renderSignUp()}
            {view === 'forgot' && renderForgot()}
            {view === 'forgot-sent' && renderCheckEmail(false)}
            {view === 'signup-sent' && renderCheckEmail(true)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
