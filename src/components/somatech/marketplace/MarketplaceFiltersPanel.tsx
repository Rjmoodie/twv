import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarketplaceFilters } from "../types";

interface MarketplaceFiltersPanelProps {
  filters: MarketplaceFilters;
  onFiltersChange: (filters: MarketplaceFilters) => void;
}

const MarketplaceFiltersPanel = ({ filters, onFiltersChange }: MarketplaceFiltersPanelProps) => {
  const updateFilter = (key: keyof MarketplaceFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const industries = [
    "Technology", "Healthcare", "Financial Services", "Manufacturing",
    "Retail", "Real Estate", "Professional Services", "Food & Beverage",
    "Education", "Transportation", "Energy", "Media & Entertainment"
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sort By */}
        <div className="space-y-2">
          <Label>Sort By</Label>
          <Select value={filters.sortBy} onValueChange={(value: any) => updateFilter('sortBy', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="price_asc">Price: Low to High</SelectItem>
              <SelectItem value="price_desc">Price: High to Low</SelectItem>
              <SelectItem value="ebitda_desc">Highest EBITDA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label>Industry</Label>
          <Select value={filters.industry || ""} onValueChange={(value) => updateFilter('industry', value || undefined)}>
            <SelectTrigger>
              <SelectValue placeholder="All Industries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Industries</SelectItem>
              {industries.map((industry) => (
                <SelectItem key={industry} value={industry}>{industry}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <Label>Location</Label>
          <Input
            placeholder="City, State, or Country"
            value={filters.location || ""}
            onChange={(e) => updateFilter('location', e.target.value || undefined)}
          />
        </div>

        {/* Price Range */}
        <div className="space-y-2">
          <Label>Asking Price Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.priceMin || ""}
              onChange={(e) => updateFilter('priceMin', e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.priceMax || ""}
              onChange={(e) => updateFilter('priceMax', e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>

        {/* EBITDA Range */}
        <div className="space-y-2">
          <Label>EBITDA Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={filters.ebitdaMin || ""}
              onChange={(e) => updateFilter('ebitdaMin', e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <Input
              type="number"
              placeholder="Max"
              value={filters.ebitdaMax || ""}
              onChange={(e) => updateFilter('ebitdaMax', e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketplaceFiltersPanel;