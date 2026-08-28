import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BarChart, GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { SavedDeal } from "./brrrrCalculations";
import { formatCurrency, formatPercentage } from "./realEstateUtils";

interface DealComparisonProps {
  savedDeals: SavedDeal[];
}

export const DealComparison = ({ savedDeals }: DealComparisonProps) => {
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const handleDealToggle = (dealId: string) => {
    setSelectedDeals(prev => 
      prev.includes(dealId) 
        ? prev.filter(id => id !== dealId)
        : [...prev, dealId].slice(0, 3) // Limit to 3 comparisons
    );
  };

  const comparisonDeals = savedDeals.filter(deal => selectedDeals.includes(deal.id));

  const getMetricComparison = (value: number, allValues: number[]) => {
    const max = Math.max(...allValues);
    const min = Math.min(...allValues);
    
    if (value === max && max !== min) return { icon: TrendingUp, color: "text-accent" };
    if (value === min && max !== min) return { icon: TrendingDown, color: "text-destructive" };
    return { icon: Minus, color: "text-muted-foreground" };
  };

  const metrics = [
    { key: 'purchasePrice', label: 'Purchase Price', format: formatCurrency },
    { key: 'totalInvestment', label: 'Total Investment', format: formatCurrency },
    { key: 'postRefinanceROI', label: 'Post-Refi ROI', format: formatPercentage },
    { key: 'postRefinanceCashFlow', label: 'Monthly Cash Flow', format: formatCurrency },
    { key: 'cashOutAmount', label: 'Cash Out', format: formatCurrency },
    { key: 'equityCreated', label: 'Equity Created', format: formatCurrency },
  ];

  const getMetricValue = (deal: SavedDeal, metricKey: string) => {
    if (metricKey === 'purchasePrice') return deal.inputs.purchasePrice;
    return (deal.results as any)[metricKey];
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={savedDeals.length < 2}>
          <GitCompare className="h-4 w-4" />
          Compare Deals
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart className="h-5 w-5" />
            Deal Comparison
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Deal Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Deals to Compare</CardTitle>
              <CardDescription>Choose up to 3 deals for side-by-side comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedDeals.map((deal) => (
                  <div key={deal.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={deal.id}
                      checked={selectedDeals.includes(deal.id)}
                      onCheckedChange={() => handleDealToggle(deal.id)}
                      disabled={!selectedDeals.includes(deal.id) && selectedDeals.length >= 3}
                    />
                    <div className="flex-1 min-w-0">
                      <label htmlFor={deal.id} className="font-medium text-sm cursor-pointer">
                        {deal.deal_name}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {formatPercentage(deal.results.postRefinanceROI)} ROI • {formatCurrency(deal.inputs.purchasePrice)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          {comparisonDeals.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Comparison Results</CardTitle>
                <CardDescription>
                  Comparing {comparisonDeals.length} selected deals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Metric</th>
                        {comparisonDeals.map((deal) => (
                          <th key={deal.id} className="text-left p-2 font-medium min-w-32">
                            <div className="truncate" title={deal.deal_name}>
                              {deal.deal_name}
                            </div>
                            <div className="text-xs text-muted-foreground font-normal">
                              {new Date(deal.created_at).toLocaleDateString()}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((metric) => {
                        const values = comparisonDeals.map(deal => getMetricValue(deal, metric.key));
                        
                        return (
                          <tr key={metric.key} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-medium text-sm">{metric.label}</td>
                            {comparisonDeals.map((deal, index) => {
                              const value = values[index];
                              const comparison = getMetricComparison(value, values);
                              
                              return (
                                <td key={deal.id} className="p-2">
                                  <div className="flex items-center gap-2">
                                    <comparison.icon className={`h-4 w-4 ${comparison.color}`} />
                                    <span className="text-sm">{metric.format(value)}</span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Winner Summary */}
          {comparisonDeals.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-accent" />
                  Best Performing Deal
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const bestROI = Math.max(...comparisonDeals.map(d => d.results.postRefinanceROI));
                  const bestDeal = comparisonDeals.find(d => d.results.postRefinanceROI === bestROI);
                  
                  return bestDeal ? (
                    <div className="flex items-center justify-between p-4 bg-accent/10 dark:bg-accent rounded-lg">
                      <div>
                        <h4 className="font-semibold">{bestDeal.deal_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          Highest ROI at {formatPercentage(bestDeal.results.postRefinanceROI)}
                        </p>
                      </div>
                      <Badge className="bg-accent text-white">Winner</Badge>
                    </div>
                  ) : null;
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};