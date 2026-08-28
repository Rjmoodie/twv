import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, BarChart3 } from "lucide-react";

interface HistoricalChartProps {
  selectedChart: string;
  onClose: () => void;
}

const HistoricalChart = ({ selectedChart, onClose }: HistoricalChartProps) => {
  const title = selectedChart
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <BarChart3 className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">Historical Data: {title}</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close chart">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6">
        <div className="h-48 sm:h-64 bg-muted rounded-lg border border-border flex items-center justify-center">
          <div className="text-center px-4 space-y-2">
            <BarChart3 className="h-10 w-10 text-muted-foreground/50 mx-auto" />
            <p className="text-sm text-muted-foreground">
              Live chart coming soon — connect a data provider to enable.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistoricalChart;
