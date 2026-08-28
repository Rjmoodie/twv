import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, Zap, Target } from 'lucide-react';

const STRATEGIES = [
  {
    id: 'cost-leadership',
    label: 'Cost Leadership',
    icon: Shield,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    badgeBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    scope: 'Broad',
    advantage: 'Lower Cost',
    description:
      'Produce at the lowest cost in the industry and pass part of the savings to customers through lower prices — or keep prices at par and capture higher margins.',
    examples: ['Walmart', 'IKEA', 'Ryanair', 'Amazon Basics', 'McDonald\'s'],
    requirements: [
      'Relentless operational efficiency',
      'Scale / volume purchasing power',
      'Lean supply chain and logistics',
      'Tight cost controls across all functions',
      'Willingness to sacrifice premium features',
    ],
    risks: [
      'Competitors match your cost reductions',
      'Technology shift eliminates your efficiency advantage',
      'Customers value differentiation more than price',
      'Margin squeeze if price war escalates',
    ],
    whenToUse:
      'Use when the market is price-sensitive, the product is largely commoditised, and you have the scale or process advantage to sustain the cost gap.',
  },
  {
    id: 'differentiation',
    label: 'Differentiation',
    icon: Zap,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    badgeBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    scope: 'Broad',
    advantage: 'Uniqueness',
    description:
      'Offer something buyers value enough to pay a premium for. Differentiation can be product features, brand, design, customer service, or distribution.',
    examples: ['Apple', 'Mercedes-Benz', 'Dyson', 'Starbucks', 'Nike'],
    requirements: [
      'Deep customer insight and R&D capability',
      'Strong brand investment and management',
      'Premium pricing discipline',
      'Continuous innovation to stay ahead',
      'Marketing that communicates the unique value',
    ],
    risks: [
      'Differentiation premium disappears as features become standard',
      'Customers decide the extra cost isn\'t worth it',
      'Imitators close the gap faster than you can innovate',
      'Niche competitor out-differentiates you in a sub-segment',
    ],
    whenToUse:
      'Use when customers have heterogeneous preferences, willingness-to-pay varies widely, and your brand or IP can protect the premium long enough to recoup investment.',
  },
  {
    id: 'focus-cost',
    label: 'Focus — Cost',
    icon: Target,
    color: 'text-accent dark:text-accent',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    badgeBg: 'bg-emerald-100 text-accent dark:bg-emerald-900/40 dark:text-accent',
    scope: 'Narrow',
    advantage: 'Lower Cost',
    description:
      'Serve a specific segment — geography, demographic, or use-case — at lower cost than anyone else targeting that niche.',
    examples: ['Dollar General (rural)', 'Spirit Airlines', 'Aldi'],
    requirements: [
      'Precise niche selection with defined customer profile',
      'Cost advantage specific to that niche\'s needs',
      'Resistance to broad-market players entering the niche',
    ],
    risks: [
      'Niche shrinks or disappears',
      'Broad cost leaders decide the niche is worth attacking',
      'Segment needs evolve beyond your narrow offer',
    ],
    whenToUse:
      'Use when a segment exists that is underserved by broad-market players and has cost dynamics that favour a specialist.',
  },
  {
    id: 'focus-diff',
    label: 'Focus — Differentiation',
    icon: Target,
    color: 'text-warning dark:text-warning',
    bg: 'bg-warning/100/5',
    border: 'border-warning/20/20',
    badgeBg: 'bg-warning/10 text-warning dark:bg-warning/15/40 dark:text-warning',
    scope: 'Narrow',
    advantage: 'Uniqueness',
    description:
      'Serve a specific segment with a uniquely tailored offer that broad differentiators cannot match because they must serve many segments at once.',
    examples: ['Rolls-Royce', 'Peloton', 'Patagonia', 'Lululemon (early)'],
    requirements: [
      'Narrow, well-defined target segment',
      'Offer meaningfully customised to that segment\'s specific needs',
      'Premium pricing that the niche will pay',
    ],
    risks: [
      'Niche demand too small for sustainable returns',
      'Broad differentiators add niche-specific variants',
      'Entrants target the same niche with lower costs',
    ],
    whenToUse:
      'Use when a segment has very specific needs that the mass market ignores and is willing to pay a significant premium for a tailored solution.',
  },
] as const;

type StrategyId = typeof STRATEGIES[number]['id'];

const STUCK_IN_MIDDLE = {
  label: 'Stuck in the Middle',
  description:
    'Porter warned that trying to pursue both low cost and differentiation simultaneously — without a clear focus — leads to being "stuck in the middle." The firm achieves neither the lowest cost nor a differentiated premium, and earns below-average returns.',
  examples: ['Sears (historical)', 'Kodak (late period)', 'Kmart'],
};

const SELF_ASSESSMENT: { question: string; costHint: string; diffHint: string }[] = [
  {
    question: 'What do your best customers say is the main reason they buy from you?',
    costHint: '"Cheapest option / best value for money"',
    diffHint: '"Best product / brand / service / unique features"',
  },
  {
    question: 'Where do you invest most of your margin improvement effort?',
    costHint: 'Cutting costs, automating operations, supply chain efficiency',
    diffHint: 'Product R&D, brand marketing, customer experience',
  },
  {
    question: 'Who is your primary competition?',
    costHint: 'Other low-cost providers in the same broad market',
    diffHint: 'Other premium or specialised providers',
  },
  {
    question: 'What happens if a rival undercuts your price by 10%?',
    costHint: 'Significant customer loss — price is the main differentiator',
    diffHint: 'Minimal defection — customers loyal to the brand/product',
  },
];

