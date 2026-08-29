import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Save, FileText, TrendingUp } from "lucide-react";
import { BRRRRResults, BRRRRInputs } from "./brrrrCalculations";
import { formatCurrency, formatPercentage } from "./realEstateUtils";

interface EnhancedSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealName: string;
  setDealName: (name: string) => void;
  dealNotes: string;
  setDealNotes: (notes: string) => void;
  onSave: () => void;
  results: BRRRRResults | null;
  inputs: BRRRRInputs;
  isUpdate?: boolean;
}

export const EnhancedSaveDialog = ({
  open,
  onOpenChange,
  dealName,
  setDealName,
  dealNotes,
  setDealNotes,
  onSave,
  results,
  inputs,
  isUpdate = false
}: EnhancedSaveDialogProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (open && inputs) {
      // Generate smart name suggestions
      const location = "Property"; // Could be enhanced with actual location data
      const price = inputs.purchasePrice;
      const strategy = "BRRRR";
      
      const newSuggestions = [
        `${location} ${strategy} - $${(price / 1000).toFixed(0)}K`,
        `${new Date().toLocaleDateString()} ${strategy} Deal`,
        `${location} Renovation Project`,
        `Investment #${Math.floor(Math.random() * 100)}`
      ];
      
      setSuggestions(newSuggestions);
    }
  }, [open, inputs]);

  const handleSuggestionClick = (suggestion: string) => {
    setDealName(suggestion);
  };

  const getPerformanceRating = () => {
    if (!results) return null;
    
    const roi = results.postRefinanceROI;
    if (roi >= 15) return { label: "Excellent", color: "bg-accent", emoji: "" };
    if (roi >= 10) return { label: "Good", color: "bg-blue-500", emoji: "" };
    if (roi >= 5) return { label: "Fair", color: "bg-yellow-500", emoji: "" };
    return { label: "Below Target", color: "bg-destructive/100", emoji: "" };
  };

  const performance = getPerformanceRating();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isUpdate ? "Update Deal" : "Save Deal"}
          </DialogTitle>
          <DialogDescription>
            {isUpdate 
              ? "Update your deal with any changes you've made." 
              : "Save this BRRRR analysis for future reference and comparison."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Performance Summary */}
          {results && performance && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${performance.color}`} />
                    <span className="font-medium text-sm">{performance.label} Deal</span>
                    <span className="text-lg">{performance.emoji}</span>
                  </div>
                  <Badge variant="secondary">
                    {formatPercentage(results.postRefinanceROI)} ROI
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Investment:</span>
                    <p className="font-medium">{formatCurrency(results.totalInvestment)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cash Flow:</span>
                    <p className="font-medium">{formatCurrency(results.postRefinanceCashFlow)}/mo</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Deal Name */}
          <div className="space-y-3">
            <Label htmlFor="dealName" className="text-sm font-medium">Deal Name</Label>
            <Input
              id="dealName"
              placeholder="Enter a memorable name for this deal"
              value={dealName}
              onChange={(e) => setDealName(e.target.value)}
              className="w-full"
            />
            
            {/* Name Suggestions */}
            {suggestions.length > 0 && !dealName && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Suggestions:</Label>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Deal Notes */}
          <div className="space-y-2">
            <Label htmlFor="dealNotes" className="text-sm font-medium flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Notes (Optional)
            </Label>
            <Textarea
              id="dealNotes"
              placeholder="Add notes about location, strategy, assumptions, or next steps..."
              value={dealNotes}
              onChange={(e) => setDealNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Key Metrics Summary */}
          {results && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Quick Summary
              </Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Purchase Price:</span>
                  <span className="font-medium">{formatCurrency(inputs.purchasePrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ARV:</span>
                  <span className="font-medium">{formatCurrency(inputs.arv)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Investment:</span>
                  <span className="font-medium">{formatCurrency(results.totalInvestment)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cash Out:</span>
                  <span className="font-medium">{formatCurrency(results.cashOutAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={onSave} 
              disabled={!dealName.trim()}
              className="flex-1 gap-2"
            >
              <Save className="h-4 w-4" />
              {isUpdate ? "Update" : "Save"} Deal
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};