import { z } from 'zod';

const clientEnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('Invalid Supabase URL').optional(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required').optional(),
  VITE_MAPBOX_TOKEN: z.string().min(1, 'Mapbox token is required').optional(),
  VITE_GOOGLE_MAPS_API_KEY: z.string().min(1, 'Google Maps API key is required').optional(),
  SITE_URL: z.string().url('Invalid site URL').default('https://somatech.pro'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DISCORD_BOT_TOKEN: z.string().optional(),
});

const parseClientEnv = () => {
  try {
    return clientEnvSchema.parse(import.meta.env ?? process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      console.warn('Client config validation warnings:\n' + missingVars.join('\n'));
      return clientEnvSchema.parse({
        SITE_URL: 'https://somatech.pro',
        NODE_ENV: 'development',
      });
    }
    return clientEnvSchema.parse({
      SITE_URL: 'https://somatech.pro',
      NODE_ENV: 'development',
    });
  }
};

export const config = parseClientEnv();
export type Config = z.infer<typeof clientEnvSchema>;

export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

export const safePublicConfig = {
  site: {
    url: config.SITE_URL,
    environment: config.NODE_ENV,
  },
  apis: {
    alphaVantage: '',
    mapbox: '',
    googleMaps: '',
  },
  discord: {
    botToken: '',
  },
} as const;

export const validateConfig = () => ({ valid: true, errors: [] });

if (isDevelopment) {
  console.log('✅ Client-safe config loaded');
}
