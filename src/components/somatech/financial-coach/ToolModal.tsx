import React, { Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

const RentVsOwnTool = lazyWithRetry(() => import('./tools/RentVsOwnTool'));
const OpportunityCostTool = lazyWithRetry(() => import('./tools/OpportunityCostTool'));
const CostOfConservatismTool = lazyWithRetry(() => import('./tools/CostOfConservatismTool'));
const PermaGoalsTool = lazyWithRetry(() => import('./tools/PermaGoalsTool'));
const CapitalBudgetingTool = lazyWithRetry(() => import('./tools/CapitalBudgetingTool'));
const FinancialRatiosTool = lazyWithRetry(() => import('./tools/FinancialRatiosTool'));

const TOOL_TITLES: Record<string, string> = {
  'rent-vs-own': 'Rent vs. Own — The 5% Rule',
  'opportunity-cost': 'Opportunity Cost Visualizer',
  'true-cost-ownership': 'True Cost of Homeownership',
  'cost-of-conservatism': 'Cost of Conservatism',
  'retirement-planning': 'Retirement Planner',
  'perma-goals': 'PERMA Goal Alignment',
  'capital-budgeting': 'Capital Budgeting — NPV & IRR',
  'financial-ratios': 'Financial Ratio Calculator',
};

interface ToolModalProps {
  toolType: string | null;
  prefill: Record<string, unknown>;
  onClose: () => void;
  onNavigate?: (moduleId: string) => void;
}

function ToolContent({ type, prefill }: { type: string; prefill: Record<string, unknown> }) {
  switch (type) {
    case 'rent-vs-own':
    case 'true-cost-ownership':
      return <RentVsOwnTool prefill={prefill as any} />;
    case 'opportunity-cost':
      return <OpportunityCostTool prefill={prefill as any} />;
    case 'cost-of-conservatism':
      return <CostOfConservatismTool prefill={prefill as any} />;
    case 'perma-goals':
      return <PermaGoalsTool />;
    case 'capital-budgeting':
      return <CapitalBudgetingTool prefill={prefill as any} />;
    case 'financial-ratios':
      return <FinancialRatiosTool />;
    default:
      return (
        <p className="text-sm text-muted-foreground py-8 text-center">
          This tool is launching… if it doesn't open automatically, navigate to it from the sidebar.
        </p>
      );
  }
}

export default function ToolModal({ toolType, prefill, onClose }: ToolModalProps) {
  return (
    <Dialog open={!!toolType} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{toolType ? TOOL_TITLES[toolType] ?? 'Financial Tool' : ''}</DialogTitle>
        </DialogHeader>
        {toolType && (
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <ToolContent type={toolType} prefill={prefill} />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
