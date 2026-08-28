import { Card, CardContent } from "@/components/ui/card";
import LoadingSpinner from "../LoadingSpinner";

/**
 * Loading state component for watchlist
 */
export const WatchlistLoading = () => {
  return (
    <div className="space-y-8">
      <Card>
        <CardContent className="text-center py-16">
          <LoadingSpinner size="lg" text="Loading your watchlist..." />
          <p className="text-sm text-muted-foreground mt-4">
            Fetching your saved stocks and latest market data
          </p>
        </CardContent>
      </Card>
    </div>
  );
};