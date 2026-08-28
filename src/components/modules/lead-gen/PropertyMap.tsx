import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { 
  MapPin, 
  Layers, 
  ZoomIn, 
  ZoomOut, 
  Target,
  Filter,
  RefreshCw,
  Settings
} from 'lucide-react';
import { LeadGenData } from '@/types/lead-gen';
import { MAPS_CONFIG, MAP_STYLES } from '@/config/maps';

// Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

interface PropertyMapProps {
  properties: LeadGenData[];
  onPropertyClick?: (property: LeadGenData) => void;
  selectedProperty?: LeadGenData | null;
  filters?: {
    showHighEquity?: boolean;
    showDistressed?: boolean;
    showVacant?: boolean;
    minEquity?: number;
    maxEquity?: number;
  };
  loading?: boolean;
  onViewportChange?: (viewport: {
    bounds: { north: number; south: number; east: number; west: number };
    center: { lat: number; lng: number };
    zoom: number;
  }) => void;
}

interface MapMarker {
  position: { lat: number; lng: number };
  property: LeadGenData;
  marker: any;
}

const PropertyMap: React.FC<PropertyMapProps> = ({
  properties,
  onPropertyClick,
  selectedProperty,
  filters = {},
  loading = false,
  onViewportChange
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<MapMarker[]>([]);
  const clusterRef = useRef<any>(null);
  const heatmapRef = useRef<any>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [viewMode, setViewMode] = useState<'markers' | 'heatmap'>('markers');
  const [showClustering, setShowClustering] = useState(true);
  const [zoom, setZoom] = useState(MAPS_CONFIG.DEFAULT_ZOOM);
  const [center, setCenter] = useState(MAPS_CONFIG.DEFAULT_CENTER);

  // Load Google Maps API
  useEffect(() => {
    if (!window.google && MAPS_CONFIG.GOOGLE_MAPS_API_KEY) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_CONFIG.GOOGLE_MAPS_API_KEY}&libraries=geometry,places,visualization`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapLoaded(true);
      };
      document.head.appendChild(script);
    } else if (window.google) {
      setMapLoaded(true);
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: center,
      zoom: zoom,
      styles: MAP_STYLES,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      gestureHandling: 'cooperative'
    });

    mapInstanceRef.current = map;

    // Add map event listeners
    map.addListener('zoom_changed', () => {
      setZoom(map.getZoom());
    });

    map.addListener('center_changed', () => {
      const newCenter = map.getCenter();
      setCenter({ lat: newCenter.lat(), lng: newCenter.lng() });
    });

    const idleListener = map.addListener('idle', () => {
      if (!onViewportChange) return;
      const bounds = map.getBounds();
      const mapCenter = map.getCenter();
      if (!bounds || !mapCenter) return;

      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();

      onViewportChange({
        bounds: {
          north: northEast.lat(),
          east: northEast.lng(),
          south: southWest.lat(),
          west: southWest.lng(),
        },
        center: {
          lat: mapCenter.lat(),
          lng: mapCenter.lng(),
        },
        zoom: map.getZoom(),
      });
    });

    return () => {
      if (mapInstanceRef.current) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
      if (idleListener) {
        window.google.maps.event.removeListener(idleListener);
      }
    };
  }, [mapLoaded, center, zoom, onViewportChange]);

  // Get marker icon based on property tags
  const getMarkerIcon = useCallback((property: LeadGenData) => {
    if (property.tags.includes('high-equity')) {
      return MAPS_CONFIG.MARKER_ICONS['high-equity'];
    }
    if (property.tags.includes('distressed')) {
      return MAPS_CONFIG.MARKER_ICONS['distressed'];
    }
    if (property.tags.includes('vacant')) {
      return MAPS_CONFIG.MARKER_ICONS['vacant'];
    }
    return MAPS_CONFIG.MARKER_ICONS['default'];
  }, []);

  // Filter properties based on current filters
  const filteredProperties = useMemo(() => {
    return properties.filter(property => {
      if (filters.showHighEquity === false && property.tags.includes('high-equity')) return false;
      if (filters.showDistressed === false && property.tags.includes('distressed')) return false;
      if (filters.showVacant === false && property.tags.includes('vacant')) return false;
      if (filters.minEquity !== undefined && property.equity_percent < filters.minEquity) return false;
      if (filters.maxEquity !== undefined && property.equity_percent > filters.maxEquity) return false;
      return true;
    });
  }, [properties, filters.showHighEquity, filters.showDistressed, filters.showVacant, filters.minEquity, filters.maxEquity]);

  // Create property markers
  const createMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(({ marker }) => {
      marker.setMap(null);
    });
    markersRef.current = [];

    // Create new markers
    const newMarkers: MapMarker[] = filteredProperties.map(property => {
      const marker = new window.google.maps.Marker({
        position: { lat: property.latitude, lng: property.longitude },
        map: mapInstanceRef.current,
        icon: getMarkerIcon(property),
        title: `${property.address} - ${property.owner_name}`,
        animation: selectedProperty?.id === property.id ? 
          window.google.maps.Animation.BOUNCE : undefined
      });

      // Add click listener
      marker.addListener('click', () => {
        onPropertyClick?.(property);
      });

      return { position: { lat: property.latitude, lng: property.longitude }, property, marker };
    });

    markersRef.current = newMarkers;

    // Setup clustering if enabled
    if (showClustering && newMarkers.length > 0) {
      const markers = newMarkers.map(m => m.marker);
      
      if (clusterRef.current) {
        clusterRef.current.clearMarkers();
      }

      clusterRef.current = new window.MarkerClusterer(mapInstanceRef.current, markers, {
        gridSize: MAPS_CONFIG.CLUSTERING.gridSize,
        maxZoom: MAPS_CONFIG.CLUSTERING.maxZoom,
        minimumClusterSize: MAPS_CONFIG.CLUSTERING.minimumClusterSize,
        styles: [
          {
            url: '/cluster-marker.png',
            width: 50,
            height: 50,
            textColor: '#ffffff',
            textSize: 14
          }
        ]
      });
    }
  }, [filteredProperties, selectedProperty, showClustering, onPropertyClick, getMarkerIcon]);

  // Create heatmap
  const createHeatmap = useCallback(() => {
    if (!mapInstanceRef.current || !window.google) return;

    // Clear existing heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
    }

    const heatmapData = filteredProperties.map(property => ({
      location: new window.google.maps.LatLng(property.latitude, property.longitude),
      weight: property.opportunityScore
    }));

    heatmapRef.current = new window.google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: mapInstanceRef.current,
      radius: MAPS_CONFIG.HEATMAP.radius,
      opacity: MAPS_CONFIG.HEATMAP.opacity,
      maxIntensity: MAPS_CONFIG.HEATMAP.maxIntensity
    });
  }, [filteredProperties]);

  // Update markers/heatmap when properties or view mode changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (viewMode === 'markers') {
      createMarkers();
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
      }
    } else {
      createHeatmap();
      markersRef.current.forEach(({ marker }) => {
        marker.setMap(null);
      });
      markersRef.current = [];
    }
  }, [filteredProperties, viewMode, createMarkers, createHeatmap]);

  // Center map on selected property
  useEffect(() => {
    if (selectedProperty && mapInstanceRef.current) {
      const position = { lat: selectedProperty.latitude, lng: selectedProperty.longitude };
      mapInstanceRef.current.panTo(position);
      mapInstanceRef.current.setZoom(16);
    }
  }, [selectedProperty]);

  // Map controls
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() + 1);
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setZoom(mapInstanceRef.current.getZoom() - 1);
    }
  };

  const handleCenterOnUSA = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setCenter(MAPS_CONFIG.DEFAULT_CENTER);
      mapInstanceRef.current.setZoom(MAPS_CONFIG.DEFAULT_ZOOM);
    }
  };

  const handleToggleViewMode = () => {
    setViewMode(prev => prev === 'markers' ? 'heatmap' : 'markers');
  };

  const handleToggleClustering = () => {
    setShowClustering(prev => !prev);
  };

  if (!MAPS_CONFIG.GOOGLE_MAPS_API_KEY) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Property Map</CardTitle>
          <CardDescription>Google Maps integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Google Maps API key required</p>
              <p className="text-sm text-gray-500 mt-2">
                Add VITE_GOOGLE_MAPS_API_KEY to your .env file
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Property Map</CardTitle>
            <CardDescription>
              {filteredProperties.length} properties displayed
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {viewMode === 'markers' ? 'Markers' : 'Heatmap'}
            </Badge>
            {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="relative">
          {/* Map Controls */}
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handleZoomIn}
              className="w-8 h-8 p-0"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleZoomOut}
              className="w-8 h-8 p-0"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCenterOnUSA}
              className="w-8 h-8 p-0"
            >
              <Target className="h-4 w-4" />
            </Button>
          </div>

          {/* View Controls */}
          <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-4 w-4" />
              <span className="text-sm font-medium">View Mode</span>
            </div>
            
            <div className="space-y-2">
              <Button
                size="sm"
                variant={viewMode === 'markers' ? 'default' : 'outline'}
                onClick={handleToggleViewMode}
                className="w-full"
              >
                Markers
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'heatmap' ? 'default' : 'outline'}
                onClick={handleToggleViewMode}
                className="w-full"
              >
                Heatmap
              </Button>
            </div>

            {viewMode === 'markers' && (
              <div className="mt-3 pt-3 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Clustering</span>
                  <Switch
                    checked={showClustering}
                    onCheckedChange={handleToggleClustering}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div
            ref={mapRef}
            className="h-96 w-full rounded-lg border"
            style={{ minHeight: '400px' }}
          />
        </div>

        {/* Legend */}
        {viewMode === 'markers' && (
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-accent rounded-full"></div>
              <span className="text-sm">High Equity</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-destructive/100 rounded-full"></div>
              <span className="text-sm">Distressed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
              <span className="text-sm">Vacant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-500 rounded-full"></div>
              <span className="text-sm">Other</span>
            </div>
          </div>
        )}

        {viewMode === 'heatmap' && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Opportunity Score Heatmap</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-200 rounded"></div>
              <span className="text-xs">Low</span>
              <div className="flex-1 h-2 bg-gradient-to-r from-blue-200 via-yellow-200 to-red-200 rounded"></div>
              <span className="text-xs">High</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PropertyMap;
