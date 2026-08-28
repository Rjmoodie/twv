import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail, MessageCircle, FileText, Shield, BookOpen,
  ChevronDown, ChevronUp, ExternalLink, HelpCircle,
  CreditCard, Lock, Smartphone, TrendingUp,
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
    q: 'How do I reset my password?',
    a: 'On the sign-in screen tap "Forgot password?" and enter your email. You\'ll receive a reset link within a few minutes. Check your spam folder if it doesn\'t arrive.',
  },
  {
    category: 'Account',
    q: 'Can I change my email address?',
    a: 'Email changes are handled via support. Email support@somatech.pro from your current address with your new email and we\'ll update it for you.',
  },
  {
    category: 'Billing',
    q: 'How do I cancel my subscription?',
    a: 'Go to Account → Data & Billing → Manage billing. This opens the Stripe billing portal where you can cancel at any time. Your access continues until the end of the current billing period.',
  },
  {
    category: 'Billing',
    q: 'Can I get a refund?',
    a: 'We offer refunds within 3 days of purchase if you haven\'t used premium features. For billing errors or other issues, email support@somatech.pro within 7 days of your charge.',
  },
  {
    category: 'Billing',
    q: 'What\'s included in each plan?',
    a: 'Free includes dashboard, watchlist, financial journey, and 2 Plaid bank connections. Planner ($15/mo) adds AI coaching, real estate tools, and valuation. Investor ($35/mo) adds stock analysis, options, PDUFA, earnings, and portfolio tools. Complete ($50/mo) includes everything plus courses and live sessions.',
  },
  {
    category: 'Data & Privacy',
    q: 'How is my financial data stored?',
    a: 'Your data is encrypted at rest and in transit. Bank connections via Plaid are read-only — SomaTech cannot move money. We never sell your personal data to third parties.',
  },
  {
    category: 'Data & Privacy',
    q: 'How do I delete my account?',
    a: 'Go to Account → Data & Billing → Delete account. Type DELETE to confirm. This permanently removes all your data from our servers within 30 days, as required by GDPR.',
  },
  {
    category: 'Data & Privacy',
    q: 'Can I export my data?',
    a: 'Yes. Go to Account → Data & Billing → Download my data. This exports all your financial snapshots, journey posts, and profile data as a JSON file.',
  },
  {
    category: 'Features',
    q: 'Is the financial coach real financial advice?',
    a: 'No. SomaTech\'s AI coach provides educational information based on your profile. It is not a regulated financial adviser. Always consult a qualified professional before making financial decisions.',
  },
  {
    category: 'Features',
    q: 'How does Plaid bank connection work?',
    a: 'Plaid is a secure third-party service that connects to your bank with read-only access. SomaTech uses this to automatically update your net worth and cash flow. You can disconnect at any time from Account → Banks.',
  },
  {
    category: 'Technical',
    q: 'The app isn\'t loading correctly. What should I do?',
    a: 'Try force-closing and reopening the app. If the problem persists, go to Settings → clear app cache, or uninstall and reinstall. If still broken, email support@somatech.pro with your device model and iOS version.',
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
              <p className="text-sm font-semibold">Email support</p>
              <p className="text-xs text-muted-foreground mt-0.5">We reply within 24 hours</p>
            </div>
            <a
              href="mailto:support@somatech.pro"
              className="text-xs text-primary hover:underline underline-offset-2 font-medium"
            >
              support@somatech.pro
            </a>
          </CardContent>
        </Card>

        <Card className="app-card">
          <CardContent className="pt-4 pb-4 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Discord</p>
              <p className="text-xs text-muted-foreground mt-0.5">Community + live chat</p>
            </div>
            <p className="text-xs text-muted-foreground">Included in Investor & Complete plans</p>
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
                SomaTech is an educational platform. Nothing on this app constitutes financial, investment,
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
