import { Badge } from "@/components/ui/badge";
import { getCategoryBadgeColor, capitalize } from "./utils";

interface CampaignHeaderProps {
  title: string;
  category: string;
}

/**
 * Displays campaign title and category badge
 */
export const CampaignHeader = ({ title, category }: CampaignHeaderProps) => {
  return (
    <div className="flex items-start justify-between">
      <div className="flex-1">
        <h3 className="text-lg font-semibold line-clamp-2">{title}</h3>
        <Badge 
          variant="secondary" 
          className={`mt-2 text-white ${getCategoryBadgeColor(category)}`}
        >
          {capitalize(category)}
        </Badge>
      </div>
    </div>
  );
};