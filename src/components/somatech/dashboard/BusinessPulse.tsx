import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Search, Activity, Calendar, TrendingUp } from "lucide-react";
import { useNavigation } from "@/contexts/NavigationContext";

const TOOLS = [
  { icon: Search,   label: "Stock Analysis", id: "stock-analysis"    },
  { icon: Activity, label: "Options",         id: "options-dashboard" },
  { icon: Calendar, label: "PDUFA",           id: "pdufa"             },
  { icon: TrendingUp,label: "Earnings",       id: "earnings"          },
] as const;

const BusinessPulse = () => {
  const { navigateToModule } = useNavigation();

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Zap className="h-4 w-4 text-primary" />
          <span>Quick Tools</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {TOOLS.map(({ icon: Icon, label, id }) => (
          <button
            key={id}
            onClick={() => navigateToModule(id)}
            className="w-full flex items-center gap-2 p-2.5 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left touch-manipulation min-h-[44px]"
          >
            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">{label}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};

export default BusinessPulse;
