import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';


interface NavigationContextType {
  // Current state
  activeModule: string;
  
  // Navigation actions
  navigateToModule: (module: string, options?: { replace?: boolean; saveScroll?: boolean }) => void;
  
  // Breadcrumb support name: string; path?: string }>;
  
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
    }
  }, [location.search, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps


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
  }, [activeModule, location.search, navigate]);




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
    navigateToModule,
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
