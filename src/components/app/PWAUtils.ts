import { supabase } from '@/integrations/supabase/client';

// PWA Configuration
const PWA_CONFIG = {
  name: "TW Ventures",
  short_name: "TW Ventures",
  description: "Real estate development and construction management",
  start_url: "/?module=dashboard&utm_source=pwa",
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#3b82f6",
  orientation: "portrait",
  categories: ["finance", "business", "productivity"],
  shortcuts: [
    {
      name: "Real Estate",
      short_name: "Underwrite",
      description: "Open the real estate underwriting workspace",
      url: "/?module=real-estate",
      icons: [{ src: "/logo-192.png", sizes: "192x192", type: "image/png" }]
    },
    {
      name: "Account",
      short_name: "Account",
      description: "Manage your account and preferences",
      url: "/?module=account",
      icons: [{ src: "/logo-192.png", sizes: "192x192", type: "image/png" }]
    },
    {
      name: "Dashboard",
      short_name: "Dashboard",
      description: "Review rates and operational context",
      url: "/?module=dashboard",
      icons: [{ src: "/logo-192.png", sizes: "192x192", type: "image/png" }]
    }
  ]
};

// Service Worker Registration
export const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('ServiceWorker registration successful:', registration);
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Show update available notification
              showUpdateNotification();
            }
          });
        }
      });
      
      return registration;
    } catch (error) {
      console.error('ServiceWorker registration failed:', error);
    }
  }
};

// Push Notifications
export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

export const subscribeToPushNotifications = async (userId: string) => {
  try {
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY || '')
    });
    
    const serialized = subscription.toJSON();
    if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys?.auth) throw new Error('Browser returned an incomplete push subscription');
    const { error } = await supabase.from('push_subscriptions').upsert({ user_id: userId, endpoint: serialized.endpoint, p256dh: serialized.keys.p256dh, auth: serialized.keys.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' });
    if (error) throw error;
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    throw error;
  }
};

export const unsubscribeFromPushNotifications = async (userId: string) => {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    try {
      const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', subscription.endpoint);
      if (error) throw error;
    } finally {
      // Privacy fails closed on this device. Even when the authenticated delete
      // cannot reach the server, invalidating the browser endpoint prevents it
      // from receiving another account-scoped notification; the dispatcher
      // removes the stale endpoint after the provider returns 404/410.
      await subscription.unsubscribe();
    }
  }
};

export const disablePushDeviceLocally = async (userId?: string | null) => {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try {
    if (userId) {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', subscription.endpoint);
    }
  } catch (error) {
    console.warn('Could not remove the push endpoint from the account:', error);
  } finally {
    await subscription.unsubscribe().catch(() => false);
  }
};

export const hasActivePushSubscription = async (): Promise<boolean> => {
  if (!("serviceWorker" in navigator)) return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await registration?.pushManager.getSubscription());
};

// Utility functions
const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const showUpdateNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('TW Ventures Update Available', {
      body: 'A new version of TW Ventures is available. Refresh to update.',
      icon: '/logo-192.png',
      badge: '/logo-192.png',
      tag: 'app-update'
    });
  }
};

// Install Prompt
export class PWAInstaller {
  private deferredPrompt: any = null;
  private installed = false;

  constructor() {
    this.init();
  }

  private init() {
    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Save the event so it can be triggered later
      this.deferredPrompt = e;
    });

    // Listen for the appinstalled event
    window.addEventListener('appinstalled', () => {
      this.installed = true;
      this.deferredPrompt = null;
    });
  }

  canInstall(): boolean {
    return !!this.deferredPrompt && !this.installed;
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    // Show the install prompt
    this.deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await this.deferredPrompt.userChoice;
    
    // Clear the deferredPrompt
    this.deferredPrompt = null;
    
    return outcome === 'accepted';
  }

  isInstalled(): boolean {
    return this.installed || window.matchMedia('(display-mode: standalone)').matches;
  }
}

/**
 * Offline storage. Currently unreferenced — nothing imports this class.
 *
 * Renaming an IndexedDB database does not migrate it: the old database is
 * orphaned in the browser and a new empty one is created. That is only safe
 * here *because* nothing uses this yet. If it ever ships, treat the name and
 * version as fixed and migrate through `onupgradeneeded` instead.
 */
export class OfflineStorage {
  private dbName = 'TWVenturesOffline';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create stores for offline data. The 'watchlist' store went with the
        // non-real-estate cut; deals and project data replace it when this is
        // actually wired up.
        if (!db.objectStoreNames.contains('analyses')) {
          const analysesStore = db.createObjectStore('analyses', { keyPath: 'id' });
          analysesStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
        
        if (!db.objectStoreNames.contains('notifications')) {
          const notificationsStore = db.createObjectStore('notifications', { keyPath: 'id' });
          notificationsStore.createIndex('timestamp', 'created_at', { unique: false });
        }
      };
    });
  }

  async store(storeName: string, data: any[]) {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    for (const item of data) {
      await store.put(item);
    }
    
    return new Promise<void>((resolve) => {
      transaction.oncomplete = () => resolve();
    });
  }

  async get(storeName: string, key?: string) {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    if (key) {
      return store.get(key);
    } else {
      return store.getAll();
    }
  }

  async clear(storeName: string) {
    if (!this.db) await this.init();
    
    const transaction = this.db!.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return store.clear();
  }
}

export { PWA_CONFIG };
