import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatCurrencyFull } from "./retirementUtils";

interface RetirementResult {
  totalSavingsAtRetirement: number;
  yearsToRetirement: number;
  yearsInRetirement: number;
  inflationAdjustedSpending: number;
  annualIncomeGap: number;
  surplusOrShortfall: number;
  requiredReturnToMeetGoal: number;
  yearsWillLast: number;
  onTrack: boolean;
  breakdown?: {
    futureValueCurrentSavings: number;
    futureValueContributions: number;
    actualMonthlyContribution: number;
  };
}

interface RetirementResultsProps {
  result: RetirementResult;
}

const RetirementResults = ({ result }: RetirementResultsProps) => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg sm:text-xl">Retirement Analysis Results</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Primary Result */}
          <div className="text-center p-4 bg-gradient-to-r from-primary/10 to-primary/20 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h3 className="text-lg sm:text-xl font-semibold">Total at Retirement</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <InfoIcon className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <div className="space-y-2 text-sm">
                      <p><strong>Calculation Breakdown:</strong></p>
                      {result.breakdown && (
                        <>
                          <p>• Current savings grown: {formatCurrency(result.breakdown.futureValueCurrentSavings)}</p>
                          <p>• Future contributions: {formatCurrency(result.breakdown.futureValueContributions)}</p>
                          <p>• Monthly contribution: {formatCurrencyFull(result.breakdown.actualMonthlyContribution)}</p>
                        </>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">This is in future dollars, not today's purchasing power.</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-primary">
              {formatCurrency(result.totalSavingsAtRetirement)}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center p-3 bg-card rounded-lg border">
              <span className="text-sm font-medium text-muted-foreground">Years to retirement</span>
              <span className="text-lg font-semibold mt-1 sm:mt-0">{result.yearsToRetirement}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center p-3 bg-card rounded-lg border">
              <span className="text-sm font-medium text-muted-foreground">Years in retirement</span>
              <span className="text-lg font-semibold mt-1 sm:mt-0">{result.yearsInRetirement}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center p-3 bg-card rounded-lg border">
              <span className="text-sm font-medium text-muted-foreground">Annual income gap</span>
              <span className="text-lg font-semibold mt-1 sm:mt-0">{formatCurrencyFull(result.annualIncomeGap)}</span>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center p-3 bg-card rounded-lg border">
              <span className="text-sm font-medium text-muted-foreground">Funds will last</span>
              <span className="text-lg font-semibold mt-1 sm:mt-0">{result.yearsWillLast} years</span>
            </div>
          </div>

          {/* Status Cards */}
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="font-medium">Surplus/Shortfall</span>
                <Badge 
                  variant={result.surplusOrShortfall >= 0 ? "default" : "destructive"}
                  className="text-sm"
                >
                  {formatCurrency(Math.abs(result.surplusOrShortfall))} 
                  {result.surplusOrShortfall >= 0 ? ' surplus' : ' shortfall'}
                </Badge>
              </div>
            </div>
            
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="font-medium">Required return to meet goal</span>
                <Badge variant="secondary" className="text-sm">
                  {result.requiredReturnToMeetGoal}%
                </Badge>
              </div>
            </div>
            
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <span className="font-medium">Retirement Goal Status</span>
                <Badge 
                  variant={result.onTrack ? "default" : "destructive"}
                  className="text-sm"
                >
                  {result.onTrack ? 'On Track ✓' : 'Needs Adjustment ⚠️'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Calculation Explanation */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
            <h4 className="font-semibold mb-2 text-sm">How we calculate your total savings:</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Current savings grown with compound interest over time</li>
              <li>• Future contributions with compound growth</li>
              <li>• Inflation adjustments for spending needs</li>
              <li>• Conservative projections for retirement duration</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RetirementResults;