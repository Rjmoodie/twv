import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Globe, 
  Settings, 
  Play, 
  Pause, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  MapPin,
  DollarSign,
  Users,
  Building,
  Car,
  School,
  Hospital,
  ShoppingCart,
  Factory,
  Wifi,
  Zap,
  Wind,
  Sun,
  Activity,
  BarChart3,
  Filter,
  Search,
  Download,
  Upload,
  Eye,
  EyeOff
} from 'lucide-react';

import { 
  expandedDataSources, 
  getDataSourceStats, 
  getDataSourcesByCategory, 
  getDataSourcesByState,
  getDataSourcesByPriority,
  getDataSourcesByImplementation,
  ExpandedDataSource 
} from './ExpandedDataSources';

import { 
  ExpandedDataScraper, 
  ScrapingResult, 
  getExpansionSummary,
  implementationPhases,
  defaultScrapingConfig 
} from './ExpandedDataSourcesImplementation';

interface DashboardState {
  isScraping: boolean;
  currentPhase: 'IMMEDIATE' | 'PHASE_2' | 'PHASE_3' | null;
  activeSources: Set<string>;
  results: Map<string, ScrapingResult>;
  stats: any;
  selectedCategory: string;
  selectedState: string;
  selectedPriority: string;
  searchTerm: string;
  showErrors: boolean;
  autoRefresh: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  'MLS': <Database className="h-4 w-4" />,
  'County Assessor': <Building className="h-4 w-4" />,
  'Tax Delinquent': <DollarSign className="h-4 w-4" />,
  'Foreclosures': <AlertTriangle className="h-4 w-4" />,
  'Code Violations': <AlertTriangle className="h-4 w-4" />,
  'Probate Properties': <Users className="h-4 w-4" />,
  'Auctions': <DollarSign className="h-4 w-4" />,
  'REO': <Building className="h-4 w-4" />,
  'Environmental': <Globe className="h-4 w-4" />,
  'Demographics': <Users className="h-4 w-4" />,
  'Economic': <TrendingUp className="h-4 w-4" />,
  'Schools': <School className="h-4 w-4" />,
  'Crime': <AlertTriangle className="h-4 w-4" />,
  'Transportation': <Car className="h-4 w-4" />,
  'Utilities': <Zap className="h-4 w-4" />,
  'Zoning': <MapPin className="h-4 w-4" />,
  'Permits': <Building className="h-4 w-4" />,
  'Flood': <Globe className="h-4 w-4" />,
  'Earthquake': <Activity className="h-4 w-4" />,
  'Airports': <Car className="h-4 w-4" />,
  'Hospitals': <Hospital className="h-4 w-4" />,
  'Shopping Centers': <ShoppingCart className="h-4 w-4" />,
  'Office Buildings': <Building className="h-4 w-4" />,
  'Industrial': <Factory className="h-4 w-4" />,
  'Data Centers': <Wifi className="h-4 w-4" />,
  'Cell Towers': <Wifi className="h-4 w-4" />,
  'Solar Farms': <Sun className="h-4 w-4" />,
  'Wind Farms': <Wind className="h-4 w-4" />
};

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/20',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-accent/10 text-accent border-accent/20'
};

const implementationColors: Record<string, string> = {
  IMMEDIATE: 'bg-blue-100 text-blue-800 border-blue-200',
  PHASE_2: 'bg-purple-100 text-purple-800 border-purple-200',
  PHASE_3: 'bg-gray-100 text-gray-800 border-gray-200'
};

