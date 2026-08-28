import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Heart, Calendar, Target, TrendingUp, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { FundingCampaign, CampaignFilters } from "./types";
import { campaignCategories } from "./constants";
import CreateCampaignDialog from "./funding/CreateCampaignDialog";
import CampaignCard from "./funding/CampaignCard";
import CampaignDetails from "./funding/CampaignDetails";
import { toast } from "@/hooks/use-toast";
import type { User as SupabaseUser } from "@supabase/supabase-js";


interface FundingCampaignsProps {
  user: SupabaseUser | null;
  onAuthRequired: () => void;
}

const fetchCampaigns = async (filters: CampaignFilters) => {
  let query = supabase
    .from('funding_campaigns')
    .select('*')
    .eq('visibility', 'public')
    .eq('status', 'active');

  if (filters.category) {
    query = query.eq('category', filters.category);
  }
  if (filters.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }
  switch (filters.sortBy) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'most_funded':
      query = query.order('current_amount', { ascending: false });
      break;
    case 'ending_soon':
      query = query.not('deadline', 'is', null).order('deadline', { ascending: true });
      break;
    default:
      query = query.order('created_at', { ascending: false });
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as FundingCampaign[];
};

const fetchMyCampaigns = async (userId: string) => {
  const { data, error } = await supabase
    .from('funding_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as FundingCampaign[];
};

const createCampaign = async (newCampaign: Partial<FundingCampaign>) => {
  const { data, error } = await supabase
    .from('funding_campaigns')
    .insert([newCampaign]);
  if (error) throw error;
  return data?.[0];
};

const FundingCampaigns = ({ user, onAuthRequired }: FundingCampaignsProps) => {
  const [activeTab, setActiveTab] = useState<'explore' | 'my-campaigns'>('explore');
  const [selectedCampaign, setSelectedCampaign] = useState<FundingCampaign | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [filters, setFilters] = useState<CampaignFilters>({ sortBy: 'newest', search: '' });
  const queryClient = useQueryClient();

  const {
    data: campaigns,
    isLoading: loadingCampaigns,
    error: errorCampaigns
  } = useQuery({
    queryKey: ['funding-campaigns', filters],
    queryFn: () => fetchCampaigns(filters),
    staleTime: 60000,
  });

  const {
    data: myCampaigns,
    isLoading: loadingMyCampaigns,
    error: errorMyCampaigns
  } = useQuery({
    queryKey: ['my-funding-campaigns', user?.id],
    queryFn: () => user ? fetchMyCampaigns(user.id) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: createCampaign,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['my-funding-campaigns', user?.id]);
      setShowCreateDialog(false);
      toast({ title: 'Success!', description: 'Your campaign has been created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const handleCreateCampaign = (newCampaign: Partial<FundingCampaign>) => {
    if (!user) {
      onAuthRequired();
      return;
    }
    createMutation.mutate({ ...newCampaign, user_id: user.id });
  };

  const handleCampaignCreated = (newCampaign: FundingCampaign) => {
    queryClient.invalidateQueries(['my-funding-campaigns', user?.id]);
    setShowCreateDialog(false);
    toast({
      title: "Success!",
      description: "Your campaign has been created successfully",
    });
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

  if (selectedCampaign) {
    return (
      <CampaignDetails
        campaign={selectedCampaign}
        onBack={() => setSelectedCampaign(null)}
        onUpdate={(updated) => {
          queryClient.invalidateQueries(['funding-campaigns']);
          setSelectedCampaign(updated);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Funding Campaigns</h2>
          <p className="text-muted-foreground">
            Support community goals or create your own funding campaign
          </p>
        </div>
        <Button onClick={handleCreateCampaign} className="btn-premium gap-2 px-4 py-2 sm:px-6">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create Campaign</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
        <Button
          variant={activeTab === 'explore' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('explore')}
        >
          <Search className="h-4 w-4 mr-2" />
          Explore
        </Button>
        <Button
          variant={activeTab === 'my-campaigns' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => {
            if (!user) {
              onAuthRequired();
              return;
            }
            setActiveTab('my-campaigns');
          }}
        >
          <Heart className="h-4 w-4 mr-2" />
          My Campaigns
        </Button>
      </div>

      {/* Filters (only for explore tab) */}
      {activeTab === 'explore' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-64">
                <Input
                  placeholder="Search campaigns..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full"
                />
              </div>
              <Select
                value={filters.category || "all"}
                onValueChange={(value) => setFilters({ ...filters, category: value === "all" ? undefined : value })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {campaignCategories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filters.sortBy}
                onValueChange={(value) => setFilters({ ...filters, sortBy: value as any })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Most Recent</SelectItem>
                  <SelectItem value="most_funded">Most Funded</SelectItem>
                  <SelectItem value="ending_soon">Ending Soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign Grid */}
      {(loadingCampaigns || loadingMyCampaigns) ? (
          // Loading skeletons
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-80">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-32 bg-muted rounded"></div>
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-6 bg-muted rounded w-full"></div>
                  <div className="h-4 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          (activeTab === 'explore' ? campaigns : myCampaigns).map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              onClick={() => setSelectedCampaign(campaign)}
              showManageButton={activeTab === 'my-campaigns'}
              onDelete={() => {
                queryClient.invalidateQueries(['my-funding-campaigns', user?.id]);
              }}
            />
          ))
        )}
      {/* Empty State with Better UX */}
      {!loadingCampaigns && !loadingMyCampaigns && (activeTab === 'explore' ? campaigns : myCampaigns).length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            {activeTab === 'explore' ? (
              <div>
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
                <p className="text-muted-foreground mb-4">
                  {filters.search || filters.category 
                    ? 'Try adjusting your search filters to find more campaigns' 
                    : 'Be the first to create a campaign in this community!'
                  }
                </p>
                {filters.search || filters.category ? (
                  <div className="flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setFilters({ sortBy: 'newest', search: '' })}
                    >
                      Clear Filters
                    </Button>
                    <Button onClick={() => handleCreateCampaign({})}>
                      Create Campaign
                    </Button>
                  </div>
                ) : (
                  <Button onClick={() => handleCreateCampaign({})}>
                    Create First Campaign
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Ready to start your first funding campaign? It only takes a few minutes!
                </p>
                <Button onClick={() => handleCreateCampaign({})} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Campaign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Campaign Dialog */}
      <CreateCampaignDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCampaignCreated={handleCampaignCreated}
      />
    </div>
  );
};

export default FundingCampaigns;