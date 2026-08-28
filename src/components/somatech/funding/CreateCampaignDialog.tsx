import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Plus, Minus, X, Calculator, Target, Users, DollarSign, Calendar, Zap } from "lucide-react";
// Remove or comment out the imports for CampaignProjectionResults and CampaignProjectionVisualization
// import CampaignProjectionResults from "../campaign-projection/CampaignProjectionResults";
// import CampaignProjectionVisualization from "../campaign-projection/CampaignProjectionVisualization";
import { supabase } from "@/integrations/supabase/client";
import { CreateCampaignForm, FundingCampaign } from "../types";
import { campaignCategories } from "../constants";
import { toast } from "@/hooks/use-toast";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCampaignCreated: (campaign: FundingCampaign) => void;
}

const CreateCampaignDialog = ({ open, onOpenChange, onCampaignCreated }: CreateCampaignDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formData, setFormData] = useState<CreateCampaignForm>({
    title: "",
    category: "",
    description: "",
    target_amount: 0,
    visibility: "public",
    financial_breakdown: []
  });

  // Integrated projection state
  const [averageDonation, setAverageDonation] = useState("");
  const [donationFrequency, setDonationFrequency] = useState([1]);
  const [networkSize, setNetworkSize] = useState("");
  const [participationRate, setParticipationRate] = useState([20]);
  const [projectionResult, setProjectionResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced validation
    if (!formData.title?.trim()) {
      toast({
        title: "Validation Error",
        description: "Campaign title is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: "Validation Error", 
        description: "Please select a category",
        variant: "destructive",
      });
      return;
    }

    if (!formData.description?.trim()) {
      toast({
        title: "Validation Error",
        description: "Campaign description is required", 
        variant: "destructive",
      });
      return;
    }

    if (!formData.target_amount || formData.target_amount <= 0) {
      toast({
        title: "Validation Error",
        description: "Target amount must be greater than $0",
        variant: "destructive",
      });
      return;
    }

    // Removed target amount maximum limit - users can enter any amount

    setLoading(true);
    
    try {
      // Check authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "You must be logged in to create a campaign. Please sign up or log in first.",
          variant: "destructive",
        });
        return;
      }

      let image_url = null;
      
      // Upload image if provided with enhanced error handling
      if (imageFile) {
        // Removed file size validation - users can upload any size image

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(imageFile.type)) {
          toast({
            title: "Invalid File Type",
            description: "Please upload a JPEG, PNG, or WebP image",
            variant: "destructive",
          });
          return;
        }

        try {
          const fileExt = imageFile.name.split('.').pop()?.toLowerCase();
          const fileName = `campaigns/${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('campaign-media')
            .upload(fileName, imageFile, {
              cacheControl: '3600',
              upsert: false
            });
          
          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw new Error(`Image upload failed: ${uploadError.message}`);
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from('campaign-media')
            .getPublicUrl(fileName);
          
          image_url = publicUrl;
        } catch (uploadError) {
          console.error('Image upload error:', uploadError);
          toast({
            title: "Upload Failed",
            description: "Failed to upload image. Please try again or proceed without an image.",
            variant: "destructive",
          });
          return;
        }
      }

      // Create URL slug from title with better sanitization
      const url_slug = formData.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .substring(0, 100); // Limit length

      // Prepare campaign data
      const campaignData = {
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim(),
        target_amount: Number(formData.target_amount),
        deadline: formData.deadline || null,
        visibility: formData.visibility || 'public',
        user_id: user.id,
        image_url,
        url_slug,
        financial_breakdown: null,
        status: 'active',
        current_amount: 0,
        projection_data: projectionResult
      };

      console.log('Creating campaign with data:', campaignData);

      const { data, error } = await supabase
        .from('funding_campaigns')
        .insert([campaignData])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        
        // Handle specific database errors
        if (error.code === '23505') {
          throw new Error('A campaign with this title already exists. Please choose a different title.');
        } else if (error.code === '23503') {
          throw new Error('Database constraint violation. Please check your data and try again.');
        } else if (error.message.includes('row-level security')) {
          throw new Error('Permission denied. Please make sure you are logged in with the correct account.');
        } else {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      if (!data) {
        throw new Error('Campaign was created but no data was returned. Please refresh the page.');
      }

      // Success
      toast({
        title: "Success!",
        description: "Your campaign has been created successfully",
      });

      onCampaignCreated(data as FundingCampaign);
      
      // Reset form
      setFormData({
        title: "",
        category: "",
        description: "",
        target_amount: 0,
        visibility: "public",
        financial_breakdown: []
      });
      setImageFile(null);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error creating campaign:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An unexpected error occurred. Please try again.';
      
      toast({
        title: "Failed to Create Campaign",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addBreakdownItem = () => {
    setFormData({
      ...formData,
      financial_breakdown: [
        ...(formData.financial_breakdown || []),
        { title: "", amount: 0 }
      ]
    });
  };

  const removeBreakdownItem = (index: number) => {
    setFormData({
      ...formData,
      financial_breakdown: formData.financial_breakdown?.filter((_, i) => i !== index)
    });
  };

  const updateBreakdownItem = (index: number, field: 'title' | 'amount', value: string | number) => {
    setFormData({
      ...formData,
      financial_breakdown: formData.financial_breakdown?.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    });
  };

  const calculateProjection = () => {
    if (!formData.target_amount || !formData.deadline || !averageDonation || !networkSize) return;

    const target = formData.target_amount;
    const weeks = calculateWeeksFromDeadline(formData.deadline);
    const avgDonation = parseFloat(averageDonation);
    const frequency = donationFrequency[0];
    const network = parseInt(networkSize);
    const participation = participationRate[0] / 100;

    // Calculate expected donors
    const expectedDonors = Math.floor(network * participation);
    
    // Calculate total donations over timeframe
    const totalDonations = expectedDonors * frequency * weeks;
    const projectedAmount = totalDonations * avgDonation;
    
    // Calculate weekly targets
    const weeklyTarget = target / weeks;
    const weeklyProjected = projectedAmount / weeks;
    
    // Calculate scenarios
    const optimisticAmount = projectedAmount * 1.5; // 50% more
    const pessimisticAmount = projectedAmount * 0.6; // 40% less
    
    // Calculate completion time
    const weeksToComplete = projectedAmount >= target ? weeks : (target / weeklyProjected);
    
    // Success probability
    const successProbability = Math.min((projectedAmount / target) * 100, 100);

    setProjectionResult({
      targetAmount: target,
      projectedAmount: Math.round(projectedAmount),
      expectedDonors,
      totalDonations,
      weeklyTarget: Math.round(weeklyTarget),
      weeklyProjected: Math.round(weeklyProjected),
      optimisticAmount: Math.round(optimisticAmount),
      pessimisticAmount: Math.round(pessimisticAmount),
      weeksToComplete: Math.round(weeksToComplete * 100) / 100,
      successProbability: Math.round(successProbability * 100) / 100,
      onTrack: projectedAmount >= target
    });
  };

  const calculateWeeksFromDeadline = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diffTime = end.getTime() - now.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, diffWeeks); // At least 1 week
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Funding Campaign</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Campaign Details</h3>
              
              <div>
                <Label htmlFor="title">Campaign Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Help Me Buy My First Car"
                  required
                />
              </div>

              <div>
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignCategories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="target_amount" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Target Amount ($) *
                </Label>
                <Input
                  id="target_amount"
                  type="number"
                  value={formData.target_amount}
                  onChange={(e) => setFormData({ ...formData, target_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="10000"
                  min="1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="deadline">Deadline (Optional)</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>

              <div>
                <Label>Visibility</Label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => setFormData({ ...formData, visibility: value as 'public' | 'private' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Anyone can discover</SelectItem>
                    <SelectItem value="private">Private - Only accessible via link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Projection Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Campaign Projection
              </h3>

              {formData.deadline && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Duration: {calculateWeeksFromDeadline(formData.deadline)} weeks
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="avg-donation" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Average Donation ($)
                </Label>
                <Input
                  id="avg-donation"
                  type="number"
                  placeholder="25"
                  value={averageDonation}
                  onChange={(e) => setAverageDonation(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="network-size" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Network Size (potential donors)
                </Label>
                <Input
                  id="network-size"
                  type="number"
                  placeholder="100"
                  value={networkSize}
                  onChange={(e) => setNetworkSize(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Donation Frequency (per week): {donationFrequency[0]}x
                </Label>
                <Slider
                  value={donationFrequency}
                  onValueChange={setDonationFrequency}
                  max={5}
                  min={0.1}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>0.1x</span>
                  <span>5x</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participation Rate: {participationRate[0]}%
                </Label>
                <Slider
                  value={participationRate}
                  onValueChange={setParticipationRate}
                  max={100}
                  min={1}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>1%</span>
                  <span>100%</span>
                </div>
              </div>

              <Button 
                type="button"
                onClick={calculateProjection}
                disabled={!formData.target_amount || !formData.deadline || !averageDonation || !networkSize}
                className="w-full gap-2"
                variant="outline"
              >
                <Calculator className="h-4 w-4" />
                Calculate Projection
              </Button>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Tell your story, your needs, your plan..."
              rows={4}
              required
            />
          </div>

          {/* Image Upload */}
          <div>
            <Label htmlFor="image">Campaign Image (Optional)</Label>
            <div className="mt-2">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
              {imageFile && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Selected: {imageFile.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setImageFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Projection Results */}
          {projectionResult && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Remove or comment out the imports for CampaignProjectionResults and CampaignProjectionVisualization */}
              {/* <CampaignProjectionResults result={projectionResult} /> */}
              {/* <CampaignProjectionVisualization
                targetAmount={formData.target_amount.toString()}
                timeframe={formData.deadline ? calculateWeeksFromDeadline(formData.deadline).toString() : "0"}
                averageDonation={averageDonation}
                donationFrequency={donationFrequency}
                networkSize={networkSize}
                participationRate={participationRate}
                projectionResult={projectionResult}
              /> */}
            </div>
          )}


          {/* Submit Button */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Campaign"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateCampaignDialog;