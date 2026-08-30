import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PublicBrandHeader from '@/components/app/PublicBrandHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';
import { toast } from '@/hooks/use-toast';

type RpcClient = { rpc(name: string, args: Record<string, unknown>): Promise<{ error: { message: string } | null }> };
const database = supabase as unknown as RpcClient;

const projectTypes = [
  ['acquisition', 'Property acquisition'],
  ['development', 'Real estate development'],
  ['construction', 'Owner-side construction project management'],
  ['renovation', 'Renovation planning and oversight'],
  ['management', 'Contractor coordination and project management'],
  ['consultation', 'Scope, budget, or delivery-model consultation'],
  ['other', 'Something else'],
] as const;

export default function ProjectIntakePage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', company_name: '', project_type: '',
    property_address: '', budget_range: '', desired_timeline: '', message: '',
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const ready = form.full_name.trim().length >= 2 && /.+@.+\..+/.test(form.email.trim()) && !!form.project_type && form.message.trim().length >= 10;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    const { error } = await database.rpc('submit_project_inquiry', {
      full_name: form.full_name, email: form.email, phone: form.phone || null,
      company_name: form.company_name || null, project_type: form.project_type,
      property_address: form.property_address || null, budget_range: form.budget_range || null,
      desired_timeline: form.desired_timeline || null, message: form.message,
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Your project request was not sent', description: error.message, variant: 'destructive' });
      return;
    }
    track('project_inquiry_submitted', { project_type: form.project_type });
    setSent(true);
  };

  return <main className="public-page">
    <PublicBrandHeader section="Investor Project Consultation" actions={<Button variant="ghost" className="text-[#071a33]" onClick={() => navigate('/')}><ArrowLeft className="mr-2 h-4 w-4" /><span className="brand-nav-label">Back to site</span></Button>} />
    <section className="px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[.8fr_1.2fr]">
        <div><p className="brand-kicker !text-[#9a7b4f]">Project consultation</p><h1 className="brand-serif mt-3 text-5xl leading-[1.04]">Start with the right delivery model.</h1><p className="mt-6 text-lg leading-8 text-slate-600">Share the asset, scope, timing, and result you have in mind. We will assess whether owner-side project management fits the project and clarify the responsibilities before an engagement begins.</p><div className="brand-card mt-8 p-6"><h2 className="brand-serif text-xl">What happens next</h2><div className="brand-rule mt-3 w-24" /><ol className="mt-5 space-y-4 text-sm leading-6 text-slate-600"><li><strong className="mr-2 text-[#9a7b4f]">01</strong> We review the property, budget, stage, and requested scope.</li><li><strong className="mr-2 text-[#9a7b4f]">02</strong> We discuss fit, risks, timing, and the appropriate delivery model.</li><li><strong className="mr-2 text-[#9a7b4f]">03</strong> The agreement identifies who contracts, approves, coordinates, and carries each responsibility.</li></ol><p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500">Submitting a request does not create a project-management, construction, or contractor relationship.</p></div></div>
        {sent ? <Card className="brand-card"><CardContent className="flex min-h-[520px] flex-col items-center justify-center p-10 text-center"><CheckCircle2 className="h-12 w-12 text-[#9a7b4f]" /><h2 className="brand-serif mt-5 text-3xl">Your project brief is in.</h2><p className="mt-3 max-w-md text-slate-600">The TW Ventures team will review it and follow up using the contact details you provided.</p><Button className="mt-8" onClick={() => navigate('/')}>Return home</Button></CardContent></Card> :
        <Card className="brand-card brand-form"><CardContent className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
          <Field id="project-full-name" label="Full name *"><Input id="project-full-name" required aria-required="true" value={form.full_name} onChange={(event) => set('full_name')(event.target.value)} autoComplete="name" /></Field>
          <Field id="project-email" label="Email *"><Input id="project-email" required aria-required="true" type="email" value={form.email} onChange={(event) => set('email')(event.target.value)} autoComplete="email" /></Field>
          <Field id="project-phone" label="Phone"><Input id="project-phone" type="tel" value={form.phone} onChange={(event) => set('phone')(event.target.value)} autoComplete="tel" /></Field>
          <Field id="project-company" label="Company"><Input id="project-company" value={form.company_name} onChange={(event) => set('company_name')(event.target.value)} autoComplete="organization" /></Field>
          <Field id="project-type" label="Project type *"><Select value={form.project_type} onValueChange={set('project_type')} required><SelectTrigger id="project-type" aria-required="true"><SelectValue placeholder="Select the closest match" /></SelectTrigger><SelectContent className="brand-select-content">{projectTypes.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
          <Field id="project-budget" label="Estimated budget"><Select value={form.budget_range} onValueChange={set('budget_range')}><SelectTrigger id="project-budget"><SelectValue placeholder="Select a range" /></SelectTrigger><SelectContent className="brand-select-content"><SelectItem value="under_100k">Under $100,000</SelectItem><SelectItem value="100k_500k">$100,000–$500,000</SelectItem><SelectItem value="500k_1m">$500,000–$1 million</SelectItem><SelectItem value="1m_5m">$1–$5 million</SelectItem><SelectItem value="5m_plus">$5 million+</SelectItem><SelectItem value="undecided">Not decided</SelectItem></SelectContent></Select></Field>
          <div className="sm:col-span-2"><Field id="project-address" label="Property address or target area"><Input id="project-address" value={form.property_address} onChange={(event) => set('property_address')(event.target.value)} placeholder="Address, neighborhood, or city" /></Field></div>
          <div className="sm:col-span-2"><Field id="project-timeline" label="Desired timeline"><Input id="project-timeline" value={form.desired_timeline} onChange={(event) => set('desired_timeline')(event.target.value)} placeholder="For example: planning now, start within 90 days" /></Field></div>
          <div className="sm:col-span-2"><Field id="project-details" label="What do you need help with? *"><Textarea id="project-details" required aria-required="true" rows={6} value={form.message} onChange={(event) => set('message')(event.target.value)} placeholder="Describe the property, current stage, known scope, budget, contractors already involved, and the outcome you want." /></Field></div>
          <div className="sm:col-span-2"><p id="project-form-status" className="mb-3 text-xs leading-5 text-slate-600" aria-live="polite">{ready ? 'Your project request is ready to send.' : 'Complete your name, valid email, project type, and at least 10 characters of project details.'}</p><Button className="w-full" size="lg" disabled={!ready || busy} onClick={submit} aria-describedby="project-form-status">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}{busy ? 'Sending…' : 'Send project request'}</Button><p className="mt-3 text-xs leading-5 text-slate-500">By submitting, you agree that TW Ventures may contact you about this request. We do not sell your information.</p></div>
        </CardContent></Card>}
      </div>
    </section>
  </main>;
}

const Field = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
