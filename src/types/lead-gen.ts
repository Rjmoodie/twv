export interface LeadGenData {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number;
  longitude: number;
  owner_name: string;
  owner_type: 'individual' | 'llc' | 'corporation' | 'trust';
  property_type: 'single-family' | 'multi-family' | 'condo' | 'commercial';
  bedrooms?: number;
  bathrooms?: number;
  square_feet?: number;
  lot_size?: number;
  year_built?: number;
  assessed_value: number;
  estimated_value: number;
  equity_percent: number;
  mortgage_status: 'current' | 'delinquent' | 'foreclosure' | 'paid-off';
  lien_status: 'none' | 'tax-lien' | 'mechanics-lien' | 'judgment-lien';
  tags: string[];
  status: 'active' | 'inactive' | 'sold' | 'pending';
  last_updated: string;
  dataSource: 'county_records' | 'mls' | 'public_records' | 'scraped';
  confidence: number;
  opportunityScore: number;
  marketTrend: 'rising' | 'stable' | 'declining';
  daysOnMarket: number;
}

export interface LeadGenStats {
  totalProperties: number;
  totalValue: number;
  averageEquity: number;
  highEquityProperties: number;
  distressedProperties: number;
  vacantProperties: number;
  absenteeOwners: number;
  coverage: {
    states: number;
    counties: number;
    cities: number;
  };
  performance: PerformanceMetrics;
}

export interface LeadGenSearchResult {
  data: LeadGenData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  cacheHitRate: number;
  cacheSize: number;
  memoryUsage: number;
}

export interface CacheMetrics {
  size: number;
  hitRate: number;
  memoryUsage: number;
  evictions: number;
}

export interface LeadGenFilters {
  searchQuery?: string;
  state?: string;
  city?: string;
  propertyType?: string;
  minEquity?: number;
  maxEquity?: number;
  minValue?: number;
  maxValue?: number;
  ownerType?: string;
  tags?: string[];
  status?: string;
}
