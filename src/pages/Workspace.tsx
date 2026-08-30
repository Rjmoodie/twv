import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AnimatedSplash from "@/components/app/AnimatedSplash";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import ErrorBoundary from "@/components/app/ErrorBoundary";
import { modules } from "@/components/app/constants";
import AppLayout from "@/components/app/layout/AppLayout";
import ModuleWrapper from "@/components/app/ModuleWrapper";
import ModuleAccessGate from "@/components/app/ModuleAccessGate";
import { useAuth } from "@/components/app/AuthProvider";
import type { PortalPersona } from "@/components/app/AuthProvider";
import { useError } from "@/components/app/ErrorProvider";
import { usePerformance } from "@/components/app/PerformanceProvider";
import { NavigationProvider } from "@/contexts/NavigationContext";
import { ActionGuardProvider } from "@/contexts/ActionGuardContext";
import { savePendingAction, loadPendingAction, clearPendingAction } from "@/lib/pendingAction";
import type { PendingAction } from "@/lib/pendingAction";
import { canEnterPortal } from "@/lib/portalRouting";

import { useSubscription } from "@/hooks/useSubscription";
import { getModuleAccessStatus, getModuleRule, getAccessRequirementLabel } from "@/config/moduleAccess";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
// PageHeader removed — each module renders its own via NavigationWrapper

// Lazy load modules for better performance
const Dashboard = lazyWithRetry(() => import("@/components/app/Dashboard"));
const AuthDialog = lazyWithRetry(() => import("@/components/app/AuthDialog"));
const PrivacyPolicy = lazyWithRetry(() => import("@/components/app/PrivacyPolicy"));
const SupportPage = lazyWithRetry(() => import("@/components/app/SupportPage"));
const TermsOfService = lazyWithRetry(() => import("@/components/app/TermsOfService"));
const AccountSettings = lazyWithRetry(() => import("@/components/app/AccountSettings"));

const PricingDialog = lazyWithRetry(() => import("@/components/app/enterprise/PricingDialog"));

import { toast } from "@/hooks/use-toast";
const RealEstateCalculator = lazyWithRetry(() => import("@/components/app/RealEstateCalculatorContainer"));
const Portfolio = lazyWithRetry(() => import("@/components/app/portfolio/Portfolio"));
const CRM = lazyWithRetry(() => import("@/components/app/crm/CRM"));

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

const getInitialModule = (fallback = 'dashboard') => {
  const urlModule = new URLSearchParams(window.location.search).get('module');
  if (isRoutableModule(urlModule)) return urlModule;
  const storedModule = sessionStorage.getItem('tw-active-module');
  return isRoutableModule(storedModule) ? storedModule : fallback;
};

interface WorkspaceProps {
  portalIntent?: Exclude<PortalPersona, 'admin'>;
}

