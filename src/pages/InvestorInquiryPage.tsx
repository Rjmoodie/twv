import { useState } from 'react';
import { ArrowRight, Building2, CheckCircle2, Hammer, LineChart, LogIn, MapPin, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AuthDialog from '@/components/app/AuthDialog';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { useAuth } from '@/components/app/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type Rpc = { rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }> };
const database = supabase as unknown as Rpc;

/**
 * Public investor page.
 *
 * What is deliberately absent matters as much as what is here. There is no
 * offering, no target return, no deal on display — Rule 506(b) forbids general
 * solicitation entirely, and TW has not yet chosen between 506(b) and 506(c).
 * A page describing how the firm works and inviting a conversation is safe
 * under either; a page advertising a deal would foreclose 506(b).
 *
 * The form asks about accreditation because it helps the firm triage, and the
 * copy says plainly that answering is not a verification. Under 506(c) a
 * checkbox never is.
 */

const STAGES = [
  { icon: MapPin, title: 'Acquisitions', body: 'Off-market and on-market sourcing across Philadelphia, through community relationships, brokers, and our own search.' },
  { icon: Building2, title: 'Development', body: 'Entitlements through to shovel-ready, working with architects, zoning counsel, and engineers.' },
  { icon: Hammer, title: 'Construction', body: 'Built by our own general contracting team, so cost and quality sit with the owner rather than across a table from them.' },
  { icon: LineChart, title: 'Stabilization', body: 'Lease-up to a cashflowing asset, with equity recycled into the next project.' },
];

const RANGES = [
  { value: 'under_50k', label: 'Under $50,000' },
  { value: '50k_100k', label: '$50,000 – $100,000' },
  { value: '100k_250k', label: '$100,000 – $250,000' },
  { value: '250k_500k', label: '$250,000 – $500,000' },
  { value: '500k_plus', label: '$500,000+' },
  { value: 'undecided', label: 'Not yet decided' },
];

const TIMEFRAMES = [
  { value: 'immediate', label: 'Ready now' },
  { value: 'three_months', label: 'Within three months' },
  { value: 'six_months', label: 'Within six months' },
  { value: 'exploring', label: 'Exploring for later' },
];

export default function InvestorInquiryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    accreditation_self_report: 'unsure',
    investment_range: '', timeframe: '', heard_via: '', message: '',
  });

  const set = (key: keyof typeof form) => (value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const ready = form.full_name.trim().length >= 2 && /.+@.+\..+/.test(form.email.trim());

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const { error } = await database.rpc('submit_investor_inquiry', {
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      accreditation_self_report: form.accreditation_self_report,
      investment_range: form.investment_range || null,
      timeframe: form.timeframe || null,
      heard_via: form.heard_via || null,
      message: form.message || null,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Your enquiry was not sent', description: error.message, variant: 'destructive' });
      return;
    }
    track('investor_inquiry_submitted', { self_report: form.accreditation_self_report });
    setSent(true);
  };

  const enterPortal = () => {
    if (user) navigate('/investor');
    else setAuthOpen(true);
  };

  return (
    <main className="public-page">
      <PublicBrandHeader section="Investor Partnerships" actions={<Button variant="ghost" className="gap-2 text-[#071a33]" onClick={enterPortal}><LogIn className="h-4 w-4" /><span className="brand-nav-label">{user ? 'Open portal' : 'Project access'}</span></Button>} />

      <section className="brand-hero px-5 py-20 text-white sm:px-8 sm:py-28">
        <div className="relative mx-auto max-w-7xl">
          <p className="brand-kicker mb-5">Investor relations · Philadelphia</p>
          <h1 className="brand-serif max-w-4xl text-5xl leading-[1.02] sm:text-7xl">Built to hold value.<br />Managed to create it.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            TW Ventures acquires, develops, builds, and operates Philadelphia real estate through one accountable platform.
            For prospective investment relationships, the first step is a direct conversation.
          </p>
          <div className="mt-9">
            <Button size="lg" className="gap-2 bg-white text-[#071a33] hover:bg-slate-100" asChild>
              <a href="#enquire">Start a conversation <ArrowRight className="h-4 w-4" /></a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <p className="brand-kicker !text-[#9a7b4f]">Vertically aligned execution</p>
        <h2 className="brand-serif mt-3 text-4xl sm:text-5xl">One asset. Four stages. One team.</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Most sponsors assemble a different party at every stage. We hold them together, which is where the margin and the
          schedule control come from.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="brand-card">
              <CardContent className="p-6">
                <Icon className="mb-4 h-6 w-6 text-[#9a7b4f]" />
                <h3 className="brand-serif text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="enquire" className="scroll-mt-8 border-t border-[#071a33]/10 bg-[#fbfaf7] px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="brand-kicker !text-[#9a7b4f]">Private and direct</p><h2 className="brand-serif mt-3 text-4xl">Start a conversation.</h2>
            <p className="mt-3 text-slate-600">
              Tell us a little about what you are looking for and we will follow up personally. Nothing on this page is an
              offer to sell or a solicitation to buy a security.
            </p>
            <div className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#244f7a]" />
                <div>
                  <p className="text-sm font-semibold">About the accreditation question</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    We ask so we can point you in the right direction. Answering is not a verification, and it does not
                    qualify you for anything on its own — if and when there is something specific to discuss, we will walk
                    you through what is actually required.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#244f7a]" />
                <div>
                  <p className="text-sm font-semibold">Already invited?</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Sign in with the email address that received your invitation, and your projects will be waiting.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {sent ? (
            <Card className="brand-card">
              <CardContent className="flex min-h-[420px] flex-col items-center justify-center p-10 text-center">
                <CheckCircle2 className="mb-5 h-12 w-12 text-emerald-600" />
                <h3 className="text-xl font-semibold">Thank you — we have your enquiry.</h3>
                <p className="mt-3 max-w-sm text-slate-600">
                  Someone from the team will be in touch. If it is urgent, reply to the confirmation and it will reach us faster.
                </p>
                <Button variant="outline" className="mt-8" onClick={() => navigate('/')}>Back to TW Ventures</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="brand-card brand-form">
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <Field id="investor-full-name" label="Full name *"><Input id="investor-full-name" required aria-required="true" value={form.full_name} onChange={(e) => set('full_name')(e.target.value)} autoComplete="name" /></Field>
                <Field id="investor-email" label="Email *"><Input id="investor-email" required aria-required="true" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} autoComplete="email" /></Field>
                <Field id="investor-phone" label="Phone"><Input id="investor-phone" type="tel" value={form.phone} onChange={(e) => set('phone')(e.target.value)} autoComplete="tel" /></Field>
                <Field id="investor-referral" label="How did you hear about us?"><Input id="investor-referral" value={form.heard_via} onChange={(e) => set('heard_via')(e.target.value)} /></Field>

                <Field id="investor-accreditation" label="Do you consider yourself an accredited investor?">
                  <Select value={form.accreditation_self_report} onValueChange={set('accreditation_self_report')}>
                    <SelectTrigger id="investor-accreditation"><SelectValue /></SelectTrigger>
                    <SelectContent className="brand-select-content">
                      <SelectItem value="accredited">Yes</SelectItem>
                      <SelectItem value="not_accredited">No</SelectItem>
                      <SelectItem value="unsure">I am not sure</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="investor-size" label="Typical investment size">
                  <Select value={form.investment_range} onValueChange={set('investment_range')}>
                    <SelectTrigger id="investor-size"><SelectValue placeholder="Select a range" /></SelectTrigger>
                    <SelectContent className="brand-select-content">{RANGES.map((range) => <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="investor-timeframe" label="Timeframe">
                  <Select value={form.timeframe} onValueChange={set('timeframe')}>
                    <SelectTrigger id="investor-timeframe"><SelectValue placeholder="Select a timeframe" /></SelectTrigger>
                    <SelectContent className="brand-select-content">{TIMEFRAMES.map((frame) => <SelectItem key={frame.value} value={frame.value}>{frame.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>

                <div className="sm:col-span-2">
                  <Field id="investor-message" label="Anything you would like us to know"><Textarea id="investor-message" rows={4} value={form.message} onChange={(e) => set('message')(e.target.value)} /></Field>
                </div>

                <div className="sm:col-span-2">
                  <p id="investor-form-status" className="mb-3 text-xs leading-5 text-slate-600" aria-live="polite">{ready ? 'Your enquiry is ready to send.' : 'Enter your full name and a valid email address to continue.'}</p>
                  <Button className="w-full" size="lg" disabled={!ready || busy} onClick={submit} aria-describedby="investor-form-status">
                    {busy ? 'Sending…' : 'Send enquiry'}
                  </Button>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    By sending this you agree we may contact you about TW Ventures. We do not sell your details.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthSuccess={() => { setAuthOpen(false); navigate('/investor'); }} message="Use the email connected to your TW Ventures invitation. We will route you to the projects and investor information assigned to your account." />
    </main>
  );
}

const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => (
  <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>
);
