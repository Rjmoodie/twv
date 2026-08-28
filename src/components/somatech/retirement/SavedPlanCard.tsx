import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, TrendingUp } from "lucide-react";
import { SavedPlan } from "./retirementOperations";
import { formatCurrency } from "./retirementUtils";

interface SavedPlanCardProps {
  plan: SavedPlan;
  onLoad: () => void;
  onDelete: () => void;
}

/**
 * Card component for displaying saved retirement plans
 */
export const SavedPlanCard = ({ plan, onLoad, onDelete }: SavedPlanCardProps) => {
  const getTrackingBadge = (onTrack: boolean) => (
    <Badge variant={onTrack ? "default" : "destructive"} className="text-xs">
      {onTrack ? "On Track" : "Needs Attention"}
    </Badge>
  );

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onLoad}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-1">{plan.plan_name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Created: {new Date(plan.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {getTrackingBadge(plan.results.onTrack)}
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                aria-label={`Delete ${plan.plan_name}`}
                title="Delete plan"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Current Age</p>
            <p className="font-medium">{plan.inputs.currentAge}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Retirement Age</p>
            <p className="font-medium">{plan.inputs.retirementAge}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Current Savings</p>
            <p className="font-medium">{formatCurrency(plan.inputs.currentSavings)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Annual Contribution</p>
            <p className="font-medium">{formatCurrency(plan.inputs.monthlyContribution)}</p>
          </div>
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total at Retirement</span>
            <span className="font-semibold text-primary">
              {formatCurrency(plan.results.totalSavingsAtRetirement)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Surplus/Shortfall</span>
            <div className="flex items-center gap-1">
              <TrendingUp 
                className={`h-3 w-3 ${
                  plan.results.surplusOrShortfall >= 0 ? 'text-accent' : 'text-destructive'
                }`} 
              />
              <span className={`font-medium ${
                plan.results.surplusOrShortfall >= 0 ? 'text-accent' : 'text-destructive'
              }`}>
                {formatCurrency(Math.abs(plan.results.surplusOrShortfall))}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Funds Will Last</span>
            <span className="font-medium">
              {plan.results.yearsWillLast} years
            </span>
          </div>
        </div>

        {plan.notes && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground line-clamp-2">{plan.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
