import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail, MessageCircle, FileText, Shield, BookOpen,
  ChevronDown, ChevronUp, ExternalLink, HelpCircle,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FaqItem {
  q: string;
  a: string;
  category: string;
}

const FAQ: FaqItem[] = [
  {
    category: 'Account',
      q: 'How do I sign in?',
      a: 'Enter your email on the sign-in screen and we email you a six-digit code. There is no password to remember or reset. The code expires after a few minutes, and you can request another. You can also continue with Google.',
  },
  {
    category: 'Account',
    q: 'Can I change my email address?',
    a: 'Email changes are handled by your workspace administrator. Contact them from your current address so they can verify the request.',
  },
  {
    category: 'Billing',
    q: 'How do I cancel my subscription?',
    a: 'Go to Account → Data & Billing → Manage billing. This opens the Stripe billing portal where you can cancel at any time. Your access continues until the end of the current billing period.',
  },
  {
    category: 'Billing',
    q: 'Can I get a refund?',
    a: 'Billing requests are reviewed case by case. Contact your workspace administrator with the charge date and the account email.',
  },
  {
    category: 'Billing',
    q: 'What\'s included in each plan?',
    a: 'The pricing screen shows the current plans and included features. Access rules are temporary while TW Ventures moves to its operations-role model.',
  },
  {
    category: 'Data & Privacy',
    q: 'How is my financial data stored?',
    a: 'Application data is encrypted in transit and stored behind account-scoped access controls. Bank connections, where enabled, are read-only and cannot move money.',
  },
  {
    category: 'Data & Privacy',
    q: 'How do I delete my account?',
    a: 'Go to Account → Data & Billing → Delete account. Type DELETE to confirm. This permanently removes all your data from our servers within 30 days, as required by GDPR.',
  },
  {
    category: 'Data & Privacy',
    q: 'Can I export my data?',
    a: 'Yes. Go to Account → Data & Billing → Download my data to export the account data currently available to this workspace.',
  },
  {
    category: 'Features',
    q: 'Are underwriting results financial advice?',
    a: 'No. Calculator outputs are estimates based on the assumptions you enter. Verify source data and consult qualified legal, tax, engineering, and financial professionals before acting.',
  },
  {
    category: 'Features',
    q: 'What can I do in the real estate workspace?',
    a: 'You can run BRRRR and traditional rental analyses, save and compare deals, review amortization, and use property sourcing and map tools when their data providers are configured.',
  },
  {
    category: 'Technical',
    q: 'The app isn\'t loading correctly. What should I do?',
    a: 'Try force-closing and reopening the app. If the problem persists, contact your workspace administrator with the page, approximate time, device, and browser or app version.',
  },
];

const categories = ['Account', 'Billing', 'Data & Privacy', 'Features', 'Technical'];

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      className="w-full text-left"
      onClick={() => setOpen(o => !o)}
    >
      <div className={cn(
        'rounded-xl border border-border/50 px-4 py-3.5 transition-colors',
        open ? 'bg-muted/40 border-border/70' : 'hover:bg-muted/30',
      )}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium leading-snug text-left">{item.q}</p>
          {open
            ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
        {open && (
          <p className="mt-2.5 text-sm text-muted-foreground leading-relaxed text-left">
            {item.a}
          </p>
        )}
      </div>
    </button>
  );
}

export default function SupportPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filtered = activeCategory === 'all'
    ? FAQ
    : FAQ.filter(f => f.category === activeCategory);

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">

      {/* Header */}
      <div>
        <p className="label-wide text-primary mb-1">Support</p>
        <h1 className="heading-tight text-2xl font-bold">How can we help?</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find answers or reach out directly.</p>
      </div>

      {/* Contact cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="app-card">
          <CardContent className="pt-4 pb-4 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Workspace support</p>
              <p className="text-xs text-muted-foreground mt-0.5">Contact your administrator</p>
            </div>
            <p className="text-xs text-muted-foreground">Use your organization’s support channel</p>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardContent className="pt-4 pb-4 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Team channel</p>
              <p className="text-xs text-muted-foreground mt-0.5">Internal help and coordination</p>
            </div>
            <p className="text-xs text-muted-foreground">Ask your administrator for access</p>
          </CardContent>
        </Card>
      </div>

      {/* Legal quick links */}
      <Card className="app-card">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Legal</p>
          <div className="space-y-1">
            {[
              { icon: Shield, label: 'Privacy Policy', module: 'privacy-policy' },
              { icon: FileText, label: 'Terms of Service', module: 'terms-of-service' },
              { icon: BookOpen, label: 'Financial Disclaimer', module: 'privacy-policy' },
            ].map(({ icon: Icon, label, module }) => (
              <a
                key={label}
                href={`?module=${module}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">Frequently asked questions</h2>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {['all', ...categories].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filtered.map((item) => (
            <FaqRow key={item.q} item={item} />
          ))}
        </div>
      </div>

      {/* Financial disclaimer */}
      <Card className="app-card border-warning/20 bg-warning/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2.5">
            <TrendingUp className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-warning">Financial disclaimer</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                TW Ventures is an educational platform. Nothing on this app constitutes financial, investment,
                legal, or tax advice. Past performance is not indicative of future results.
                Always consult a qualified financial adviser before making investment decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
