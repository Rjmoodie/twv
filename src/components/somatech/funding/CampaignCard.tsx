import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FundingCampaign } from "../types";
import { CampaignHeader } from "./CampaignHeader";
import { CampaignProgress } from "./CampaignProgress";
import { CampaignMetadata } from "./CampaignMetadata";
import { CampaignActions } from "./CampaignActions";

interface CampaignCardProps {
  campaign: FundingCampaign;
  onClick: () => void;
  showManageButton?: boolean;
  onDelete?: () => void;
}

/**
 * Campaign card component for displaying funding campaign information
 */
const CampaignCard = ({ campaign, onClick, showManageButton = false, onDelete }: CampaignCardProps) => {
  return (
    <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200" onClick={onClick}>
      <CardHeader className="pb-3">
        <CampaignHeader title={campaign.title} category={campaign.category} />
      </CardHeader>
      
      <CardContent>
        {/* Campaign Image */}
        {campaign.image_url && (
          <div className="mb-4 rounded-lg overflow-hidden">
            {/* Consider using WebP/AVIF for better performance */}
            <img 
              src={campaign.image_url} 
              alt={`Campaign: ${campaign.title}`}
              className="w-full h-32 object-cover"
              loading="lazy"
              width={400}
              height={128}
            />
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
          {campaign.description}
        </p>

        {/* Progress */}
        <CampaignProgress 
          currentAmount={campaign.current_amount}
          targetAmount={campaign.target_amount}
        />

        {/* Footer Info */}
        <CampaignMetadata 
          targetAmount={campaign.target_amount}
          deadline={campaign.deadline}
        />

        {/* Status Badge */}
        {campaign.status !== 'active' && (
          <Badge 
            variant={campaign.status === 'completed' ? 'default' : 'destructive'}
            className="mt-2 text-xs"
          >
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </Badge>
        )}

        {/* Management Actions */}
        {showManageButton && (
          <CampaignActions
            campaignId={campaign.id}
            campaignTitle={campaign.title}
            currentAmount={campaign.current_amount}
            onManage={onClick}
            onDelete={onDelete}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default CampaignCard;