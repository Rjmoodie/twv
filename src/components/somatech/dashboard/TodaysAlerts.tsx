import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";

const TodaysAlerts = () => {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Bell className="h-4 w-4 text-primary" />
          <span>Alerts</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6 px-3 gap-2">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <Bell className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          No alerts right now.<br />Price triggers and portfolio alerts will appear here.
        </p>
      </CardContent>
    </Card>
  );
};

export default TodaysAlerts;
