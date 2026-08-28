import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Map, 
  Download, 
  RefreshCw, 
  Home,
  DollarSign,
  Target,
  AlertTriangle,
  Settings,
  Activity,
  MapPin
} from 'lucide-react';
import { LeadGenAPI } from '@/services/api/lead-gen-api';
import { LeadGenData, LeadGenStats, LeadGenFilters } from '@/types/lead-gen';
import PropertyMap from './PropertyMap';
import { DataCoverageTable } from './DataCoverageTable';

interface MapViewport {
  bounds: { north: number; south: number; east: number; west: number };
  center: { lat: number; lng: number };
  zoom: number;
}

const LeadGenDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<LeadGenFilters>({
    state: 'all',
    city: '',
    propertyType: 'all'
  });
  const [properties, setProperties] = useState<LeadGenData[]>([]);
  const [stats, setStats] = useState<LeadGenStats | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<LeadGenData | null>(null);
  const [mapFilters, setMapFilters] = useState({
    showHighEquity: true,
    showDistressed: true,
    showVacant: true,
    minEquity: 0,
    maxEquity: 100
  });
  const [api] = useState(() => new LeadGenAPI());
  const [viewport, setViewport] = useState<MapViewport | null>(null);

  useEffect(() => {
    fetchStats();
    fetchProperties();
  }, []);

  const fetchStats = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const fetchProperties = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const searchFilters = {
        ...filters,
        searchQuery: searchQuery || undefined
      };
      
      const result = await api.searchProperties(searchFilters);
      setProperties(result.data);
    } catch (err) {
      setError('Failed to fetch properties');
      console.error('Property fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchProperties();
  };

  const handleClearCache = () => {
    api.clearCache();
    fetchStats();
  };

  const handleExport = (format: string) => {
    console.log(`Exporting data in ${format} format`);
    // Implementation for export functionality
  };

  const handlePropertyClick = (property: LeadGenData) => {
    setSelectedProperty(property);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getOpportunityColor = (score: number) => {
    if (score >= 8) return 'bg-accent/10 text-accent';
    if (score >= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-destructive/10 text-red-800';
  };

  const visibleProperties = useMemo(() => {
    if (!viewport) return properties;
    const { north, south, east, west } = viewport.bounds;
    const crossesDateline = west > east;

    return properties.filter(property => {
      const withinLat = property.latitude <= north && property.latitude >= south;
      const withinLng = crossesDateline
        ? property.longitude >= west || property.longitude <= east
        : property.longitude >= west && property.longitude <= east;
      return withinLat && withinLng;
    });
  }, [properties, viewport]);

  useEffect(() => {
    if (selectedProperty && visibleProperties.every(property => property.id !== selectedProperty.id)) {
      setSelectedProperty(null);
    }
  }, [selectedProperty, visibleProperties]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Lead Generation</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Find and analyze property opportunities</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              <span className="w-2 h-2 bg-accent rounded-full mr-2"></span>
              Live
            </Badge>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {visibleProperties.length} of {properties.length} in map view
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCache}
            disabled={loading}
          >
            <Settings className="h-4 w-4 mr-2" />
            Clear Cache
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
            disabled={loading}
          >
            <Activity className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
          <CardDescription>
            Find properties based on your investment criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Address, city, or owner..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">State</label>
              <Select value={filters.state} onValueChange={(value) => setFilters(prev => ({ ...prev, state: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="PA">Pennsylvania</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Property Type</label>
              <Select value={filters.propertyType} onValueChange={(value) => setFilters(prev => ({ ...prev, propertyType: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="single-family">Single Family</SelectItem>
                  <SelectItem value="multi-family">Multi Family</SelectItem>
                  <SelectItem value="condo">Condo</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Actions</label>
              <div className="flex gap-2">
                <Button onClick={handleSearch} disabled={loading} className="flex-1">
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
              <Home className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalProperties.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Across {stats.coverage.states} states, {stats.coverage.cities} cities
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatCurrency(stats.totalValue / stats.totalProperties)}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Equity</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.highEquityProperties}</div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage((stats.highEquityProperties / stats.totalProperties) * 100)} of total
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Distressed</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.distressedProperties}</div>
              <p className="text-xs text-muted-foreground">
                {formatPercentage((stats.distressedProperties / stats.totalProperties) * 100)} of total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data coverage reference */}
      <DataCoverageTable />

      {/* Property Results */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Property Results</CardTitle>
            <CardDescription>
              Showing {visibleProperties.length} of {properties.length} properties
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {visibleProperties.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Adjust your map view or filters to discover more properties.
              </div>
            )}
            {visibleProperties.map((property) => (
              <div
                key={property.id}
                className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors ${selectedProperty?.id === property.id ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => handlePropertyClick(property)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{property.address}</h3>
                        <p className="text-sm text-muted-foreground">
                          {property.city}, {property.state} {property.zip}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getOpportunityColor(property.opportunityScore)}`}>
                          Score: {property.opportunityScore}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {property.marketTrend}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Owner</div>
                        <div className="font-medium">{property.owner_name}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Value</div>
                        <div className="font-medium">{formatCurrency(property.estimated_value)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Equity</div>
                        <div className="font-medium">{formatPercentage(property.equity_percent)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Type</div>
                        <div className="font-medium">{property.property_type}</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mt-2">
                      {property.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Map Section */}
      <PropertyMap
        properties={visibleProperties}
        onPropertyClick={handlePropertyClick}
        selectedProperty={selectedProperty}
        filters={mapFilters}
        loading={loading}
        onViewportChange={setViewport}
      />
    </div>
  );
};

export default LeadGenDashboard;
