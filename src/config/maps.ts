export const MAPS_CONFIG = {
  // Google Maps API Key - Add to your .env file
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  
  // Default map settings
  DEFAULT_CENTER: { lat: 39.8283, lng: -98.5795 }, // Center of USA
  DEFAULT_ZOOM: 4,
  
  // Property marker settings
  MARKER_ICONS: {
    'high-equity': {
      url: '/markers/high-equity.png',
      scaledSize: { width: 32, height: 32 }
    },
    'distressed': {
      url: '/markers/distressed.png', 
      scaledSize: { width: 32, height: 32 }
    },
    'vacant': {
      url: '/markers/vacant.png',
      scaledSize: { width: 32, height: 32 }
    },
    'default': {
      url: '/markers/default.png',
      scaledSize: { width: 24, height: 24 }
    }
  },
  
  // Clustering settings
  CLUSTERING: {
    maxZoom: 15,
    gridSize: 50,
    minimumClusterSize: 3
  },
  
  // Heatmap settings
  HEATMAP: {
    radius: 20,
    opacity: 0.6,
    maxIntensity: 100
  }
};

export const MAP_STYLES = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  }
];
