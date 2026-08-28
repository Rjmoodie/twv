import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Settings, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CampaignActionsProps {
  campaignId: string;
  campaignTitle: string;
  currentAmount: number;
  onManage: () => void;
  onDelete?: () => void;
}

/**
 * Handles campaign management actions (manage and delete)
 */
export const CampaignActions = ({ 
  campaignId, 
  campaignTitle, 
  currentAmount, 
  onManage, 
  onDelete 
}: CampaignActionsProps) => {
  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('funding_campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;

      toast({
        title: "Campaign Deleted",
        description: "Your campaign has been successfully deleted.",
      });
      
      onDelete?.();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error",
        description: "Failed to delete campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const canDelete = currentAmount === 0;

  return (
    <div className="mt-4 space-y-2">
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full gap-2"
        onClick={(e) => {
          stopPropagation(e);
          onManage();
        }}
      >
        <Settings className="h-4 w-4" />
        Manage Campaign
      </Button>
      
      {canDelete && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full gap-2 text-destructive hover:text-destructive"
              onClick={stopPropagation}
            >
              <Trash2 className="h-4 w-4" />
              Delete Campaign
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent onClick={stopPropagation}>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{campaignTitle}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Campaign
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};