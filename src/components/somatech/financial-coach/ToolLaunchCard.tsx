import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Calculator, Home, TrendingDown, PiggyBank, Target, Leaf, BarChart2, Percent } from 'lucide-react';

const TOOL_META: Record<string, { label: string; description: string; icon: React.ReactNode; moduleId: string }> = {
  'rent-vs-own': {
    label: 'Rent vs. Own Calculator',
    description: 'See your 5% rule break-even rent based on home price.',
    icon: <Home className="h-4 w-4" />,
    moduleId: 'rent-vs-own',
  },
  'opportunity-cost': {
    label: 'Opportunity Cost Visualizer',
    description: 'See what any spending decision costs in compounded future value.',
    icon: <TrendingDown className="h-4 w-4" />,
    moduleId: 'opportunity-cost',
  },
  'true-cost-ownership': {
    label: 'True Cost of Homeownership',
    description: 'All the unrecoverable costs most buyers miss.',
    icon: <Calculator className="h-4 w-4" />,
    moduleId: 'true-cost-ownership',
  },
  'cost-of-conservatism': {
    label: 'Cost of Conservatism',
    description: 'What your overly-safe portfolio is costing you per year.',
    icon: <TrendingDown className="h-4 w-4" />,
    moduleId: 'cost-of-conservatism',
  },
  'retirement-planning': {
    label: 'Retirement Planner',
    description: 'Model your retirement with compounding projections.',
    icon: <PiggyBank className="h-4 w-4" />,
    moduleId: 'retirement-planning',
  },
  'perma-goals': {
    label: 'PERMA Goal Alignment',
    description: 'Check if your spending maps to what actually makes you happy.',
    icon: <Target className="h-4 w-4" />,
    moduleId: 'perma-goals',
  },
  'capital-budgeting': {
    label: 'Capital Budgeting',
    description: 'NPV, IRR, and payback period — should you make the investment?',
    icon: <BarChart2 className="h-4 w-4" />,
    moduleId: 'capital-budgeting',
  },
  'financial-ratios': {
    label: 'Financial Ratio Calculator',
    description: 'All four ratio categories — profitability, liquidity, activity, leverage.',
    icon: <Percent className="h-4 w-4" />,
    moduleId: 'financial-ratios',
  },
};

interface ToolLaunchCardProps {
  type: string;
  prefill: Record<string, unknown>;
  onLaunch: (type: string, prefill: Record<string, unknown>) => void;
}

export default function ToolLaunchCard({ type, prefill, onLaunch }: ToolLaunchCardProps) {
  const meta = TOOL_META[type];
  if (!meta) return null;

  return (
    <div className="border border-primary/20 bg-primary/5 rounded-xl p-3.5 flex items-start gap-3 max-w-xs">
      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground leading-tight">{meta.label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
        <Button
          size="sm"
          variant="default"
          className="mt-2 h-7 text-xs gap-1.5"
          onClick={() => onLaunch(type, prefill)}
        >
          Open tool
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
