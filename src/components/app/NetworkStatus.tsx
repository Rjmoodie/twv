import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  Clock
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  onRetry?: () => void;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionType, setConnectionType] = useState<string>('unknown');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setRetryCount(0);
      toast({
        title: "You're back online!",
        description: "All features are now available.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "You're offline",
        description: "Some features may be limited.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get connection info if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      setConnectionType(connection.effectiveType || 'unknown');
      
      const updateConnection = () => {
        setConnectionType(connection.effectiveType || 'unknown');
      };
      
      connection.addEventListener('change', updateConnection);
      
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        connection.removeEventListener('change', updateConnection);
      };
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      // Test connection with a simple fetch
      const response = await fetch('/ping', { 
        method: 'GET',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        setIsOnline(true);
        setRetryCount(0);
        toast({
          title: "Connection restored!",
          description: "You're back online.",
        });
        onRetry?.();
      }
    } catch (error) {
      console.error('Retry failed:', error);
      
      if (retryCount >= 3) {
        toast({
          title: "Still having connection issues",
          description: "Please check your internet connection and try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const getConnectionQuality = () => {
    switch (connectionType) {
      case 'slow-2g':
      case '2g':
        return { quality: 'poor', color: 'text-destructive', label: 'Slow' };
      case '3g':
        return { quality: 'fair', color: 'text-yellow-500', label: 'Fair' };
      case '4g':
        return { quality: 'good', color: 'text-accent', label: 'Good' };
      default:
        return { quality: 'unknown', color: 'text-gray-500', label: 'Unknown' };
    }
  };

  // Don't show anything if online and no issues
  if (isOnline && retryCount === 0) {
    return null;
  }

  const connectionInfo = getConnectionQuality();

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className={cn(
        "border shadow-lg animate-slide-in-right",
        !isOnline ? "border-destructive/20 bg-destructive/10 dark:bg-destructive/10" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className={cn("h-4 w-4", connectionInfo.color)} />
                Connection Issues
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-destructive" />
                You're Offline
              </>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {!isOnline ? (
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Some features may not work properly while offline.
              </p>
              
              <div className="flex items-center gap-2 mb-3">
                <Button 
                  size="sm" 
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="gap-2"
                >
                  {isRetrying ? (
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  Retry {retryCount > 0 && `(${retryCount})`}
                </Button>
                
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  Auto-retry in progress
                </Badge>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm">Connection Quality:</span>
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", connectionInfo.color)}
                >
                  {connectionInfo.label}
                </Badge>
              </div>
              
              {connectionInfo.quality === 'poor' && (
                <p className="text-xs text-muted-foreground">
                  Slow connection detected. Some features may load slowly.
                </p>
              )}
              
              {retryCount > 0 && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-accent" />
                  <span className="text-xs text-accent dark:text-accent">
                    Connection restored after {retryCount} attempt{retryCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Offline capabilities info */}
          {!isOnline && (
            <div className="bg-background/50 p-2 rounded text-xs">
              <p className="font-medium mb-1">Available offline:</p>
              <ul className="text-muted-foreground space-y-0.5">
                <li>• View cached campaigns</li>
                <li>• Access saved calculations</li>
                <li>• Use local tools</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NetworkStatus;