const Workspace = ({ portalIntent }: WorkspaceProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialModule = useMemo(() => portalIntent ? 'portfolio' : getInitialModule(), [portalIntent]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeModule, setActiveModule] = useState(initialModule);

  // Navigation history for back button support
  const [navHistory, setNavHistory] = useState<string[]>(() => {
    return [initialModule];
  });
  const canGoBack = navHistory.length > 1;

  const handleGoBack = useCallback(() => {
    if (navHistory.length <= 1) return;
    const destination = navHistory[navHistory.length - 2];
    setNavHistory(prev => prev.slice(0, -1));
    setActiveModule(destination);
    sessionStorage.setItem('tw-active-module', destination);
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

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authDialogMessage, setAuthDialogMessage] = useState<string | null>(null);
  const [showPricingDialog, setShowPricingDialog] = useState(false);
  const [pendingUpgradeModule, setPendingUpgradeModule] = useState<string | null>(null);
  const { user, loading: authLoading, access, accessLoading } = useAuth();
  const portalPromptedRef = useRef(false);
  const subscription = useSubscription();
  const { reportError } = useError();
  const { trackPerformance } = usePerformance();

  useEffect(() => {
    if (!portalIntent || authLoading || portalPromptedRef.current) return;
    portalPromptedRef.current = true;
    setActiveModule('portfolio');
    setNavHistory(['portfolio']);
    if (!user) {
      const label = portalIntent === 'project_manager' ? 'Project Manager' : portalIntent.charAt(0).toUpperCase() + portalIntent.slice(1);
      savePendingAction({ type: 'module-access', returnTo: 'portfolio', message: `Sign in to your ${label} portal.` });
      setAuthDialogMessage(`Sign in to your ${label} portal. Access is determined by your project invitation.`);
      setShowAuthDialog(true);
    }
  }, [portalIntent, authLoading, user]);

  useEffect(() => {
    if (!portalIntent || !user || authLoading || accessLoading) return;
    if (!canEnterPortal(portalIntent, access.personas)) {
      toast({
        title: 'Project access not assigned',
        description: 'Ask a workspace administrator for a project invitation for this portal.',
      });
    }
  }, [portalIntent, user, authLoading, accessLoading, access.personas]);

  useEffect(() => {
    if (!user) return;
    const pendingInvite = window.sessionStorage.getItem('tw-pending-project-invite');
    if (pendingInvite) navigate(`/invite/${encodeURIComponent(pendingInvite)}`, { replace: true });
  }, [user, navigate]);

  // ── Animated splash ───────────────────────────────────────────────────────
  // Show the short branded intro once per tab. Auth normally resolves during the
  // animation, but a hard cap prevents a stalled session request from trapping
  // the user behind the splash screen.
  const [splashDone, setSplashDone] = useState(
    () => {
      try {
        return window.sessionStorage.getItem('tw-splash-seen') === '1';
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
        window.sessionStorage.setItem('tw-splash-seen', '1');
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
    const urlModule = isRoutableModule(moduleParam) ? moduleParam : (moduleParam ? null : (portalIntent ? 'portfolio' : 'dashboard'));
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
  }, [searchParams, setSearchParams, portalIntent]);

  // Reset all nav state when user signs out
  useEffect(() => {
    const handleSignedOut = () => {
      setActiveModule('dashboard');
      setNavHistory(['dashboard']);
      setSearchParams({}, { replace: true });
    };
    window.addEventListener('tw:signed-out', handleSignedOut);
    return () => window.removeEventListener('tw:signed-out', handleSignedOut);
  }, [setSearchParams]);

  // Persist active module to sessionStorage whenever it changes
  useEffect(() => {
    sessionStorage.setItem('tw-active-module', activeModule);
  }, [activeModule]);

  const moduleAccessContext = useMemo(() => ({
    user,
    authLoading,
    accessLoading,
    personas: access.personas,
    isSuperAdmin: subscription.userProfile?.role === 'admin' || subscription.userProfile?.role === 'super_admin'
  }), [
    user,
    authLoading,
    accessLoading,
    access.personas,
    subscription.userProfile?.role
  ]);

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

    if (status === 'forbidden') {
      const rule = getModuleRule(moduleId);
      const requirement = getAccessRequirementLabel(rule);
      const moduleName = modules.find((m) => m.id === moduleId)?.name || 'this area';
      toast({
        title: 'Access not assigned',
        description: requirement
          ? `${moduleName} requires ${requirement} access. Ask a workspace administrator to assign it.`
          : (rule?.description || 'Ask a workspace administrator for access to this area.')
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
        onRequestAuth={() => setShowAuthDialog(true)}
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
      case "portfolio":
        return renderWithAccess("portfolio", <Portfolio />);
      case "crm":
        return renderWithAccess("crm", <CRM />);
      case "account":
        return renderWithAccess("account", <AccountSettings />);
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
    const target = pending?.returnTo ?? (portalIntent ? 'portfolio' : 'dashboard');
    // Set the module directly — bypasses enforceModuleAccess so subscription-loading
    // state never silently cancels the redirect. ModuleAccessGate handles gating reactively.
    setActiveModule(target);
    setNavHistory(prev =>
      prev[prev.length - 1] === target ? prev : [...prev.slice(-9), target]
    );
    sessionStorage.setItem('tw-active-module', target);
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
        <AppLayout
          activeModule={activeModule}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          onModuleChange={handleModuleChange}
          onGoBack={handleGoBack}
          canGoBack={canGoBack}
          onRequestAuth={() => setShowAuthDialog(true)}
          user={user}
          authLoading={authLoading}
          subscription={subscription}
        >
          {/* Module Content */}
          {renderContent()}
        </AppLayout>

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
        />
        
      </ErrorBoundary>
      </ActionGuardProvider>
    </NavigationProvider>
    </>
  );

};

export default Workspace;
