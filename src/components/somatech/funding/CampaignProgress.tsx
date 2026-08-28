import { Progress } from "@/components/ui/progress";
import { formatCurrency, calculateProgress } from "./utils";

interface CampaignProgressProps {
  currentAmount: number;
  targetAmount: number;
}

/**
 * Displays campaign funding progress with amount and percentage
 */
export const CampaignProgress = ({ currentAmount, targetAmount }: CampaignProgressProps) => {
  const progress = calculateProgress(currentAmount, targetAmount);

  return (
    <div className="space-y-2 mb-4">
      <div className="flex justify-between text-sm">
        <span className="font-medium">
          {formatCurrency(currentAmount)}
        </span>
        <span className="text-muted-foreground">
          {formatCurrency(targetAmount)}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="text-xs text-muted-foreground">
        {progress.toFixed(1)}% funded
      </div>
    </div>
  );
};