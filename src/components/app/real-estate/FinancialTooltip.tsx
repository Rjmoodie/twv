import { HelpCircle, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinancialTooltipProps {
  term: string;
  definition: string;
  formula?: string;
  goodRange?: { min?: number; max?: number; label: string };
  value?: number;
  className?: string;
}

export const FinancialTooltip = ({
  term,
  definition,
  formula,
  goodRange,
  value,
  className
}: FinancialTooltipProps) => {
  const getPerformanceIndicator = () => {
    if (!goodRange || value === undefined) return null;
    
    const { min = -Infinity, max = Infinity, label } = goodRange;
    
    if (value >= min && value <= max) {
      return {
        icon: TrendingUp,
        color: "text-accent",
        message: `✅ ${label}`
      };
    } else if (value < min) {
      return {
        icon: TrendingDown,
        color: "text-destructive",
        message: `⚠️ Below ${label}`
      };
    } else {
      return {
        icon: AlertTriangle,
        color: "text-yellow-500",
        message: `⚠️ Above ${label}`
      };
    }
  };

  const indicator = getPerformanceIndicator();

  return (
    <div className={cn("group relative inline-flex items-center", className)}>
      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-primary transition-colors" />
      
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 bg-popover border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="border-b pb-2">
            <h4 className="font-semibold text-sm text-foreground">{term}</h4>
          </div>
          
          {/* Definition */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {definition}
          </p>
          
          {/* Formula */}
          {formula && (
            <div className="bg-muted/50 rounded p-2">
              <p className="text-xs font-mono text-foreground">{formula}</p>
            </div>
          )}
          
          {/* Performance Indicator */}
          {indicator && (
            <div className={cn("flex items-center gap-2 p-2 rounded-md bg-muted/30", indicator.color)}>
              <indicator.icon className="h-4 w-4" />
              <span className="text-xs font-medium">{indicator.message}</span>
            </div>
          )}
        </div>
        
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-popover"></div>
      </div>
    </div>
  );
};