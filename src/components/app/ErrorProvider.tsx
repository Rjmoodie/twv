import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface ErrorInfo {
  error: Error;
  errorInfo?: any;
  timestamp: number;
  context?: string;
}

interface ErrorContextType {
  errors: ErrorInfo[];
  reportError: (error: Error, context?: string) => void;
  clearErrors: () => void;
  isOnline: boolean;
}

const ErrorContext = createContext<ErrorContextType | null>(null);

export const useError = () => {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useError must be used within ErrorProvider');
  }
  return context;
};

export const ErrorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorInfo[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: "Connection Restored",
        description: "You're back online!",
        variant: "default",
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: "Connection Lost",
        description: "Some features may not work properly.",
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

  const reportError = useCallback((error: Error, context?: string) => {
    const errorInfo: ErrorInfo = {
      error,
      timestamp: Date.now(),
      context,
    };

    setErrors(prev => [...prev.slice(-9), errorInfo]); // Keep last 10 errors

    // Show user-friendly error message
    const userMessage = getUserFriendlyMessage(error, context);
    toast({
      title: "Something went wrong",
      description: userMessage,
      variant: "destructive",
    });

    // Log to console for debugging
    console.error(`Error in ${context || 'Unknown'}:`, error);
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const value = {
    errors,
    reportError,
    clearErrors,
    isOnline,
  };

  return (
    <ErrorContext.Provider value={value}>
      {children}
    </ErrorContext.Provider>
  );
};

function getUserFriendlyMessage(error: Error, context?: string): string {
  // Network errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return "Please check your internet connection and try again.";
  }

  // Auth errors
  if (context?.includes('auth') || error.message.includes('auth')) {
    return "Authentication issue. Please try signing in again.";
  }

  // Permission errors
  if (error.message.includes('permission') || error.message.includes('unauthorized')) {
    return "You don't have permission to perform this action.";
  }

  // Module specific errors
  if (context?.includes('real-estate')) {
    return "Unable to load real estate data. Please try again.";
  }

  if (context?.includes('stock')) {
    return "Unable to fetch stock data. Please try again later.";
  }

  // Generic fallback
  return "An unexpected error occurred. Please try again.";
}

export default ErrorProvider;