import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV !== 'production';

const config: CapacitorConfig = {
  appId: 'com.twventures.app',
  appName: 'TW Ventures',
  webDir: 'dist',

  // ── Server ────────────────────────────────────────────────────────────────
  // Only active in development — stripped automatically in production builds.
  // Set NODE_ENV=production (or run `npm run build`) before cap sync for release.
  ...(isDev && {
    server: {
      url: 'http://localhost:8081',
      cleartext: true,
      allowNavigation: ['*.supabase.co', '*.stripe.com', 'checkout.stripe.com', 'billing.stripe.com'],
    },
  }),

  // ── iOS ───────────────────────────────────────────────────────────────────
  ios: {
    // 'never' + overlaysWebView:true means the web view covers the full screen
    // (including the status bar area). CSS env(safe-area-inset-top) then returns
    // the real status bar height, and our header padding + fixed safe-area cover
    // div handle it correctly. With 'always' + overlaysWebView:false the native
    // inset shows ios.backgroundColor (dark) and env() returns 0 — the strip bug.
    contentInset: 'never',
    backgroundColor: '#F7F8FC',   // light fallback — only visible during native transitions
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    // limitsNavigationsToAppBoundDomains removed — it blocks Stripe checkout
    // redirects (window.location.href to checkout.stripe.com) because
    // WKAppBoundDomains in Info.plist must be manually populated and Capacitor's
    // allowNavigation does NOT satisfy that requirement.
    allowsLinkPreview: false,
    handleApplicationNotifications: true,
  },

  // ── Android ───────────────────────────────────────────────────────────────
  android: {
    backgroundColor: '#0A0C14',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      launchAutoHide: true,
      launchFadeOutDuration: 400,
      backgroundColor: '#0A0C14',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#2563EB',
      splashFullScreen: true,
      splashImmersive: true,
    },

    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0A0C14',
      // true = web view covers the full screen; env(safe-area-inset-top) returns
      // the real status bar height so our CSS header padding works correctly.
      overlaysWebView: true,
      animated: true,
    },

    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },

    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },

    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#2563EB',
      sound: 'beep.wav',
    },

    Haptics: {},
  },
};

export default config;
