import { Calendar, Target } from "lucide-react";
import { formatCurrency, getDaysLeft } from "./utils";

interface CampaignMetadataProps {
  targetAmount: number;
  deadline?: string;
}

/**
 * Displays campaign metadata including goal and deadline information
 */
export const CampaignMetadata = ({ targetAmount, deadline }: CampaignMetadataProps) => {
  const daysLeft = getDaysLeft(deadline);

  return (
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <Target className="h-3 w-3" />
        <span>{formatCurrency(targetAmount)} goal</span>
      </div>
      {daysLeft !== null && (
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>
            {daysLeft === 0 ? 'Ends today' : `${daysLeft} days left`}
          </span>
        </div>
      )}
    </div>
  );
};