export default function ExpandedDataSourcesDashboard() {
  const [state, setState] = useState<DashboardState>({
    isScraping: false,
    currentPhase: null,
    activeSources: new Set(),
    results: new Map(),
    stats: getDataSourceStats(),
    selectedCategory: 'all',
    selectedState: 'all',
    selectedPriority: 'all',
    searchTerm: '',
    showErrors: false,
    autoRefresh: false
  });

  const [scraper] = useState(() => new ExpandedDataScraper(defaultScrapingConfig));

  // Auto-refresh effect
  useEffect(() => {
    if (!state.autoRefresh) return;

    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        stats: getDataSourceStats()
      }));
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [state.autoRefresh]);

  // Filter data sources based on current filters
  const filteredSources = expandedDataSources.filter(source => {
    if (state.selectedCategory !== 'all' && source.category !== state.selectedCategory) return false;
    if (state.selectedState !== 'all' && source.state !== state.selectedState) return false;
    if (state.selectedPriority !== 'all' && source.priority !== state.selectedPriority) return false;
    if (state.searchTerm && !source.name.toLowerCase().includes(state.searchTerm.toLowerCase())) return false;
    if (state.showErrors && !state.results.get(source.id)?.errors?.length) return false;
    return true;
  });

  const handleStartScraping = async (phase: 'IMMEDIATE' | 'PHASE_2' | 'PHASE_3') => {
    setState(prev => ({ ...prev, isScraping: true, currentPhase: phase }));
    
    try {
      const results = await scraper.scrapeByPhase(phase);
      setState(prev => ({
        ...prev,
        results: new Map([...prev.results, ...results]),
        isScraping: false,
        currentPhase: null
      }));
    } catch (error) {
      console.error('Scraping failed:', error);
      setState(prev => ({ ...prev, isScraping: false, currentPhase: null }));
    }
  };

  const handleScrapeSource = async (sourceId: string) => {
    setState(prev => ({ 
      ...prev, 
      activeSources: new Set([...prev.activeSources, sourceId]) 
    }));

    try {
      const result = await scraper.scrapeSource(sourceId);
      setState(prev => ({
        ...prev,
        results: new Map(prev.results.set(sourceId, result)),
        activeSources: new Set([...prev.activeSources].filter(id => id !== sourceId))
      }));
    } catch (error) {
      console.error(`Failed to scrape ${sourceId}:`, error);
      setState(prev => ({
        ...prev,
        activeSources: new Set([...prev.activeSources].filter(id => id !== sourceId))
      }));
    }
  };

  const handleScrapeCategory = async (category: string) => {
    setState(prev => ({ ...prev, isScraping: true }));
    
    try {
      const results = await scraper.scrapeByCategory(category);
      setState(prev => ({
        ...prev,
        results: new Map([...prev.results, ...results]),
        isScraping: false
      }));
    } catch (error) {
      console.error('Category scraping failed:', error);
      setState(prev => ({ ...prev, isScraping: false }));
    }
  };

  const getSuccessRate = (sourceId: string): number => {
    const result = state.results.get(sourceId);
    if (!result) return 0;
    return result.success ? 100 : 0;
  };

  const getDataQuality = (sourceId: string): number => {
    const result = state.results.get(sourceId);
    if (!result) return 0;
    return Math.round(result.dataQuality * 100);
  };

  const expansionSummary = getExpansionSummary();

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Expanded Data Sources Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and monitor {expansionSummary.totalNewSources} additional real estate data sources
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            checked={state.autoRefresh}
            onCheckedChange={(checked) => setState(prev => ({ ...prev, autoRefresh: checked }))}
          />
          <Label>Auto-refresh</Label>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sources</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expansionSummary.totalNewSources}</div>
            <p className="text-xs text-muted-foreground">
              Across {Object.keys(state.stats.byCategory).length} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expansionSummary.highPrioritySources}</div>
            <p className="text-xs text-muted-foreground">
              Ready for immediate implementation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Quality</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expansionSummary.highQualitySources}</div>
            <p className="text-xs text-muted-foreground">
              Reliable data sources
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Scraping</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.activeSources.size}</div>
            <p className="text-xs text-muted-foreground">
              Sources currently being scraped
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Implementation Phases */}
      <Card>
        <CardHeader>
          <CardTitle>Implementation Phases</CardTitle>
          <CardDescription>
            Manage data source implementation by priority phases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['IMMEDIATE', 'PHASE_2', 'PHASE_3'] as const).map((phase) => (
              <Card key={phase} className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    {phase === 'IMMEDIATE' && <Play className="h-4 w-4" />}
                    {phase === 'PHASE_2' && <Clock className="h-4 w-4" />}
                    {phase === 'PHASE_3' && <Settings className="h-4 w-4" />}
                    <span>{phase.replace('_', ' ')}</span>
                  </CardTitle>
                  <CardDescription>
                    {implementationPhases[phase].length} sources
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Progress</span>
                    <span className="text-sm font-medium">
                      {Math.round((state.results.size / expansionSummary.totalNewSources) * 100)}%
                    </span>
                  </div>
                  <Progress 
                    value={(state.results.size / expansionSummary.totalNewSources) * 100} 
                    className="w-full" 
                  />
                  <Button
                    onClick={() => handleStartScraping(phase)}
                    disabled={state.isScraping}
                    className="w-full"
                    variant={phase === 'IMMEDIATE' ? 'default' : 'outline'}
                  >
                    {state.isScraping && state.currentPhase === phase ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Scraping...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Start {phase.replace('_', ' ')}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={state.selectedCategory}
                onValueChange={(value) => setState(prev => ({ ...prev, selectedCategory: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.keys(state.stats.byCategory).map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={state.selectedState}
                onValueChange={(value) => setState(prev => ({ ...prev, selectedState: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {Array.from(new Set(expandedDataSources.map(s => s.state).filter(Boolean))).map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={state.selectedPriority}
                onValueChange={(value) => setState(prev => ({ ...prev, selectedPriority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sources..."
                  value={state.searchTerm}
                  onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4 mt-4">
            <div className="flex items-center space-x-2">
              <Switch
                checked={state.showErrors}
                onCheckedChange={(checked) => setState(prev => ({ ...prev, showErrors: checked }))}
              />
              <Label>Show only sources with errors</Label>
            </div>

            <Button
              onClick={() => handleScrapeCategory(state.selectedCategory)}
              disabled={state.isScraping || state.selectedCategory === 'all'}
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Scrape Category
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Geographic Map Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <span>Geographic Distribution</span>
          </CardTitle>
          <CardDescription>
            Visual representation of data sources across the United States
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Interactive Map */}
            <div className="relative h-80 w-full border rounded-lg overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Globe className="h-16 w-16 mx-auto text-blue-500 dark:text-blue-400 mb-4" />
                  <h4 className="text-xl font-semibold mb-2">United States Data Coverage</h4>
                  <p className="text-sm text-muted-foreground mb-6">
                    {expandedDataSources.length} data sources across {expandedDataSources.filter(s => s.state).length} states
                  </p>
                  
                  {/* State Grid */}
                  <div className="grid grid-cols-6 md:grid-cols-10 gap-2 max-w-4xl mx-auto">
                    {Array.from(new Set(expandedDataSources.map(s => s.state).filter(Boolean)))
                      .sort()
                      .map(state => {
                        const count = expandedDataSources.filter(s => s.state === state).length;
                        const intensity = Math.min(count / 10, 1); // Normalize to 0-1
                        
                        return (
                          <div 
                            key={state} 
                            className="relative group cursor-pointer"
                            title={`${state}: ${count} sources`}
                          >
                            <div 
                              className="w-8 h-8 rounded border-2 border-blue-300 dark:border-blue-600 flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110"
                              style={{
                                backgroundColor: `rgba(59, 130, 246, ${intensity * 0.3})`,
                                borderColor: `rgba(59, 130, 246, ${intensity * 0.8})`
                              }}
                            >
                              {state}
                            </div>
                            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                              {count} sources
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
              
              {/* Map Controls */}
              <div className="absolute top-4 right-4 flex flex-col space-y-2">
                <Button size="sm" variant="outline" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur">
                  <Eye className="h-4 w-4 mr-1" />
                  All Sources
                </Button>
                <Button size="sm" variant="outline" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur">
                  <Filter className="h-4 w-4 mr-1" />
                  Filter
                </Button>
              </div>
              
              {/* Coverage Stats */}
              <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-gray-800/90 backdrop-blur p-3 rounded border">
                <div className="text-sm font-medium mb-2">Coverage</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>States:</span>
                    <span className="font-medium">{expandedDataSources.filter(s => s.state).length}/50</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Counties:</span>
                    <span className="font-medium">{expandedDataSources.filter(s => s.county).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coverage:</span>
                    <span className="font-medium">{Math.round(expandedDataSources.filter(s => s.state).length / 50 * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Category Distribution */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(state.stats.byCategory).slice(0, 8).map(([category, count]) => (
                <div key={category} className="flex items-center space-x-3 p-3 border rounded bg-white dark:bg-gray-800">
                  {categoryIcons[category] || <Database className="h-4 w-4" />}
                  <div>
                    <div className="font-medium text-sm">{category}</div>
                    <div className="text-xs text-muted-foreground">{count} sources</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources ({filteredSources.length})</CardTitle>
          <CardDescription>
            Manage individual data sources and monitor their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSources.map((source) => {
              const result = state.results.get(source.id);
              const isActive = state.activeSources.has(source.id);
              
              return (
                <Card key={source.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {categoryIcons[source.category] || <Database className="h-4 w-4" />}
                        <div>
                          <h3 className="font-medium">{source.name}</h3>
                          <p className="text-sm text-muted-foreground">{source.description}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className={priorityColors[source.priority]}>
                              {source.priority} priority
                            </Badge>
                            <Badge variant="outline" className={implementationColors[source.implementation]}>
                              {source.implementation.replace('_', ' ')}
                            </Badge>
                            {source.state && (
                              <Badge variant="outline">
                                {source.state}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        {result && (
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {result.recordCount} records
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {result.processingTime}ms
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="text-xs">
                                Success: {getSuccessRate(source.id)}%
                              </div>
                              <div className="text-xs">
                                Quality: {getDataQuality(source.id)}%
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center space-x-2">
                          {result?.errors?.length > 0 && (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          )}
                          {result?.success && (
                            <CheckCircle className="h-4 w-4 text-accent" />
                          )}
                          <Button
                            onClick={() => handleScrapeSource(source.id)}
                            disabled={isActive}
                            size="sm"
                            variant="outline"
                          >
                            {isActive ? (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                Scraping...
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-2" />
                                Scrape
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {result?.errors?.length > 0 && (
                      <Alert className="mt-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          {result.errors.slice(0, 3).join(', ')}
                          {result.errors.length > 3 && ` and ${result.errors.length - 3} more errors`}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="categories">By Category</TabsTrigger>
              <TabsTrigger value="states">By State</TabsTrigger>
              <TabsTrigger value="quality">Data Quality</TabsTrigger>
              <TabsTrigger value="map">Geographic Map</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(state.stats.byPriority).map(([priority, count]) => (
                  <div key={priority} className="text-center">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground capitalize">{priority} Priority</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="categories" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(state.stats.byCategory).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {categoryIcons[category] || <Database className="h-4 w-4" />}
                      <span className="font-medium">{category}</span>
                    </div>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="states" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from(new Set(expandedDataSources.map(s => s.state).filter(Boolean)))
                  .sort()
                  .map(state => {
                    const count = expandedDataSources.filter(s => s.state === state).length;
                    return (
                      <div key={state} className="flex items-center justify-between p-3 border rounded">
                        <span className="font-medium">{state}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    );
                  })}
              </div>
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(state.stats.byQuality).map(([quality, count]) => (
                  <div key={quality} className="text-center p-4 border rounded">
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground">{quality} Quality</div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="map" className="space-y-4">
              <div className="border rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                <div className="text-center mb-4">
                  <h3 className="text-lg font-semibold mb-2">Data Sources Geographic Distribution</h3>
                  <p className="text-sm text-muted-foreground">
                    Interactive map showing data sources across the United States
                  </p>
                </div>
                
                {/* Map Container */}
                <div className="relative h-96 w-full border rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h4 className="text-lg font-medium mb-2">Interactive Map</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Map visualization showing {expandedDataSources.length} data sources
                      </p>
                      
                      {/* State Distribution */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
                        {Array.from(new Set(expandedDataSources.map(s => s.state).filter(Boolean)))
                          .slice(0, 8)
                          .sort()
                          .map(state => {
                            const count = expandedDataSources.filter(s => s.state === state).length;
                            const sources = expandedDataSources.filter(s => s.state === state);
                            const categories = [...new Set(sources.map(s => s.category))];
                            
                            return (
                              <div key={state} className="text-center p-3 border rounded bg-white dark:bg-gray-700">
                                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{state}</div>
                                <div className="text-sm font-medium">{count} sources</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {categories.slice(0, 2).join(', ')}
                                  {categories.length > 2 && '...'}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                      
                      {expandedDataSources.filter(s => s.state).length > 8 && (
                        <div className="mt-4 text-sm text-muted-foreground">
                          +{expandedDataSources.filter(s => s.state).length - 8} more states
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Map Overlay Controls */}
                  <div className="absolute top-4 right-4 flex flex-col space-y-2">
                    <Button size="sm" variant="outline" className="bg-white dark:bg-gray-800">
                      <Eye className="h-4 w-4 mr-1" />
                      Show All
                    </Button>
                    <Button size="sm" variant="outline" className="bg-white dark:bg-gray-800">
                      <Filter className="h-4 w-4 mr-1" />
                      Filter
                    </Button>
                  </div>
                  
                  {/* Legend */}
                  <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 p-3 rounded border">
                    <div className="text-sm font-medium mb-2">Legend</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                        <span>County Assessor</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-destructive/100 rounded-full"></div>
                        <span>Tax Delinquent</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-accent rounded-full"></div>
                        <span>MLS</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span>Environmental</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Geographic Statistics */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded bg-white dark:bg-gray-800">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {expandedDataSources.filter(s => s.state).length}
                    </div>
                    <div className="text-sm text-muted-foreground">States Covered</div>
                  </div>
                  <div className="text-center p-4 border rounded bg-white dark:bg-gray-800">
                    <div className="text-2xl font-bold text-accent dark:text-accent">
                      {expandedDataSources.filter(s => s.county).length}
                    </div>
                    <div className="text-sm text-muted-foreground">Counties with Data</div>
                  </div>
                  <div className="text-center p-4 border rounded bg-white dark:bg-gray-800">
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {Math.round(expandedDataSources.filter(s => s.state).length / 50 * 100)}%
                    </div>
                    <div className="text-sm text-muted-foreground">US Coverage</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