export default function PortersStrategies() {
  const [selected, setSelected] = useState<StrategyId | null>(null);

  const active = STRATEGIES.find((s) => s.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Porter's three generic strategies define how a firm achieves a sustainable competitive advantage. Every business must choose — or risk being stuck in the middle.
      </p>

      {/* 2×2 strategy grid */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground font-medium">
          <span />
          <span className="text-center">Lower Cost</span>
          <span className="text-center">Uniqueness</span>
        </div>
        <div className="grid grid-cols-3 gap-1 items-stretch text-xs">
          {/* Row labels */}
          <div className="flex flex-col gap-1">
            <div className="flex-1 flex items-center justify-end pr-2">
              <span className="text-[10px] text-muted-foreground font-medium text-right">Broad</span>
            </div>
            <div className="flex-1 flex items-center justify-end pr-2">
              <span className="text-[10px] text-muted-foreground font-medium text-right">Narrow</span>
            </div>
          </div>
          {/* Cost Leadership */}
          <button
            onClick={() => setSelected(selected === 'cost-leadership' ? null : 'cost-leadership')}
            className={`rounded-xl border p-3 text-left transition-all hover:scale-[1.02] ${
              selected === 'cost-leadership'
                ? 'border-blue-500/60 bg-blue-500/10 ring-1 ring-blue-500/30'
                : 'border-border bg-card hover:border-blue-500/30 hover:bg-blue-500/5'
            }`}
          >
            <p className="font-semibold text-xs text-blue-600 dark:text-blue-400">Cost Leadership</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Broad market, price advantage</p>
          </button>
          {/* Differentiation */}
          <button
            onClick={() => setSelected(selected === 'differentiation' ? null : 'differentiation')}
            className={`rounded-xl border p-3 text-left transition-all hover:scale-[1.02] ${
              selected === 'differentiation'
                ? 'border-purple-500/60 bg-purple-500/10 ring-1 ring-purple-500/30'
                : 'border-border bg-card hover:border-purple-500/30 hover:bg-purple-500/5'
            }`}
          >
            <p className="font-semibold text-xs text-purple-600 dark:text-purple-400">Differentiation</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Broad market, unique value</p>
          </button>
          {/* Focus Cost */}
          <button
            onClick={() => setSelected(selected === 'focus-cost' ? null : 'focus-cost')}
            className={`rounded-xl border p-3 text-left transition-all hover:scale-[1.02] ${
              selected === 'focus-cost'
                ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                : 'border-border bg-card hover:border-emerald-500/30 hover:bg-emerald-500/5'
            }`}
          >
            <p className="font-semibold text-xs text-accent dark:text-accent">Focus — Cost</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Niche market, cost advantage</p>
          </button>
          {/* Focus Differentiation */}
          <button
            onClick={() => setSelected(selected === 'focus-diff' ? null : 'focus-diff')}
            className={`rounded-xl border p-3 text-left transition-all hover:scale-[1.02] ${
              selected === 'focus-diff'
                ? 'border-warning/20/60 bg-warning/100/10 ring-1 ring-amber-500/30'
                : 'border-border bg-card hover:border-warning/20/30 hover:bg-warning/100/5'
            }`}
          >
            <p className="font-semibold text-xs text-warning dark:text-warning">Focus — Differentiation</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Niche market, unique value</p>
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">Click a strategy to expand the detail view.</p>
      </div>

      {/* Detail panel */}
      {active && (
        <Card className={`border ${active.border} ${active.bg}`}>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <active.icon className={`h-4 w-4 ${active.color}`} />
              <p className={`font-semibold text-sm ${active.color}`}>{active.label}</p>
              <Badge variant="secondary" className={`text-[10px] ${active.badgeBg}`}>{active.scope} scope</Badge>
              <Badge variant="secondary" className={`text-[10px] ${active.badgeBg}`}>{active.advantage}</Badge>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{active.description}</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold mb-1.5">Key requirements</p>
                <ul className="space-y-1">
                  {active.requirements.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className={`mt-0.5 font-bold ${active.color}`}>·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5">Risks</p>
                <ul className="space-y-1">
                  {active.risks.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                      <span className="mt-0.5 font-bold text-destructive">·</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold mb-1.5">Real-world examples</p>
              <div className="flex flex-wrap gap-1.5">
                {active.examples.map((e) => (
                  <Badge key={e} variant="secondary" className={`text-[10px] ${active.badgeBg}`}>{e}</Badge>
                ))}
              </div>
            </div>

            <div className={`rounded-lg border ${active.border} p-3`}>
              <p className="text-xs font-semibold mb-1">When to use</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{active.whenToUse}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stuck in the middle warning */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 space-y-2">
        <p className="text-xs font-semibold text-destructive">⚠ Stuck in the Middle</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{STUCK_IN_MIDDLE.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {STUCK_IN_MIDDLE.examples.map((e) => (
            <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
          ))}
        </div>
      </div>

      {/* Self-assessment */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Self-assessment questions</p>
        <div className="space-y-3">
          {SELF_ASSESSMENT.map((q, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-medium">{i + 1}. {q.question}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 p-2">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold mb-0.5">Cost Leadership signal</p>
                  <p className="text-[10px] text-muted-foreground">{q.costHint}</p>
                </div>
                <div className="rounded-lg bg-purple-500/5 border border-purple-500/20 p-2">
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold mb-0.5">Differentiation signal</p>
                  <p className="text-[10px] text-muted-foreground">{q.diffHint}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Porter's framework does not preclude operational excellence — every firm should be efficient. The strategy determines where the competitive advantage comes from, not whether you should manage costs carefully.
      </p>
    </div>
  );
}
