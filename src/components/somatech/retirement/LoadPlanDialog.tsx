import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FolderOpen } from "lucide-react";
import { SavedPlan } from "./retirementOperations";
import { SavedPlanCard } from "./SavedPlanCard";

interface LoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedPlans: SavedPlan[];
  onLoadPlan: (plan: SavedPlan) => void;
  onDeletePlan: (planId: string, planName: string) => void;
}

/**
 * Dialog for loading saved retirement plans
 */
export const LoadPlanDialog = ({
  open,
  onOpenChange,
  savedPlans,
  onLoadPlan,
  onDeletePlan,
}: LoadDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" aria-label="Load a saved retirement plan" title="Load saved plan">
          <FolderOpen className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Load Saved Plan</DialogTitle>
          <DialogDescription>
            Choose a saved plan to load into the calculator
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {Array.isArray(savedPlans) && savedPlans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No saved plans found.</p>
            </div>
          ) : (
            Array.isArray(savedPlans) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedPlans.map((plan) => (
                  <SavedPlanCard
                    key={plan.id}
                    plan={plan}
                    onLoad={() => onLoadPlan(plan)}
                    onDelete={() => onDeletePlan(plan.id, plan.plan_name)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
