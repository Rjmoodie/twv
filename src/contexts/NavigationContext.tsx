import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavigationHistory {
  module: string;
  timestamp: number;
  scrollPosition?: number;
}

interface NavigationContextType {
  // Current state
  activeModule: string;
  navigationHistory: NavigationHistory[];
  
  // Navigation actions
  navigateToModule: (module: string, options?: { replace?: boolean; saveScroll?: boolean }) => void;
  goBack: () => void;
  canGoBack: boolean;
  
  // Breadcrumb support
  getBreadcrumbs: () => Array<{ id: string; name: string; path?: string }>;
  
  // Scroll management
  saveScrollPosition: (module: string) => void;
  restoreScrollPosition: (module: string) => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

interface NavigationProviderProps {
  children: React.ReactNode;
  initialModule?: string;
}

export const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
  initialModule = 'dashboard'
}) => {
  const [activeModule, setActiveModule] = useState(initialModule);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistory[]>([
    { module: initialModule, timestamp: Date.now() }
  ]);
  
  const location = useLocation();
  const navigate = useNavigate();

  // Keep this context's module in step with the URL, which is the shared source
  // of truth between it and TW Ventures's own module state.
  //
  // The absent-param case matters as much as the present one: the dashboard is
  // addressed by *deleting* `?module=`, so ignoring a null param left this
  // context pinned to whatever the user had open before going home. Everything
  // reading `activeModule` from here — PageHeader's title, breadcrumbs — then
  // labelled the dashboard with the previous module's name.
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const isPortalPath = ['/investor', '/pm', '/client'].includes(location.pathname);
    const moduleParam = urlParams.get('module') || (isPortalPath ? 'portfolio' : 'dashboard');

    if (moduleParam !== activeModule) {
      setActiveModule(moduleParam);
      addToHistory(moduleParam);
    }
  }, [location.search, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToHistory = useCallback((module: string) => {
    setNavigationHistory(prev => {
      const newHistory = [...prev];
      
      // Remove existing entry for this module if it exists
      const existingIndex = newHistory.findIndex(item => item.module === module);
      if (existingIndex !== -1) {
        newHistory.splice(existingIndex, 1);
      }
      
      // Add new entry
      newHistory.push({ module, timestamp: Date.now() });
      
      // Keep only last 10 entries
      return newHistory.slice(-10);
    });
  }, []);

  const navigateToModule = useCallback((
    module: string, 
    options: { replace?: boolean; saveScroll?: boolean } = {}
  ) => {
    const { replace = false, saveScroll = true } = options;
    
    // Save current scroll position if requested
    if (saveScroll) {
      saveScrollPosition(activeModule);
    }
    
    // Update active module
    setActiveModule(module);

    // Dashboard always resets history — back button must not show from home
    if (module === 'dashboard') {
      setNavigationHistory([{ module: 'dashboard', timestamp: Date.now() }]);
    } else if (!replace) {
      addToHistory(module);
    }
    
    // Update URL
    const searchParams = new URLSearchParams(location.search);
    if (module === 'dashboard') {
      searchParams.delete('module');
    } else {
      searchParams.set('module', module);
    }
    
    const newUrl = `/${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    if (replace) {
      navigate(newUrl, { replace: true });
    } else {
      navigate(newUrl);
    }
    
    // Restore scroll position for new module
    setTimeout(() => {
      restoreScrollPosition(module);
    }, 100);
  }, [activeModule, location.search, navigate, addToHistory]);

  const goBack = useCallback(() => {
    if (navigationHistory.length > 1) {
      const previousModule = navigationHistory[navigationHistory.length - 2];
      
      // Save current scroll position
      saveScrollPosition(activeModule);
      
      // Navigate to previous module
      navigateToModule(previousModule.module, { replace: true });
      
      // Remove current module from history
      setNavigationHistory(prev => prev.slice(0, -1));
    } else {
      // Default to dashboard if no history
      navigateToModule('dashboard', { replace: true });
    }
  }, [navigationHistory, activeModule, navigateToModule]);

  const canGoBack = navigationHistory.length > 1;

  const getBreadcrumbs = useCallback(() => {
    const breadcrumbs = [
      { id: 'dashboard', name: 'Dashboard', path: '/dashboard' }
    ];
    
    if (activeModule !== 'dashboard') {
      // Add current module to breadcrumbs
      breadcrumbs.push({
        id: activeModule,
        name: activeModule.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        path: `/?module=${encodeURIComponent(activeModule)}`,
      });
    }
    
    return breadcrumbs;
  }, [activeModule]);

  const saveScrollPosition = useCallback((module: string) => {
    const scrollPosition = window.scrollY;
    sessionStorage.setItem(`scroll-${module}`, scrollPosition.toString());
  }, []);

  const restoreScrollPosition = useCallback((module: string) => {
    const savedPosition = sessionStorage.getItem(`scroll-${module}`);
    if (savedPosition) {
      window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const value: NavigationContextType = {
    activeModule,
    navigationHistory,
    navigateToModule,
    goBack,
    canGoBack,
    getBreadcrumbs,
    saveScrollPosition,
    restoreScrollPosition
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const context = useContext(NavigationContext);
  if (context === undefined) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
