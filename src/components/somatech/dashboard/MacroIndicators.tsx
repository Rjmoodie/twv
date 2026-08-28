import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";

interface MacroIndicatorsProps {
  onChartSelect: (chart: string) => void;
  selectedChart: string;
}

const MacroIndicators = ({ onChartSelect, selectedChart }: MacroIndicatorsProps) => {
  const haptics = useHaptics();
  const indicators = [
    { name: "GDP Growth",   value: "2.4%",  change: 0.3,  trend: "up"   },
    { name: "Inflation",    value: "3.1%",  change: -0.2, trend: "down" },
    { name: "Unemployment", value: "3.8%",  change: -0.1, trend: "down" },
    { name: "10Y Treasury", value: "4.25%", change: 0.05, trend: "up"   },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Activity className="h-4 w-4 text-primary" />
          <span>Macro</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0">
        {indicators.map((indicator, index) => (
          <button
            key={index}
            className="w-full flex flex-col px-3 py-2.5 bg-muted/50 hover:bg-muted rounded-xl transition-colors text-left touch-manipulation active:scale-[0.98]"
            onClick={() => { haptics.tick(); onChartSelect(`macro-${indicator.name.toLowerCase().replace(/\s+/g, '-')}`); }}
          >
            {/* Label row */}
            <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground mb-1.5 leading-none">
              {indicator.name}
            </p>
            {/* Value + change row — items-baseline keeps numbers and % on the same text baseline */}
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-base font-bold font-mono tabular-nums text-foreground leading-none">
                {indicator.value}
              </p>
              <div className="flex items-baseline gap-1 shrink-0">
                {indicator.trend === "up"
                  ? <TrendingUp  className="h-3 w-3 text-success self-center" />
                  : <TrendingDown className="h-3 w-3 text-destructive self-center" />}
                <span className={`text-xs font-mono font-semibold tabular-nums leading-none ${indicator.change > 0 ? "text-success" : "text-destructive"}`}>
                  {indicator.change > 0 ? "+" : ""}{indicator.change}%
                </span>
              </div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};

export default MacroIndicators;
