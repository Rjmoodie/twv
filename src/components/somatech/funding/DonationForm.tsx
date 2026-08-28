import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Heart, DollarSign } from "lucide-react";
import { FundingCampaign, DonationForm as DonationFormType } from "../types";
import { donationAmounts } from "../constants";

interface DonationFormProps {
  campaign: FundingCampaign;
  onClose: () => void;
  onDonation: (donationData: DonationFormType) => void;
}

const DonationForm = ({ campaign, onClose, onDonation }: DonationFormProps) => {
  const [formData, setFormData] = useState<DonationFormType>({
    amount: 0,
    donor_name: "",
    donor_email: "",
    message: "",
    is_anonymous: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || formData.amount <= 0) {
      return;
    }

    setLoading(true);
    try {
      await onDonation(formData);
    } finally {
      setLoading(false);
    }
  };

  const setPresetAmount = (amount: number) => {
    setFormData({ ...formData, amount });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            Support {campaign.title}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Amount Selection */}
          <div className="space-y-4">
            <Label>Choose Amount</Label>
            
            {/* Preset Amounts */}
            <div className="grid grid-cols-3 gap-2">
              {donationAmounts.map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant={formData.amount === amount ? "default" : "outline"}
                  onClick={() => setPresetAmount(amount)}
                  className="h-12"
                >
                  ${amount}
                </Button>
              ))}
            </div>

            {/* Custom Amount */}
            <div>
              <Label htmlFor="custom-amount">Custom Amount</Label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="custom-amount"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter amount"
                  className="pl-10"
                  min="1"
                  step="0.01"
                />
              </div>
            </div>
          </div>

          {/* Donor Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="donor-name">Your Name (Optional)</Label>
              <Input
                id="donor-name"
                value={formData.donor_name}
                onChange={(e) => setFormData({ ...formData, donor_name: e.target.value })}
                placeholder="Enter your name"
                disabled={formData.is_anonymous}
              />
            </div>

            <div>
              <Label htmlFor="donor-email">Email (Optional)</Label>
              <Input
                id="donor-email"
                type="email"
                value={formData.donor_email}
                onChange={(e) => setFormData({ ...formData, donor_email: e.target.value })}
                placeholder="Enter your email"
                disabled={formData.is_anonymous}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="anonymous"
                checked={formData.is_anonymous}
                onCheckedChange={(checked) => setFormData({ 
                  ...formData, 
                  is_anonymous: checked as boolean,
                  donor_name: checked ? "" : formData.donor_name,
                  donor_email: checked ? "" : formData.donor_email
                })}
              />
              <Label htmlFor="anonymous" className="text-sm">
                Donate anonymously
              </Label>
            </div>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Leave a message of support..."
              rows={3}
            />
          </div>

          {/* Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Donation Amount:</span>
                  <span className="font-medium">{formatCurrency(formData.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Fee:</span>
                  <span className="font-medium">$0.00</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>{formatCurrency(formData.amount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.amount || formData.amount <= 0}
              className="gap-2"
            >
              <Heart className="h-4 w-4" />
              {loading ? "Processing..." : `Donate ${formatCurrency(formData.amount)}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DonationForm;