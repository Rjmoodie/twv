import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CashFlowReport } from "../types";
import { AlertTriangle, TrendingUp, TrendingDown, DollarSign } from "lucide-react";

interface CashFlowResultsProps {
  report: CashFlowReport;
  onScenarioChange: (scenario: 'conservative' | 'base' | 'optimistic') => void;
  activeScenario: 'conservative' | 'base' | 'optimistic';
}

const CashFlowResults = ({ report, onScenarioChange, activeScenario }: CashFlowResultsProps) => {
  const currentScenario = report.scenarios[activeScenario];
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRunwayColor = (runway: number) => {
    if (!Number.isFinite(runway)) return "text-accent";   // never depletes
    if (runway <= 3) return "text-destructive";
    if (runway <= 6) return "text-warning";
    return "text-accent";
  };

  const getCashFlowIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-4 w-4 text-accent" />;
    if (value < 0) return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <DollarSign className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Scenario Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Scenario Analysis</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Compare different scenarios for your cash flow projection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            <Button
              variant={activeScenario === 'conservative' ? 'default' : 'outline'}
              onClick={() => onScenarioChange('conservative')}
              size="sm"
              className="px-2 sm:px-4 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Conservative</span>
              <span className="sm:hidden">Cons</span>
            </Button>
            <Button
              variant={activeScenario === 'base' ? 'default' : 'outline'}
              onClick={() => onScenarioChange('base')}
              size="sm"
              className="px-2 sm:px-4 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Base Case</span>
              <span className="sm:hidden">Base</span>
            </Button>
            <Button
              variant={activeScenario === 'optimistic' ? 'default' : 'outline'}
              onClick={() => onScenarioChange('optimistic')}
              size="sm"
              className="px-2 sm:px-4 text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Optimistic</span>
              <span className="sm:hidden">Opt</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Ending Cash</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(currentScenario.endingCash)}
            </div>
            <div className={`text-sm ${currentScenario.endingCash > report.inputs.startingCash ? 'text-accent' : 'text-destructive'}`}>
              {currentScenario.endingCash > report.inputs.startingCash ? 'Cash Positive' : 'Cash Negative'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              {getCashFlowIcon(currentScenario.avgMonthlyCashFlow)}
              <span className="text-sm font-medium">Avg Monthly Flow</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {formatCurrency(currentScenario.avgMonthlyCashFlow)}
            </div>
            <div className="text-sm text-muted-foreground">
              Per month average
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Cash Runway</span>
            </div>
            <div className={`text-2xl font-bold mt-1 ${getRunwayColor(currentScenario.runway)}`}>
              {Number.isFinite(currentScenario.runway) ? `${currentScenario.runway} months` : 'Infinite'}
            </div>
            <div className="text-sm text-muted-foreground">
              Until cash depleted
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Break-even Month</span>
            </div>
            <div className="text-2xl font-bold mt-1">
              {currentScenario.breakEvenMonth > 0 ? `Month ${currentScenario.breakEvenMonth}` : 'N/A'}
            </div>
            <div className="text-sm text-muted-foreground">
              Positive cash flow
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Flow Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Monthly Cash Flow Timeline</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Detailed month-by-month projection for {activeScenario} scenario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="text-xs sm:text-sm">
              <TabsTrigger value="summary" className="px-2 sm:px-4">Summary</TabsTrigger>
              <TabsTrigger value="detailed" className="px-2 sm:px-4">Detailed</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium">Key Months</h4>
                  {currentScenario.keyMilestones.map((milestone, index) => (
                    <div key={index} className="flex justify-between p-3 bg-muted rounded-lg">
                      <span className="font-medium">{milestone.description}</span>
                      <Badge variant={milestone.type === 'warning' ? 'destructive' : 'default'}>
                        Month {milestone.month}
                      </Badge>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <h4 className="font-medium">Financial Summary</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Inflows:</span>
                      <span className="font-medium text-accent">
                        {formatCurrency(currentScenario.totalInflows)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Outflows:</span>
                      <span className="font-medium text-destructive">
                        {formatCurrency(currentScenario.totalOutflows)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-medium">Net Change:</span>
                      <span className={`font-bold ${currentScenario.totalInflows - currentScenario.totalOutflows >= 0 ? 'text-accent' : 'text-destructive'}`}>
                        {formatCurrency(currentScenario.totalInflows - currentScenario.totalOutflows)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="detailed" className="space-y-4">
              <div className="max-h-96 overflow-y-auto overflow-x-auto">
                <div className="grid grid-cols-6 gap-1 sm:gap-2 text-xs sm:text-sm font-medium border-b pb-2 mb-2 min-w-[500px]">
                  <span>Month</span>
                  <span>Inflows</span>
                  <span>Outflows</span>
                  <span>Net Flow</span>
                  <span>Cash Balance</span>
                  <span>Status</span>
                </div>
                
                {currentScenario.monthlyProjections.map((month, index) => (
                  <div key={index} className="grid grid-cols-6 gap-1 sm:gap-2 text-xs sm:text-sm py-1 sm:py-2 border-b min-w-[500px]">
                    <span className="font-medium">{month.month}</span>
                    <span className="text-accent truncate">{formatCurrency(month.inflows)}</span>
                    <span className="text-destructive truncate">{formatCurrency(month.outflows)}</span>
                    <span className={`truncate ${month.netFlow >= 0 ? 'text-accent' : 'text-destructive'}`}>
                      {formatCurrency(month.netFlow)}
                    </span>
                    <span className={`truncate ${month.cashBalance >= 0 ? 'font-medium' : 'font-medium text-destructive'}`}>
                      {formatCurrency(month.cashBalance)}
                    </span>
                    <Badge 
                      variant={month.cashBalance < 0 ? 'destructive' : month.cashBalance < 10000 ? 'secondary' : 'default'}
                      className="text-[10px] sm:text-xs px-1"
                    >
                      {month.cashBalance < 0 ? 'Critical' : month.cashBalance < 10000 ? 'Low' : 'Healthy'}
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Alerts and Recommendations */}
      {currentScenario.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alerts & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentScenario.alerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-warning/10 border border-orange-200 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-warning">{alert.title}</p>
                    <p className="text-sm text-warning">{alert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CashFlowResults;