import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { BusinessListing, MarketplaceFilters } from "../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, DollarSign, TrendingUp, Eye, MessageCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MarketplaceListingsProps {
  filters: MarketplaceFilters;
}

const fetchListings = async (filters: any) => {
  let query = supabase
    .from('business_listings')
    .select('*')
    .eq('status', 'live');

  if (filters.industry) {
    query = query.eq('industry', filters.industry);
  }
  if (filters.location) {
    query = query.ilike('location', `%${filters.location}%`);
  }
  if (filters.priceMin) {
    query = query.gte('asking_price', filters.priceMin);
  }
  if (filters.priceMax) {
    query = query.lte('asking_price', filters.priceMax);
  }
  if (filters.ebitdaMin) {
    query = query.gte('ebitda', filters.ebitdaMin);
  }
  if (filters.ebitdaMax) {
    query = query.lte('ebitda', filters.ebitdaMax);
  }
  switch (filters.sortBy) {
    case 'newest':
      query = query.order('created_at', { ascending: false });
      break;
    case 'price_asc':
      query = query.order('asking_price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('asking_price', { ascending: false });
      break;
    case 'ebitda_desc':
      query = query.order('ebitda', { ascending: false });
      break;
  }
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

const MarketplaceListings = ({ filters }: MarketplaceListingsProps) => {
  const { data: listings, isLoading, error } = useQuery({
    queryKey: ['marketplace-listings', filters],
    queryFn: () => fetchListings(filters),
    staleTime: 60000
  });
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Loading skeletons */}
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse h-48" />
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="text-destructive">Failed to load listings</div>;
  }

  if (!listings || listings.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">No listings found.</CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(0)}K`;
    }
    return formatCurrency(num);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {listings?.map((listing) => (
        <Card key={listing.id} className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-lg line-clamp-1">{listing.business_name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{listing.industry}</Badge>
                  {listing.bor_documents && listing.bor_documents.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      📘 Book of Record Available
                    </Badge>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground text-xs">
                    <MapPin className="h-3 w-3" />
                    {listing.location}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Financial Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Asking Price</p>
                <p className="font-semibold text-primary">{formatCurrency(listing.asking_price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue (TTM)</p>
                <p className="font-semibold">{formatNumber(listing.revenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">EBITDA</p>
                <p className="font-semibold">{formatNumber(listing.ebitda)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Multiple</p>
                <p className="font-semibold">{(listing.asking_price / listing.ebitda).toFixed(1)}x</p>
              </div>
            </div>

            {/* Valuation Summary */}
            {listing.valuation_summary && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">DCF Valuation Range</p>
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {formatNumber(listing.valuation_summary.low)} - {formatNumber(listing.valuation_summary.high)}
                  </span>
                  {listing.valuation_summary.upside && (
                    <span className={`ml-2 ${listing.valuation_summary.upside > 0 ? 'text-accent' : 'text-destructive'}`}>
                      ({listing.valuation_summary.upside > 0 ? '+' : ''}{listing.valuation_summary.upside}%)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-muted-foreground line-clamp-2">{listing.description}</p>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {listing.views_count}
                </div>
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {listing.contact_requests_count}
                </div>
              </div>
              <Button size="sm" variant="outline">View Details</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default MarketplaceListings;