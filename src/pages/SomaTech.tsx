import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AnimatedSplash from "@/components/somatech/AnimatedSplash";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useSearchParams } from "react-router-dom";
import ErrorBoundary from "@/components/somatech/ErrorBoundary";
import { modules } from "@/components/somatech/constants";
import SomaTechLayout from "@/components/somatech/layout/SomaTechLayout";
import type { Module } from "@/components/somatech/types";
import ModuleWrapper from "@/components/somatech/ModuleWrapper";
import ModuleAccessGate from "@/components/somatech/ModuleAccessGate";
import { useAuth } from "@/components/somatech/AuthProvider";
import { useError } from "@/components/somatech/ErrorProvider";
import { usePerformance } from "@/components/somatech/PerformanceProvider";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ActionGuardProvider } from "@/contexts/ActionGuardContext";
import { savePendingAction, loadPendingAction, clearPendingAction } from "@/lib/pendingAction";
import type { PendingAction } from "@/lib/pendingAction";

import { useSubscription } from "@/hooks/useSubscription";
import { getModuleAccessStatus, getModuleRule, getRequiredTierLabel } from "@/config/moduleAccess";
import { formatMonthlyPrice } from "@/config/pricing";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
// PageHeader removed — each module renders its own via NavigationWrapper

// Lazy load modules for better performance
const Dashboard = lazyWithRetry(() => import("@/components/somatech/Dashboard"));
const AuthDialog = lazyWithRetry(() => import("@/components/somatech/AuthDialog"));
const PrivacyPolicy = lazyWithRetry(() => import("@/components/somatech/PrivacyPolicy"));
const SupportPage = lazyWithRetry(() => import("@/components/somatech/SupportPage"));
const TermsOfService = lazyWithRetry(() => import("@/components/somatech/TermsOfService"));
const AccountSettings = lazyWithRetry(() => import("@/components/somatech/AccountSettings"));

const PricingDialog = lazyWithRetry(() => import("@/components/somatech/enterprise/PricingDialog"));

import { toast } from "@/hooks/use-toast";
const RealEstateCalculator = lazyWithRetry(() => import("@/components/somatech/RealEstateCalculatorContainer"));
const FinancialCalendar = lazyWithRetry(() => import("@/components/somatech/FinancialCalendar"));

const formatTierLabel = (tier: string) =>
  tier
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Free";

const isRoutableModule = (moduleId: string | null): moduleId is string =>
  !!moduleId && (
    modules.some(module => module.id === moduleId) ||
    ['privacy-policy', 'terms-of-service', 'support', 'account'].includes(moduleId)
  );

const getInitialModule = () => {
  const urlModule = new URLSearchParams(window.location.search).get('module');
  if (isRoutableModule(urlModule)) return urlModule;
  const storedModule = sessionStorage.getItem('somatech-active-module');
  return isRoutableModule(storedModule) ? storedModule : 'dashboard';
};

