import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from "../AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, TrendingUp } from "lucide-react";
import { hasActivePushSubscription, registerServiceWorker, requestNotificationPermission, subscribeToPushNotifications, unsubscribeFromPushNotifications } from "../PWAUtils";

interface NotificationPreferences {
  email: boolean;
  in_app: boolean;
  push: boolean;
  marketing: boolean;
  analysis_complete: boolean;
  watchlist_alerts: boolean;
  market_updates: boolean;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  in_app: true,
  push: true,
  marketing: false,
  analysis_complete: true,
  watchlist_alerts: true,
  market_updates: false,
};

const mergeStoredPreferences = (value: unknown): NotificationPreferences => {
  const stored = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(DEFAULT_NOTIFICATION_PREFERENCES).map(([key, fallback]) => [
    key,
    typeof stored[key] === 'boolean' ? stored[key] : fallback,
  ])) as unknown as NotificationPreferences;
};

const NotificationSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestBusy, setDigestBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const requestSequence = useRef(0);
  const activeUserId = useRef<string | null>(user?.id ?? null);
  activeUserId.current = user?.id ?? null;

  const fetchNotificationPreferences = useCallback(async (userId: string, sequence: number) => {
    try {
      const [{ data, error }, { data: emailPreferences, error: emailError }, hasPushSubscription] = await Promise.all([
        supabase.from('system_settings').select('notification_preferences').eq('user_id', userId).maybeSingle(),
        supabase.from('user_email_preferences').select('digest_enabled,marketing_enabled').eq('user_id', userId).maybeSingle(),
        hasActivePushSubscription().catch(() => false),
      ]);

      if (error) throw error;
      if (emailError) throw emailError;
      if (sequence !== requestSequence.current) return;

      const stored = mergeStoredPreferences(data?.notification_preferences);
      setPreferences({
        ...stored,
        push: stored.push !== false && hasPushSubscription,
        // Marketing is governed by the canonical email-consent table. The
        // legacy JSON field is retained only for backward-compatible UI state.
        marketing: emailPreferences?.marketing_enabled === true,
      });
      setDigestEnabled(emailPreferences?.digest_enabled === true);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      if (sequence === requestSequence.current) {
        toast({
          title: 'Preferences unavailable',
          description: 'Notification settings could not be loaded. No consent settings were changed.',
          variant: 'destructive',
        });
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    const sequence = ++requestSequence.current;
    const userId = user?.id ?? null;
    setLoading(true);
    setPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
    setDigestEnabled(false);
    setDigestBusy(false);
    setPushBusy(false);
    setPreferencesBusy(false);
    if (userId) void fetchNotificationPreferences(userId, sequence);
    else setLoading(false);
    return () => {
      if (requestSequence.current === sequence) requestSequence.current = sequence + 1;
    };
  }, [fetchNotificationPreferences, user?.id]);

  const updatePreferences = async (
    newPreferences: NotificationPreferences,
    marketingConsent?: boolean,
    showFailureToast = true,
  ) => {
    if (!user) return;
    const userId = user.id;

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          user_id: userId,
          notification_preferences: newPreferences as unknown as Json,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      if (marketingConsent != null) {
        const { error: consentError } = await supabase.from('user_email_preferences').upsert({
          user_id: userId,
          marketing_enabled: marketingConsent,
          ...(marketingConsent ? { unsubscribed: false, unsubscribed_at: null } : {}),
        }, { onConflict: 'user_id' });
        if (consentError) {
          // Restore the prior legacy JSON if the canonical consent write did
          // not land; the UI must never claim an opt-in that routing will ignore.
          await supabase.from('system_settings').upsert({
            user_id: userId,
            notification_preferences: preferences as unknown as Json,
            updated_at: new Date().toISOString(),
          });
          throw consentError;
        }
      }

      if (activeUserId.current !== userId) return;
      setPreferences(newPreferences);
      toast({
        title: "Success",
        description: "Notification preferences updated",
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      if (activeUserId.current !== userId) return;
      if (showFailureToast) {
        toast({
          title: "Error",
          description: "Failed to update preferences",
          variant: "destructive",
        });
      }
      throw error;
    }
  };

  /**
   * Push is not just a stored preference: the browser must hold a live
   * PushSubscription and the server must have its endpoint, or the toggle
   * reads "on" while nothing can ever be delivered. Enabling therefore
   * registers the service worker, asks for permission and records the
   * subscription; the preference is only saved once that succeeds.
   */
  const enablePush = async (): Promise<boolean> => {
    if (!user) return false;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      toast({ title: "Push not supported", description: "This browser cannot receive push notifications.", variant: "destructive" });
      return false;
    }
    if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      toast({ title: "Push unavailable", description: "Push delivery is not configured for this deployment.", variant: "destructive" });
      return false;
    }
    await registerServiceWorker();
    if (!(await requestNotificationPermission())) {
      toast({ title: "Notifications blocked", description: "Allow notifications in your browser settings to receive push alerts.", variant: "destructive" });
      return false;
    }
    await subscribeToPushNotifications(user.id);
    return true;
  };

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (preferencesBusy) return;
    const nextValue = !preferences[key];
    const userId = user?.id ?? null;
    setPreferencesBusy(true);

    try {
      if (key === "push") {
        setPushBusy(true);
        if (nextValue) {
          if (!(await enablePush())) return;
        } else if (user) {
          await unsubscribeFromPushNotifications(user.id);
        }
      }

      await updatePreferences(
        { ...preferences, [key]: nextValue },
        key === 'marketing' ? nextValue : undefined,
        key !== 'push',
      );
    } catch (error) {
      if (key === 'push') {
        console.error("Push subscription change failed:", error);
        if (nextValue && user) {
          await unsubscribeFromPushNotifications(user.id).catch(() => undefined);
        }
        const hasSubscription = await hasActivePushSubscription().catch(() => false);
        if (activeUserId.current === userId) {
          setPreferences(current => ({ ...current, push: hasSubscription }));
        }
        toast({ title: "Push update failed", description: "Could not update this browser's push subscription.", variant: "destructive" });
      }
    } finally {
      if (key === 'push' && activeUserId.current === userId) setPushBusy(false);
      if (activeUserId.current === userId) setPreferencesBusy(false);
    }
  };

  const handleDigestToggle = async () => {
    if (!user || digestBusy) return;
    const userId = user.id;
    const nextValue = !digestEnabled;
    setDigestBusy(true);
    try {
      const { error } = await supabase.from('user_email_preferences').upsert({
        user_id: userId,
        digest_enabled: nextValue,
        ...(nextValue ? { unsubscribed: false, unsubscribed_at: null } : {}),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      if (activeUserId.current !== userId) return;
      setDigestEnabled(nextValue);
      toast({
        title: nextValue ? 'Weekly insider digest enabled' : 'Weekly insider digest disabled',
        description: nextValue
          ? 'You will receive a summary only when tracked companies have effective Form 4 activity.'
          : 'No further weekly insider digests will be sent.',
      });
    } catch (error) {
      console.error('Digest preference update failed:', error);
      if (activeUserId.current !== userId) return;
      toast({
        title: 'Digest preference not changed',
        description: 'Your prior email consent setting remains in effect.',
        variant: 'destructive',
      });
    } finally {
      if (activeUserId.current === userId) setDigestBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* General Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <CardTitle>General Notifications</CardTitle>
          </div>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              checked={preferences.email}
              disabled={preferencesBusy}
              onCheckedChange={() => void handleToggle('email')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label>In-app Notifications</Label><p className="text-sm text-muted-foreground">Show account and research updates in the notification center</p></div>
            <Switch checked={preferences.in_app} disabled={preferencesBusy} onCheckedChange={() => void handleToggle('in_app')} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5"><Label>Push Notifications</Label><p className="text-sm text-muted-foreground">Allow delivery to browsers you have explicitly connected</p></div>
            <Switch checked={preferences.push} disabled={pushBusy || preferencesBusy} onCheckedChange={() => void handleToggle('push')} />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Marketing Communications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about new features and promotions
              </p>
            </div>
            <Switch
              checked={preferences.marketing}
              disabled={preferencesBusy}
              onCheckedChange={() => void handleToggle('marketing')}
            />
          </div>
        </CardContent>
      </Card>

      {/* TW Ventures Specific */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <CardTitle>TW Ventures Notifications</CardTitle>
          </div>
          <CardDescription>
            Notifications specific to your TW Ventures activities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Analysis Complete</Label>
              <p className="text-sm text-muted-foreground">
                Get notified when your stock analysis is ready
              </p>
            </div>
            <Switch
              checked={preferences.analysis_complete}
              disabled={preferencesBusy}
              onCheckedChange={() => void handleToggle('analysis_complete')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Watchlist Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Price alerts and updates for your watchlist stocks
              </p>
            </div>
            <Switch
              checked={preferences.watchlist_alerts}
              disabled={preferencesBusy}
              onCheckedChange={() => void handleToggle('watchlist_alerts')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Market Updates</Label>
              <p className="text-sm text-muted-foreground">
                Daily market summaries and key economic news
              </p>
            </div>
            <Switch
              checked={preferences.market_updates}
              disabled={preferencesBusy}
              onCheckedChange={() => void handleToggle('market_updates')}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="weekly-insider-digest">Weekly insider activity digest</Label>
              <p className="text-sm text-muted-foreground">
                Opt in to a weekly email of effective SEC Form 4 activity for companies on your watchlist or in your portfolios. Empty weeks are not sent.
              </p>
              {!preferences.email && <p className="mt-1 text-xs text-warning">Email Notifications is off; turn it on before enabling this digest.</p>}
            </div>
            <Switch
              id="weekly-insider-digest"
              checked={digestEnabled}
              disabled={digestBusy || preferencesBusy || (!preferences.email && !digestEnabled)}
              onCheckedChange={() => void handleDigestToggle()}
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default NotificationSettings;
