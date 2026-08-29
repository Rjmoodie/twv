import { useState, useEffect } from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { WifiOff, Wifi } from "lucide-react";

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Alert className={`${
        isOnline 
          ? 'border-accent/20 bg-accent/10 text-accent dark:border-accent/20 dark:bg-accent dark:text-accent' 
          : 'border-orange-200 bg-warning/10 text-warning dark:border-orange-800 dark:bg-warning/15 dark:text-warning'
      } animate-slide-down`}>
        {isOnline ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
        <AlertDescription>
          {isOnline 
            ? "You're back online! All features are available."
            : "You're offline. Some features may not work properly."
          }
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default OfflineIndicator;