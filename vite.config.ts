import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { loadEnv } from "vite";

/**
 * Fail a production build that has no Supabase configuration.
 *
 * Without this the build succeeds, deploys clean, and every sign-in then hits
 * `placeholder.supabase.co` with ERR_NAME_NOT_RESOLVED — a silent total auth
 * outage that looks like a healthy deploy. Better to break the deploy than the
 * login.
 *
 * Escape hatch for CI smoke builds that genuinely need no backend:
 *   ALLOW_MISSING_SUPABASE=1 npm run build
 */
function assertProductionEnv(mode: string) {
  if (mode !== "production") return;
  if (process.env.ALLOW_MISSING_SUPABASE === "1") return;

  const env = loadEnv(mode, process.cwd(), "");
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];
  const missing = required.filter((k) => !env[k] && !process.env[k]);

  if (missing.length > 0) {
    throw new Error(
      [
        "",
        "  Production build aborted — missing required environment variables:",
        ...missing.map((k) => `    • ${k}`),
        "",
        "  These are inlined at build time, so a bundle built without them can",
        "  never authenticate, no matter what the server is configured with.",
        "",
        "  This project is built locally and the dist/ folder uploaded to the",
        "  host, so the values must be present HERE, at build time:",
        "",
        "    1. cp .env.example .env",
        "    2. fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY",
        "       (Supabase dashboard → Project Settings → API)",
        "    3. npm run build",
        "",
        "  .env is gitignored, so the keys stay local.",
        "",
        "  Intentionally building without a backend?  ALLOW_MISSING_SUPABASE=1 npm run build",
        "",
      ].join("\n"),
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  assertProductionEnv(mode);
  return ({
  server: {
    host: '0.0.0.0',   // required for Capacitor live-reload on device
    port: 8081,
    historyApiFallback: true,
    proxy: {
      '/api/pdufa': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Vite itself proxies these — no separate server required
      '/proxy/sec-tickers': {
        target: 'https://www.sec.gov',
        changeOrigin: true,
        rewrite: () => '/files/company_tickers.json',
        headers: {
          'User-Agent': 'Somatech research@somatech.pro',
        },
      },
      '/edgar-api': {
        target: 'https://data.sec.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/edgar-api/, ''),
        headers: {
          'User-Agent': 'Somatech research@somatech.pro',
        },
      },
    },
  },
  define: {
    'process.env': process.env,
    'process.env.NODE_ENV': JSON.stringify(mode),
    'process.env.VITE_MAPBOX_TOKEN': JSON.stringify(process.env.VITE_MAPBOX_TOKEN),
    'process.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(process.env.VITE_VAPID_PUBLIC_KEY),
    'process.env.MAPBOX_API_KEY': JSON.stringify(process.env.VITE_MAPBOX_TOKEN),
    'process': {
      env: process.env,
      version: process.version,
      platform: process.platform,
    },
  },
  plugins: [
    react({
      jsxImportSource: 'react',
      jsxRuntime: 'automatic',
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      'react', 
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'recharts',
      'lodash',
      'mapbox-gl'
    ],
    exclude: [
      'framer-motion'
    ]
  },
  build: {
    outDir: 'dist',    // Capacitor reads from here (matches capacitor.config.ts webDir)
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React and routing
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // UI libraries
          'ui-vendor': [
            'lucide-react',
            'clsx',
            'tailwind-merge',
            'class-variance-authority'
          ],
          
          // Radix UI components (grouped by usage)
          'radix-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-aspect-ratio'
          ],
          
          // Data and state management
          'data-vendor': [
            '@tanstack/react-query',
            '@supabase/supabase-js',
            'react-hook-form',
            '@hookform/resolvers'
          ],
          
          // Heavy libraries (lazy loaded)
          'charts': ['recharts'],
          'maps': ['mapbox-gl'],
          'animations': ['framer-motion'],
          
          // Utilities
          'utils': [
            'lodash',
            'date-fns',
            'sonner',
            'vaul',
            'embla-carousel-react',
            'input-otp',
            'react-day-picker',
            'react-error-boundary',
            'react-helmet-async',
            'react-resizable-panels',
            'next-themes',
            'tailwindcss-animate',
            'cmdk',
            'zod'
          ]
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `js/[name]-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(css)$/.test(assetInfo.name)) {
            return `css/[name]-[hash].${ext}`;
          }
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
            return `images/[name]-[hash].${ext}`;
          }
          return `assets/[name]-[hash].${ext}`;
        }
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: mode === 'development',
  },
  css: {
    devSourcemap: mode === 'development',
  },
});
});
