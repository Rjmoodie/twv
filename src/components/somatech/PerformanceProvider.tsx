import React, { createContext, useContext, useCallback, useRef } from 'react';

interface PerformanceContextType {
  trackPerformance: (name: string, fn: () => void | Promise<void>) => Promise<void>;
  debounce: <T extends (...args: any[]) => any>(fn: T, delay: number) => (...args: Parameters<T>) => void;
  throttle: <T extends (...args: any[]) => any>(fn: T, delay: number) => (...args: Parameters<T>) => void;
}

const PerformanceContext = createContext<PerformanceContextType | null>(null);

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within PerformanceProvider');
  }
  return context;
};

export const PerformanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const trackPerformance = useCallback(async (name: string, fn: () => void | Promise<void>) => {
    const start = performance.now();
    try {
      await fn();
    } finally {
      const end = performance.now();
      console.log(`Performance [${name}]: ${end - start}ms`);
      
      // Log slow operations
      if (end - start > 1000) {
        console.warn(`Slow operation detected: ${name} took ${end - start}ms`);
      }
    }
  }, []);

  const debounce = useCallback(<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): (...args: Parameters<T>) => void => {
    return (...args: Parameters<T>) => {
      const key = fn.name || 'anonymous';
      
      // Clear existing timeout
      const existingTimeout = timeoutRefs.current.get(key);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeout = setTimeout(() => {
        fn(...args);
        timeoutRefs.current.delete(key);
      }, delay);
      
      timeoutRefs.current.set(key, timeout);
    };
  }, []);

  const throttle = useCallback(<T extends (...args: any[]) => any>(
    fn: T, 
    delay: number
  ): (...args: Parameters<T>) => void => {
    let lastCall = 0;
    
    return (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  }, []);

  const value = {
    trackPerformance,
    debounce,
    throttle
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
};

export default PerformanceProvider;