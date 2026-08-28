import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";

interface SaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planName: string;
  setPlanName: (name: string) => void;
  planNotes: string;
  setPlanNotes: (notes: string) => void;
  currentNotes: string;
  onSave: () => void;
}

/**
 * Dialog for saving retirement plans
 */
export const SavePlanDialog = ({
  open,
  onOpenChange,
  planName,
  setPlanName,
  planNotes,
  setPlanNotes,
  currentNotes,
  onSave
}: SaveDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" aria-label="Save this retirement plan" title="Save plan">
          <Save className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Retirement Plan</DialogTitle>
          <DialogDescription>
            Save this plan analysis for future reference
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Plan Name</Label>
            <Input
              placeholder="e.g., Conservative Retirement Plan"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Add any notes about this plan..."
              value={planNotes || currentNotes}
              onChange={(e) => setPlanNotes(e.target.value)}
              rows={4}
            />
            {currentNotes && !planNotes && (
              <p className="text-xs text-muted-foreground mt-1">
                Using notes from current analysis. Edit above to change.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={onSave} disabled={!planName.trim()} className="flex-1">
              Save Plan
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
