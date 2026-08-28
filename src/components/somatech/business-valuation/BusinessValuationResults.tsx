import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown } from "lucide-react";
import { BusinessValuationReport } from "../types";

interface BusinessValuationResultsProps {
  report: BusinessValuationReport;
}

const BusinessValuationResults = ({ report }: BusinessValuationResultsProps) => {
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const getScenarioColor = (scenario: string) => {
    switch (scenario) {
      case 'conservative': return 'text-destructive';
      case 'base': return 'text-blue-600';
      case 'optimistic': return 'text-accent';
      default: return 'text-foreground';
    }
  };

  const getScenarioBadgeVariant = (scenario: string): "outline" | "default" | "secondary" | "destructive" => {
    switch (scenario) {
      case 'conservative': return 'destructive';
      case 'base': return 'default';
      case 'optimistic': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Valuation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Valuation Summary</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Business valuation across multiple scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.entries(report.scenarios).map(([scenario, data]) => (
              <div key={scenario} className="text-center space-y-2">
                <Badge variant={getScenarioBadgeVariant(scenario)} className="mb-2">
                  {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
                </Badge>
                <div className={`text-2xl font-bold ${getScenarioColor(scenario)}`}>
                  {formatCurrency(data.totalValue)}
                </div>
                <p className="text-sm text-muted-foreground">Business Valuation</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Valuation Method Breakdown</CardTitle>
          <CardDescription className="text-xs sm:text-sm">How each method contributes to the valuation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(report.scenarios).map(([scenario, data]) => (
              <div key={scenario}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium capitalize">{scenario} Case</h4>
                  <span className={`font-bold ${getScenarioColor(scenario)}`}>
                    {formatCurrency(data.totalValue)}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {data.revenueMultiple && (
                    <div>
                      <span className="text-muted-foreground">Revenue Multiple:</span>
                      <div className="font-semibold">{formatCurrency(data.revenueMultiple)}</div>
                    </div>
                  )}
                  {data.ebitdaMultiple && (
                    <div>
                      <span className="text-muted-foreground">EBITDA Multiple:</span>
                      <div className="font-semibold">{formatCurrency(data.ebitdaMultiple)}</div>
                    </div>
                  )}
                  {data.peMultiple && (
                    <div>
                      <span className="text-muted-foreground">P/E Multiple:</span>
                      <div className="font-semibold">{formatCurrency(data.peMultiple)}</div>
                    </div>
                  )}
                  {data.dcfValue && (
                    <div>
                      <span className="text-muted-foreground">DCF Value:</span>
                      <div className="font-semibold">{formatCurrency(data.dcfValue)}</div>
                    </div>
                  )}
                </div>
                {scenario !== 'optimistic' && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Future Projections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Financial Projections</CardTitle>
          <CardDescription className="text-xs sm:text-sm">Year-by-year financial and valuation projections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm min-w-[500px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-1 font-medium">Year</th>
                  <th className="text-right py-2 px-1 font-medium">Revenue</th>
                  <th className="text-right py-2 px-1 font-medium">EBITDA</th>
                  <th className="text-right py-2 px-1 font-medium">Net Income</th>
                  <th className="text-right py-2 px-1 font-medium">Est. Value</th>
                </tr>
              </thead>
              <tbody>
                {report.projections.map((projection, index) => (
                  <tr key={projection.year} className={index % 2 === 0 ? 'bg-muted/50' : ''}>
                    <td className="py-2 px-1 font-medium">{projection.year}</td>
                    <td className="text-right py-2 px-1">{formatCurrency(projection.revenue)}</td>
                    <td className="text-right py-2 px-1">{formatCurrency(projection.ebitda)}</td>
                    <td className="text-right py-2 px-1">{formatCurrency(projection.netIncome)}</td>
                    <td className="text-right py-2 px-1 font-semibold">{formatCurrency(projection.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sensitivity Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Sensitivity Analysis</CardTitle>
          <CardDescription className="text-xs sm:text-sm">How key variables impact your business valuation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium mb-3">Revenue Growth Impact</h4>
              <div className="space-y-2">
                {report.sensitivityAnalysis.revenueGrowthImpact.map((item) => (
                  <div key={item.growth} className="flex justify-between text-sm">
                    <span>{formatPercent(item.growth)}</span>
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Margin Impact</h4>
              <div className="space-y-2">
                {report.sensitivityAnalysis.marginImpact.map((item) => (
                  <div key={item.margin} className="flex justify-between text-sm">
                    <span>{formatPercent(item.margin)}</span>
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Multiple Impact</h4>
              <div className="space-y-2">
                {report.sensitivityAnalysis.multipleImpact.map((item) => (
                  <div key={item.multiple} className="flex justify-between text-sm">
                    <span>{item.multiple.toFixed(1)}x</span>
                    <span className="font-semibold">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BusinessValuationResults;