import { useCallback, useEffect, useState } from "react";
// Custom debounce implementation to replace lodash dependency
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
    timeout = undefined;
  };
  return debounced;
};
import { toast } from "@/hooks/use-toast";
import { Save, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BRRRRInputs, BRRRRResults } from "./brrrrCalculations";

interface PerformanceOptimizationsProps {
  inputs: BRRRRInputs;
  results: BRRRRResults | null;
  dealName: string;
  dealNotes: string;
  currentDealId: string | null;
  onAutoSave: () => Promise<boolean>;
}

export const PerformanceOptimizations = ({
  inputs,
  results,
  dealName,
  dealNotes,
  currentDealId,
  onAutoSave
}: PerformanceOptimizationsProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Auto-save functionality with debouncing
  const debouncedAutoSave = useCallback(
    debounce(async () => {
      if (!dealName.trim() || !results || !currentDealId) return;
      
      setAutoSaveStatus('saving');
      
      try {
        const success = await onAutoSave();
        if (success) {
          setAutoSaveStatus('saved');
          setLastSaved(new Date());
          setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } else {
          setAutoSaveStatus('error');
        }
      } catch (error) {
        setAutoSaveStatus('error');
        console.error('Auto-save failed:', error);
      }
    }, 3000), // 3 second debounce
    [dealName, results, currentDealId, onAutoSave]
  );

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connection Restored",
        description: "You're back online. Auto-save is enabled.",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "No Internet Connection",
        description: "Working offline. Changes will be saved when connection is restored.",
        variant: "destructive",
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Trigger auto-save when inputs change
  useEffect(() => {
    if (isOnline && currentDealId) {
      debouncedAutoSave();
    }
    
    return () => {
      debouncedAutoSave.cancel();
    };
  }, [inputs, results, dealNotes, isOnline, currentDealId, debouncedAutoSave]);

  // Local storage backup for offline mode
  useEffect(() => {
    if (!isOnline && dealName.trim() && results) {
      const backupData = {
        dealName,
        inputs,
        results,
        dealNotes,
        timestamp: Date.now()
      };
      
      localStorage.setItem(`brrrr_backup_${currentDealId || 'new'}`, JSON.stringify(backupData));
    }
  }, [inputs, results, dealName, dealNotes, currentDealId, isOnline]);

  const getStatusDisplay = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        text: "Offline",
        color: "bg-destructive/100"
      };
    }

    switch (autoSaveStatus) {
      case 'saving':
        return {
          icon: Save,
          text: "Saving...",
          color: "bg-blue-500"
        };
      case 'saved':
        return {
          icon: Save,
          text: "Saved",
          color: "bg-accent"
        };
      case 'error':
        return {
          icon: Save,
          text: "Save Error",
          color: "bg-destructive/100"
        };
      default:
        return {
          icon: Wifi,
          text: "Online",
          color: "bg-accent"
        };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant="secondary" className={`${status.color} text-white gap-1`}>
        <status.icon className="h-3 w-3" />
        {status.text}
      </Badge>
      
      {lastSaved && autoSaveStatus === 'saved' && (
        <span className="text-muted-foreground">
          Last saved: {lastSaved.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};