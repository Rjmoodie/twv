import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Shield, AlertTriangle, TrendingUp, Zap } from 'lucide-react';

interface SWOTCategory {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  colorClass: string;
  borderClass: string;
  badgeClass: string;
  placeholder: string;
}

const CATEGORIES: SWOTCategory[] = [
  {
    label: 'Strengths',
    subtitle: 'Internal advantages',
    icon: <Shield className="h-4 w-4" />,
    colorClass: 'bg-emerald-500/5 hover:bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    badgeClass: 'bg-emerald-100 text-accent dark:bg-emerald-900/40 dark:text-accent',
    placeholder: 'e.g. Strong brand recognition, proprietary technology, high customer retention…',
  },
  {
    label: 'Weaknesses',
    subtitle: 'Internal gaps',
    icon: <AlertTriangle className="h-4 w-4" />,
    colorClass: 'bg-destructive/100/5 hover:bg-destructive/100/10',
    borderClass: 'border-destructive/20/30',
    badgeClass: 'bg-destructive/10 text-destructive dark:bg-destructive/10/40 dark:text-destructive',
    placeholder: 'e.g. High customer acquisition cost, limited geographic reach, key-person dependency…',
  },
  {
    label: 'Opportunities',
    subtitle: 'External tailwinds',
    icon: <TrendingUp className="h-4 w-4" />,
    colorClass: 'bg-blue-500/5 hover:bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    placeholder: 'e.g. Underserved market segment, emerging technology, regulatory tailwind…',
  },
  {
    label: 'Threats',
    subtitle: 'External risks',
    icon: <Zap className="h-4 w-4" />,
    colorClass: 'bg-warning/100/5 hover:bg-warning/100/10',
    borderClass: 'border-warning/20/30',
    badgeClass: 'bg-warning/10 text-warning dark:bg-warning/15/40 dark:text-warning',
    placeholder: 'e.g. New entrants, shifting consumer preferences, unfavourable regulation…',
  },
];

interface SWOTState {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

const KEY: Record<string, keyof SWOTState> = {
  Strengths: 'strengths',
  Weaknesses: 'weaknesses',
  Opportunities: 'opportunities',
  Threats: 'threats',
};

export default function SWOTAnalysis() {
  const [items, setItems] = useState<SWOTState>({
    strengths: [],
    weaknesses: [],
    opportunities: [],
    threats: [],
  });
  const [drafts, setDrafts] = useState<Record<string, string>>({
    Strengths: '',
    Weaknesses: '',
    Opportunities: '',
    Threats: '',
  });

  const addItem = (label: string) => {
    const key = KEY[label];
    const text = drafts[label].trim();
    if (!text) return;
    setItems((prev) => ({ ...prev, [key]: [...prev[key], text] }));
    setDrafts((prev) => ({ ...prev, [label]: '' }));
  };

  const removeItem = (label: string, idx: number) => {
    const key = KEY[label];
    setItems((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  const total = Object.values(items).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground space-y-1">
        <p>Map the business position using the SWOT framework. <strong>Strengths and weaknesses are internal</strong> — within the company. <strong>Opportunities and threats are external</strong> — market forces acting on it.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map((cat) => {
          const key = KEY[cat.label] as keyof SWOTState;
          const catItems = items[key];
          return (
            <div
              key={cat.label}
              className={`rounded-xl border p-4 space-y-3 transition-colors ${cat.colorClass} ${cat.borderClass}`}
            >
              {/* Header */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${cat.badgeClass}`}>
                  {cat.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold leading-none">{cat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.subtitle}</p>
                </div>
                {catItems.length > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {catItems.length}
                  </Badge>
                )}
              </div>

              {/* Existing items */}
              {catItems.length > 0 && (
                <ul className="space-y-1.5">
                  {catItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 group">
                      <span className="text-xs text-muted-foreground mt-0.5 shrink-0">•</span>
                      <span className="text-sm flex-1 leading-snug">{item}</span>
                      <button
                        onClick={() => removeItem(cat.label, i)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Input area */}
              <div className="space-y-2">
                <Textarea
                  value={drafts[cat.label]}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [cat.label]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      addItem(cat.label);
                    }
                  }}
                  placeholder={cat.placeholder}
                  className="text-sm min-h-[60px] resize-none bg-background/60"
                  rows={2}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs gap-1"
                  onClick={() => addItem(cat.label)}
                  disabled={!drafts[cat.label].trim()}
                >
                  <Plus className="h-3 w-3" />
                  Add point
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary strip */}
      {total > 0 && (
        <div className="rounded-xl bg-muted/40 border border-border p-4 space-y-2">
          <p className="text-sm font-semibold">Strategic read</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            {CATEGORIES.map((cat) => (
              <div key={cat.label}>
                <p className="text-muted-foreground">{cat.label}</p>
                <p className="text-2xl font-bold mt-0.5">{items[KEY[cat.label] as keyof SWOTState].length}</p>
              </div>
            ))}
          </div>
          {items.strengths.length > 0 && items.opportunities.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              SO strategy: use <strong>{items.strengths[0]}</strong> to capture <strong>{items.opportunities[0]}</strong>.
            </p>
          )}
          {items.weaknesses.length > 0 && items.threats.length > 0 && (
            <p className="text-xs text-muted-foreground">
              WT risk: <strong>{items.weaknesses[0]}</strong> makes the business vulnerable to <strong>{items.threats[0]}</strong>.
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Porter's insight: turn strengths into competitive advantage by choosing Cost Leadership, Differentiation, Cost Focus, or Differentiation Focus as your primary strategy.
      </p>
    </div>
  );
}
