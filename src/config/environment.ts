// Environment Configuration
// This file provides environment variables with fallbacks for development

export const environment = {
  // Mapbox Configuration
  MAPBOX_TOKEN: import.meta.env.VITE_MAPBOX_TOKEN || '',

  // Supabase Configuration (already configured in client.ts)
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  
  // Development Configuration
  APP_ENV: import.meta.env.VITE_APP_ENV || 'development',
  DEBUG_MODE: import.meta.env.VITE_DEBUG_MODE === 'true',
  
  // Feature Flags
  ENABLE_MAPBOX: import.meta.env.VITE_ENABLE_MAPBOX !== 'false',
  ENABLE_SUPABASE: import.meta.env.VITE_ENABLE_SUPABASE !== 'false',
  
  // API Endpoints
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081',
  
  // Performance Configuration
  CACHE_DURATION: parseInt(import.meta.env.VITE_CACHE_DURATION || '60000'), // 1 minute
  MAX_RESULTS: parseInt(import.meta.env.VITE_MAX_RESULTS || '1000'),
  
  // Map Configuration
  DEFAULT_MAP_CENTER: {
    lng: parseFloat(import.meta.env.VITE_DEFAULT_MAP_LNG || '-98.5795'),
    lat: parseFloat(import.meta.env.VITE_DEFAULT_MAP_LAT || '39.8283')
  },
  DEFAULT_MAP_ZOOM: parseInt(import.meta.env.VITE_DEFAULT_MAP_ZOOM || '4'),
  
  // Search Configuration
  MIN_SEARCH_LENGTH: parseInt(import.meta.env.VITE_MIN_SEARCH_LENGTH || '2'),
  MAX_SUGGESTIONS: parseInt(import.meta.env.VITE_MAX_SUGGESTIONS || '8'),
  
  // UI Configuration
  ANIMATION_DURATION: parseInt(import.meta.env.VITE_ANIMATION_DURATION || '200'),
  DEBOUNCE_DELAY: parseInt(import.meta.env.VITE_DEBOUNCE_DELAY || '300'),
  
  // Error Handling
  MAX_RETRIES: parseInt(import.meta.env.VITE_MAX_RETRIES || '3'),
  RETRY_DELAY: parseInt(import.meta.env.VITE_RETRY_DELAY || '1000'),
};

// Helper functions
export const isDevelopment = environment.APP_ENV === 'development';
export const isProduction = environment.APP_ENV === 'production';

export const hasValidMapboxToken = () => {
  const token = environment.MAPBOX_TOKEN;
  console.log('Token validation check:', { token, length: token?.length });
  return token && token.length > 0;
};

export const getMapboxToken = () => {
  if (!hasValidMapboxToken()) {
    console.warn('Mapbox token not configured. Please set VITE_MAPBOX_TOKEN in your environment variables.');
    return null;
  }
  return environment.MAPBOX_TOKEN;
};

export const logEnvironment = () => {
  if (isDevelopment) {
    console.log('Environment Configuration:', {
      APP_ENV: environment.APP_ENV,
      DEBUG_MODE: environment.DEBUG_MODE,
      ENABLE_MAPBOX: environment.ENABLE_MAPBOX,
      ENABLE_SUPABASE: environment.ENABLE_SUPABASE,
      HAS_MAPBOX_TOKEN: hasValidMapboxToken(),
      API_BASE_URL: environment.API_BASE_URL,
    });
  }
};

// Initialize logging in development
if (isDevelopment) {
  logEnvironment();
}

// 50-State Data Integration Configuration
export interface EnvironmentConfig {
  // Mapbox API for geocoding
  MAPBOX_API_KEY: string;
  
  // Supabase configuration
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  
  // Scraping configuration
  MAX_CONCURRENT_BROWSERS: number;
  REQUEST_DELAY_MS: number;
  MAX_RETRIES: number;
  
  // Data processing configuration
  BATCH_SIZE: number;
  GEOCODING_RATE_LIMIT: number;
}

// Default configuration values for 50-state integration
const defaultConfig: EnvironmentConfig = {
  MAPBOX_API_KEY: import.meta.env.VITE_MAPBOX_API_KEY || environment.MAPBOX_TOKEN,
  SUPABASE_URL: environment.SUPABASE_URL,
  SUPABASE_ANON_KEY: environment.SUPABASE_ANON_KEY,
  MAX_CONCURRENT_BROWSERS: 5,
  REQUEST_DELAY_MS: 1000,
  MAX_RETRIES: 3,
  BATCH_SIZE: 100,
  GEOCODING_RATE_LIMIT: 600 // requests per minute
};

// Environment validation for 50-state integration
export function validateEnvironment(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!defaultConfig.MAPBOX_API_KEY) {
    errors.push('MAPBOX_API_KEY is required for geocoding functionality');
  }
  
  if (!defaultConfig.SUPABASE_URL || !defaultConfig.SUPABASE_ANON_KEY) {
    errors.push('Supabase configuration is required for data storage');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Get configuration with validation for 50-state integration
export function getEnvironmentConfig(): EnvironmentConfig {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    console.warn('Environment configuration issues:', validation.errors);
  }
  
  return defaultConfig;
}

// Helper function to check if a specific feature is available
export function isFeatureAvailable(feature: keyof EnvironmentConfig): boolean {
  const config = getEnvironmentConfig();
  
  switch (feature) {
    case 'MAPBOX_API_KEY':
      return !!config.MAPBOX_API_KEY;
    default:
      return true;
  }
}

export default getEnvironmentConfig; 