const SomaTech = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState(getInitialModule);

  // Navigation history for back button support
  const [navHistory, setNavHistory] = useState<string[]>(() => {
    const initial = getInitialModule();
    return [initial];
  });
  const canGoBack = navHistory.length > 1;

  const handleGoBack = useCallback(() => {
    if (navHistory.length <= 1) return;
    const destination = navHistory[navHistory.length - 2];
    setNavHistory(prev => prev.slice(0, -1));
    setActiveModule(destination);
    sessionStorage.setItem('somatech-active-module', destination);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (destination === 'dashboard') nextSearchParams.delete('module');
    else nextSearchParams.set('module', destination);
    setSearchParams(nextSearchParams, { replace: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [navHistory, searchParams, setSearchParams]);

  // Native Android back button — uses static import, not dynamic require
  const handleGoBackRef = useRef(handleGoBack);
  handleGoBackRef.current = handleGoBack;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | null = null;
    CapacitorApp.addListener('backButton', () => {
      if (navHistory.length > 1) {
        handleGoBackRef.current();
      } else {
        CapacitorApp.minimizeApp();
      }
    }).then(h => { handle = h; });
    return () => { handle?.remove(); };
  }, [navHistory.length]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authDialogMessage, setAuthDialogMessage] = useState<string | null>(null);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [pendingUpgradeModule, setPendingUpgradeModule] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const subscription = useSubscription();
  const { reportError } = useError();
  const { trackPerformance } = usePerformance();

  // ── Animated splash ───────────────────────────────────────────────────────
  // Show the short branded intro once per tab. Auth normally resolves during the
  // animation, but a hard cap prevents a stalled session request from trapping
  // the user behind the splash screen.
  const [splashDone, setSplashDone] = useState(
    () => {
      try {
        return window.sessionStorage.getItem('somatech-splash-seen') === '1';
      } catch {
        return false;
      }
    },
  );
  const [animDone, setAnimDone] = useState(splashDone);
  const splashStartedAt = useRef(Date.now());
  const showSplash = !splashDone;
  const handleSplashComplete = useCallback(() => setAnimDone(true), []);

  useEffect(() => {
    if (!showSplash) return;

    const finishSplash = () => {
      try {
        window.sessionStorage.setItem('somatech-splash-seen', '1');
      } catch {
        // Storage may be unavailable in restricted browsing contexts.
      }
      setSplashDone(true);
    };

    if (animDone && !authLoading) {
      finishSplash();
      return;
    }

    const elapsed = Date.now() - splashStartedAt.current;
    const safetyTimer = window.setTimeout(finishSplash, Math.max(0, 1500 - elapsed));
    return () => window.clearTimeout(safetyTimer);
  }, [animDone, authLoading, showSplash]);

  // Handle URL parameters and module state
  useEffect(() => {
    const moduleParam = searchParams.get('module');
    const upgrade = searchParams.get('upgrade');
    const subscriptionResult = searchParams.get('subscription');
    const subscriptionTier = searchParams.get('tier');

    // Set active module from URL parameter.
    //
    // This is the only channel through which NavigationContext consumers — the
    // dashboard widgets, command palette, notification bell, breadcrumbs — reach
    // this component: `navigateToModule` writes the URL and nothing else. Two
    // things therefore have to happen here rather than only in
    // `handleModuleChange`, or those call sites half-work:
    //
    //  - an absent `module` param means the dashboard. Without this, the
    //    "Dashboard" breadcrumb (which deletes the param) left the user staring
    //    at the module they were trying to leave.
    //  - the destination has to enter `navHistory`, or the header's back button
    //    never appears for anyone who arrived from a dashboard widget.
    const urlModule = isRoutableModule(moduleParam) ? moduleParam : (moduleParam ? null : 'dashboard');
    if (urlModule) {
      setActiveModule(urlModule);
      setNavHistory(prev => {
        if (prev[prev.length - 1] === urlModule) return prev;
        if (urlModule === 'dashboard') return ['dashboard'];
        // Browser back lands on the previous entry — pop it rather than pushing
        // a duplicate, which would make the in-app back button walk in circles.
        if (prev[prev.length - 2] === urlModule) return prev.slice(0, -1);
        return [...prev.slice(-9), urlModule];
      });
    }
    
    if (upgrade) {
      const moduleExists = modules.some((module) => module.id === upgrade);
      if (moduleExists) {
        setPendingUpgradeModule(upgrade);
        setShowPricingDialog(true);
      }
    }

    if (subscriptionResult === 'success') {
      const tierLabel = subscriptionTier ? formatTierLabel(subscriptionTier) : null;
      toast({
        title: 'Subscription activated!',
        description: tierLabel
          ? `You're now on the ${tierLabel} plan. All features are unlocked.`
          : 'Your subscription is now active. Welcome to the full platform.',
      });
      const cleaned = new URLSearchParams(searchParams);
      cleaned.delete('subscription');
      cleaned.delete('tier');
      setSearchParams(cleaned, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Reset all nav state when user signs out
  useEffect(() => {
    const handleSignedOut = () => {
      setActiveModule('dashboard');
      setNavHistory(['dashboard']);
      setSearchParams({}, { replace: true });
    };
    window.addEventListener('somatech:signed-out', handleSignedOut);
    return () => window.removeEventListener('somatech:signed-out', handleSignedOut);
  }, [setSearchParams]);

  // Persist active module to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('somatech-active-module', activeModule);
  }, [activeModule]);

  const moduleAccessContext = useMemo(() => ({
    user,
    authLoading,
    subscriptionLoading: subscription.loading,
    hasFeature: subscription.hasFeature,
    subscriptionTier: subscription.subscriptionTier,
    isAdmin: subscription.userProfile?.role === 'admin' || subscription.userProfile?.role === 'super_admin'
  }), [
    user,
    authLoading,
    subscription.loading,
    subscription.hasFeature,
    subscription.subscriptionTier,
    subscription.userProfile?.role
  ]);

  const requestedModuleMeta = useMemo<Module | null>(
    () => (pendingUpgradeModule ? modules.find((module) => module.id === pendingUpgradeModule) ?? null : null),
    [pendingUpgradeModule]
  );

  const handleUpgradeRequest = (moduleId: string) => {
    if (!modules.some((module) => module.id === moduleId)) {
      return;
    }

    setPendingUpgradeModule(moduleId);
    setShowPricingDialog(true);

    const currentUpgrade = searchParams.get('upgrade');
    if (currentUpgrade === moduleId) {
      return;
    }

    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('upgrade', moduleId);
    setSearchParams(newSearchParams);
  };

  const enforceModuleAccess = (moduleId: string): boolean => {
    const status = getModuleAccessStatus(moduleId, moduleAccessContext);

    if (status === 'loading') {
      return false;
    }

    if (status === 'unauthenticated') {
      const rule = getModuleRule(moduleId);
      // Save where user was trying to go so we can redirect after sign-in
      savePendingAction({ type: 'module-access', returnTo: moduleId, message: rule?.description || undefined });
      setAuthDialogMessage(rule?.description || null);
      setShowAuthDialog(true);
      return false;
    }

    if (status === 'upgrade') {
      const rule = getModuleRule(moduleId);
      const tierLabel = getRequiredTierLabel(rule);
      const moduleName = modules.find((m) => m.id === moduleId)?.name || 'this module';
      const requiredTier = rule?.highlightTier || rule?.minimumTier;
      const priceLabel = requiredTier ? formatMonthlyPrice(requiredTier) : null;
      handleUpgradeRequest(moduleId);
      toast({
        title: 'Upgrade required',
        description: tierLabel
          ? `Upgrade to ${tierLabel}${priceLabel ? ` (${priceLabel})` : ''} to unlock ${moduleName}.`
          : (rule?.description || 'Upgrade your plan to unlock this module.')
      });
      return false;
    }

    return true;
  };

  const renderWithAccess = (moduleId: string, element: React.ReactNode) => (
    <ModuleWrapper moduleId={moduleId}>
      <ModuleAccessGate
        moduleId={moduleId}
        user={user}
        authLoading={authLoading}
        subscription={subscription}
        onRequestAuth={() => setShowAuthDialog(true)}
        onRequestUpgrade={handleUpgradeRequest}
      >
        {element}
      </ModuleAccessGate>
    </ModuleWrapper>
  );

  const handleModuleChange = (module: string) => {
    if (!enforceModuleAccess(module)) {
      return;
    }

    try {
      trackPerformance('moduleChange', () => {
        setActiveModule(module);

        // Home always resets history — no back button should appear from dashboard
        if (module === 'dashboard') {
          setNavHistory(['dashboard']);
        } else {
          // Push to navigation history (skip duplicates)
          setNavHistory(prev =>
            prev[prev.length - 1] === module ? prev : [...prev.slice(-9), module]
          );
        }

        // Update URL with module parameter
        const newSearchParams = new URLSearchParams(searchParams);
        if (module === 'dashboard') {
          newSearchParams.delete('module');
        } else {
          newSearchParams.set('module', module);
        }

        setSearchParams(newSearchParams);
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
    } catch (error) {
      reportError(error as Error, 'module-change');
    }
  };


  const handlePricingDialogChange = (open: boolean) => {
    setShowPricingDialog(open);

    if (!open) {
      setPendingUpgradeModule(null);
      if (searchParams.get('upgrade')) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('upgrade');
        setSearchParams(newSearchParams);
      }
    } else if (pendingUpgradeModule) {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('upgrade', pendingUpgradeModule);
      setSearchParams(newSearchParams);
    }
  };

  const renderContent = () => {
    switch (activeModule) {
      case "dashboard":
        return renderWithAccess("dashboard", <Dashboard />);
      case "real-estate":
        return renderWithAccess("real-estate", <RealEstateCalculator />);
      case "account":
        return renderWithAccess("account", <AccountSettings />);
      case "financial-calendar":
        return <ModuleWrapper moduleId="financial-calendar"><FinancialCalendar /></ModuleWrapper>;
      case "support":
        return <ModuleWrapper moduleId="support"><SupportPage /></ModuleWrapper>;
      case "privacy-policy":
        return <ModuleWrapper moduleId="privacy-policy"><PrivacyPolicy /></ModuleWrapper>;
      case "terms-of-service":
        return <ModuleWrapper moduleId="terms-of-service"><TermsOfService /></ModuleWrapper>;
      default:
        return renderWithAccess("dashboard", <Dashboard />);
    }
  };

  const handleRequestAuth = (message: string | null, _pendingAction?: PendingAction) => {
    setAuthDialogMessage(message);
    setShowAuthDialog(true);
  };

  const handleAuthSuccess = () => {
    setShowAuthDialog(false);
    setAuthDialogMessage(null);
    const pending = loadPendingAction();
    clearPendingAction();
    const target = pending?.returnTo ?? 'dashboard';
    // Set the module directly — bypasses enforceModuleAccess so subscription-loading
    // state never silently cancels the redirect. ModuleAccessGate handles gating reactively.
    setActiveModule(target);
    setNavHistory(prev =>
      prev[prev.length - 1] === target ? prev : [...prev.slice(-9), target]
    );
    sessionStorage.setItem('somatech-active-module', target);
    const nextSearchParams = new URLSearchParams(searchParams);
    if (target === 'dashboard') nextSearchParams.delete('module');
    else nextSearchParams.set('module', target);
    setSearchParams(nextSearchParams, { replace: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <>
      {showSplash && <AnimatedSplash onComplete={handleSplashComplete} />}
    <NavigationProvider initialModule={activeModule}>
      <ActionGuardProvider
        user={user}
        subscription={subscription}
        onRequestAuth={handleRequestAuth}
        onRequestUpgrade={handleUpgradeRequest}
      >
      <ErrorBoundary>
        <SomaTechLayout
          activeModule={activeModule}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          onModuleChange={handleModuleChange}
          onGoBack={handleGoBack}
          canGoBack={canGoBack}
          onRequestAuth={() => setShowAuthDialog(true)}
          onRequestUpgrade={handleUpgradeRequest}
          user={user}
          authLoading={authLoading}
          subscription={subscription}
        >
          {/* Module Content */}
          {renderContent()}
        </SomaTechLayout>

        {/* Dialogs */}
        <AuthDialog
          open={showAuthDialog}
          onOpenChange={(open) => { setShowAuthDialog(open); if (!open) setAuthDialogMessage(null); }}
          onAuthSuccess={handleAuthSuccess}
          message={authDialogMessage}
        />
        
        <PricingDialog
          open={showPricingDialog}
          onOpenChange={handlePricingDialogChange}
          subscription={subscription}
          requestedModule={
            pendingUpgradeModule
              ? {
                  id: pendingUpgradeModule,
                  name: requestedModuleMeta?.name ?? formatTierLabel(pendingUpgradeModule),
                }
              : null
          }
        />
        
      </ErrorBoundary>
      </ActionGuardProvider>
    </NavigationProvider>
    </>
  );

};

export default SomaTech;
