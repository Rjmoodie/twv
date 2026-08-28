import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Heart, Share2, Calendar, Target, Users, MessageCircle } from "lucide-react";
import { FundingCampaign, Donation } from "../types";
import { supabase } from "@/integrations/supabase/client";
import DonationForm from "./DonationForm";
// import CampaignProjectionVisualization from "../campaign-projection/CampaignProjectionVisualization";
import { toast } from "@/hooks/use-toast";

interface CampaignDetailsProps {
  campaign: FundingCampaign;
  onBack: () => void;
  onUpdate: (campaign: FundingCampaign) => void;
}

const CampaignDetails = ({ campaign, onBack, onUpdate }: CampaignDetailsProps) => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDonationForm, setShowDonationForm] = useState(false);

  useEffect(() => {
    fetchDonations();
  }, [campaign.id]);

  const fetchDonations = async () => {
    try {
      const { data, error } = await supabase
        .from('donations')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonations(data || []);
    } catch (error) {
      console.error('Error fetching donations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDonation = async (donationData: any) => {
    try {
      // Process payment through Stripe
      const { data, error } = await supabase.functions.invoke('process-donation', {
        body: {
          campaign_id: campaign.id,
          amount: donationData.amount,
          donor_name: donationData.donor_name,
          donor_email: donationData.donor_email,
          message: donationData.message,
          is_anonymous: donationData.is_anonymous
        }
      });

      if (error) throw error;

      if (data.checkout_url) {
        // Redirect to Stripe checkout
        window.open(data.checkout_url, '_blank');
        setShowDonationForm(false);
        
        toast({
          title: "Redirecting to payment",
          description: "Please complete your donation in the new tab.",
        });
      }
    } catch (error) {
      console.error('Error processing donation:', error);
      toast({
        title: "Error",
        description: "Failed to process donation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const getDaysLeft = (deadline: string | undefined) => {
    if (!deadline) return null;
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 3600 * 24));
    return days > 0 ? days : 0;
  };

  const getCategoryBadgeColor = (category: string) => {
    const colors = {
      car: 'bg-blue-500',
      education: 'bg-accent',
      business: 'bg-purple-500',
      medical: 'bg-destructive/100',
      emergency: 'bg-warning/100',
      housing: 'bg-yellow-500',
      other: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500';
  };

  const handleShare = () => {
    const url = `${window.location.origin}/campaign/${campaign.url_slug || campaign.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied!",
      description: "Campaign link has been copied to clipboard.",
    });
  };

  const getWeeksFromCampaign = (campaign: FundingCampaign) => {
    if (!campaign.deadline) return "12";
    const now = new Date();
    const end = new Date(campaign.deadline);
    const diffTime = end.getTime() - now.getTime();
    const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
    return Math.max(1, diffWeeks).toString();
  };

  const progress = calculateProgress(campaign.current_amount, campaign.target_amount);
  const daysLeft = getDaysLeft(campaign.deadline);
  const donorsCount = donations.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleShare} className="gap-2">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button onClick={() => setShowDonationForm(true)} className="gap-2">
            <Heart className="h-4 w-4" />
            Donate Now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Campaign Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl mb-2">{campaign.title}</CardTitle>
                  <Badge 
                    variant="secondary" 
                    className={`text-white ${getCategoryBadgeColor(campaign.category)}`}
                  >
                    {campaign.category.charAt(0).toUpperCase() + campaign.category.slice(1)}
                  </Badge>
                </div>
                {campaign.status !== 'active' && (
                  <Badge 
                    variant={campaign.status === 'completed' ? 'default' : 'destructive'}
                  >
                    {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Campaign Image */}
              {campaign.image_url && (
                <div className="mb-6 rounded-lg overflow-hidden">
                  {/* Consider using WebP/AVIF for better performance */}
                  <img 
                    src={campaign.image_url} 
                    alt={`Campaign: ${campaign.title}`}
                    className="w-full h-64 object-cover"
                    loading="lazy"
                    width={800}
                    height={256}
                  />
                </div>
              )}

              {/* Description */}
              <div className="prose max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {campaign.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Projection Results */}
          {campaign.projection_data && (
            <Card>
              <CardHeader>
                <CardTitle>Campaign Projection & Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="summary">Summary</TabsTrigger>
                    <TabsTrigger value="visualization">Chart</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="summary" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Target Amount:</span>
                          <span className="font-medium">{formatCurrency(campaign.projection_data.targetAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Projected Amount:</span>
                          <span className="font-medium">{formatCurrency(campaign.projection_data.projectedAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Expected Donors:</span>
                          <span className="font-medium">{campaign.projection_data.expectedDonors}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Weekly Target:</span>
                          <span className="font-medium">{formatCurrency(campaign.projection_data.weeklyTarget)}</span>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Success Probability:</span>
                          <span className={`font-medium ${campaign.projection_data.successProbability >= 80 ? 'text-accent' : campaign.projection_data.successProbability >= 50 ? 'text-yellow-600' : 'text-destructive'}`}>
                            {campaign.projection_data.successProbability}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Weeks to Complete:</span>
                          <span className="font-medium">{campaign.projection_data.weeksToComplete}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Optimistic Scenario:</span>
                          <span className="font-medium">{formatCurrency(campaign.projection_data.optimisticAmount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Status:</span>
                          <span className={`font-medium ${campaign.projection_data.onTrack ? 'text-accent' : 'text-yellow-600'}`}>
                            {campaign.projection_data.onTrack ? 'On Track' : 'Needs Adjustment'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="visualization">
                    {/* <CampaignProjectionVisualization
                      targetAmount={campaign.target_amount.toString()}
                      timeframe={getWeeksFromCampaign(campaign)}
                      averageDonation="25"
                      donationFrequency={[1]}
                      networkSize="100"
                      participationRate={[20]}
                      projectionResult={campaign.projection_data}
                    /> */}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}


          {/* Donations Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Recent Donations ({donations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-muted rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                          <div className="h-3 bg-muted rounded w-2/3"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : donations.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No donations yet. Be the first to support this campaign!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {donations.map((donation, index) => (
                    <div key={donation.id} className="flex items-start gap-3 p-3 rounded-lg bg-card border">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <Heart className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">
                            {donation.is_anonymous 
                              ? 'Anonymous Supporter' 
                              : donation.donor_name || 'Anonymous Supporter'
                            }
                          </p>
                          <span className="font-semibold text-primary">
                            {formatCurrency(donation.amount)}
                          </span>
                        </div>
                        {donation.message && (
                          <div className="bg-muted/50 rounded-lg p-2 mb-2">
                            <p className="text-sm text-foreground italic">
                              "{donation.message}"
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(donation.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {donations.length > 10 && (
                    <div className="text-center py-2">
                      <p className="text-sm text-muted-foreground">
                        Showing recent 10 donations • {donations.length} total
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-2xl font-bold">
                    {formatCurrency(campaign.current_amount)}
                  </span>
                  <span className="text-muted-foreground">
                    of {formatCurrency(campaign.target_amount)}
                  </span>
                </div>
                <Progress value={progress} className="h-3" />
                <div className="text-sm text-muted-foreground">
                  {progress.toFixed(1)}% funded
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold">{donorsCount}</div>
                  <div className="text-sm text-muted-foreground">Donors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {daysLeft !== null ? daysLeft : '∞'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {daysLeft !== null ? 'Days left' : 'No deadline'}
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => setShowDonationForm(true)} 
                className="w-full gap-2"
                disabled={campaign.status !== 'active'}
              >
                <Heart className="h-4 w-4" />
                Donate Now
              </Button>
            </CardContent>
          </Card>

          {/* Campaign Info */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Created {new Date(campaign.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground" />
                <span>{formatCurrency(campaign.target_amount)} goal</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{donorsCount} supporters</span>
              </div>
              {campaign.deadline && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Ends {new Date(campaign.deadline).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Donation Form Dialog */}
      {showDonationForm && (
        <DonationForm
          campaign={campaign}
          onClose={() => setShowDonationForm(false)}
          onDonation={handleDonation}
        />
      )}
    </div>
  );
};

export default CampaignDetails;