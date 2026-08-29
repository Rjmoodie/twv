import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PWAInstaller, requestNotificationPermission, subscribeToPushNotifications, unsubscribeFromPushNotifications, registerServiceWorker } from "./PWAUtils";
import { Smartphone, Download, Bell, Wifi, Zap, CheckCircle } from "lucide-react";

const PWAManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pwaInstaller] = useState(new PWAInstaller());
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    checkPWAStatus();
    initializeServiceWorker();
  }, []);

  const checkPWAStatus = () => {
    setCanInstall(pwaInstaller.canInstall());
    setIsInstalled(pwaInstaller.isInstalled());
    setNotificationsEnabled(Notification.permission === 'granted');
  };

  const initializeServiceWorker = async () => {
    try {
      await registerServiceWorker();
      setOfflineReady(true);
    } catch (error) {
      console.error('Failed to register service worker:', error);
    }
  };

  const handleInstallPWA = async () => {
    try {
      const installed = await pwaInstaller.install();
      if (installed) {
        toast({
          title: "App Installed! 🎉",
          description: "TW Ventures has been added to your device",
        });
        setIsInstalled(true);
        setCanInstall(false);
      }
    } catch (error) {
      toast({
        title: "Installation Failed",
        description: "Unable to install the app. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEnableNotifications = async () => {
    try {
      if (notificationsEnabled && user) {
        await unsubscribeFromPushNotifications(user.id);
        setNotificationsEnabled(false);
        toast({ title: 'Push notifications disabled' });
        return;
      }
      const granted = await requestNotificationPermission();
      
      if (granted && user) {
        await subscribeToPushNotifications(user.id);
        setNotificationsEnabled(true);
        
        toast({
          title: "Notifications Enabled! 🔔",
          description: "You'll now receive push notifications for important updates",
        });
      } else {
        toast({
          title: "Notifications Blocked",
          description: "Please enable notifications in your browser settings",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to Enable Notifications",
        description: "There was an issue setting up push notifications",
        variant: "destructive",
      });
    }
  };

  const features = [
    {
      title: "Offline Access",
      description: "Continue using TW Ventures even without internet connection",
      icon: Wifi,
      enabled: offlineReady,
      color: "text-blue-600"
    },
    {
      title: "Push Notifications",
      description: "Get instant alerts for price changes and analysis updates",
      icon: Bell,
      enabled: notificationsEnabled,
      color: "text-purple-600"
    },
    {
      title: "Fast Loading",
      description: "Lightning-fast app performance with caching",
      icon: Zap,
      enabled: true,
      color: "text-yellow-600"
    },
    {
      title: "Home Screen Access",
      description: "Quick access from your device's home screen",
      icon: Smartphone,
      enabled: isInstalled,
      color: "text-accent"
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mobile Experience</h1>
          <p className="text-muted-foreground">
            Get the best TW Ventures experience on your mobile device
          </p>
        </div>

        {/* Install App */}
        {canInstall && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Install TW Ventures App
              </CardTitle>
              <CardDescription>
                Add TW Ventures to your home screen for a native app experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="font-medium">Progressive Web App</div>
                  <div className="text-sm text-muted-foreground">
                    Works offline • Fast loading • Native feel
                  </div>
                </div>
                <Button onClick={handleInstallPWA}>
                  <Download className="h-4 w-4 mr-2" />
                  Install App
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* App Status */}
        {isInstalled && (
          <Card className="border-accent/20 bg-accent/10 dark:bg-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-accent" />
                <div>
                  <div className="font-medium">App Installed Successfully!</div>
                  <div className="text-sm text-muted-foreground">
                    TW Ventures is now available on your home screen
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Mobile Features</CardTitle>
            <CardDescription>
              Enhanced capabilities for mobile users
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {features.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <div key={feature.title} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg border ${feature.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{feature.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {feature.enabled ? (
                      <Badge variant="default">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Disabled</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Push Notifications
            </CardTitle>
            <CardDescription>
              Stay updated with real-time alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Enable Push Notifications</Label>
                <div className="text-sm text-muted-foreground">
                  Receive alerts for price changes, analysis completion, and important updates
                </div>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleEnableNotifications}
                disabled={!user}
              />
            </div>

            {!user && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm text-muted-foreground">
                  Sign in to enable push notifications and get personalized alerts
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Mobile Tips</CardTitle>
            <CardDescription>
              Get the most out of TW Ventures on mobile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="font-medium">📱 Home Screen Shortcut</div>
                <div className="text-sm text-muted-foreground">
                  Add TW Ventures to your home screen for quick access
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium">🔔 Smart Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Enable notifications to never miss important market updates
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium">📊 Touch Gestures</div>
                <div className="text-sm text-muted-foreground">
                  Swipe and tap to navigate charts and data efficiently
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="font-medium">🌐 Offline Mode</div>
                <div className="text-sm text-muted-foreground">
                  Continue viewing your saved data even without internet
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PWAManager;
