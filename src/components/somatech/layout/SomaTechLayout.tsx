import React, { useState, useEffect } from "react";
import type { User } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import OfflineIndicator from "@/components/somatech/OfflineIndicator";
import ErrorBoundary from "@/components/somatech/ErrorBoundary";
import SomaTechHeader from "./SomaTechHeader";
import SomaTechSidebar from "./SomaTechSidebar";
import SomaTechContent from "./SomaTechContent";
import SomaTechDialogs from "./SomaTechDialogs";
import FloatingActionMenu from "@/components/somatech/FloatingActionMenu";
import BottomNavigation from "@/components/somatech/BottomNavigation";
import MobileNavigation from "@/components/somatech/MobileNavigation";
import JourneyFlow from "@/components/somatech/journey/JourneyFlow";
import NetworkStatus from "@/components/somatech/NetworkStatus";
import { useAuth } from "@/components/somatech/AuthProvider";
import { useError } from "@/components/somatech/ErrorProvider";
import { usePerformance } from "@/components/somatech/PerformanceProvider";

// Modules that should fill the full available height with their own internal scroll.
// For these, we skip the px-4/py-4 outer wrapper and set main to overflow-hidden
// so there's only ONE scroll container (the module's own).
const EDGE_TO_EDGE_MODULES = new Set(['financial-coach']);

interface SomaTechLayoutProps {
  activeModule: string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  onModuleChange: (module: string) => void;
  onGoBack: () => void;
  canGoBack: boolean;
  onRequestAuth: () => void;
  onRequestUpgrade: (moduleId: string) => void;
  children: React.ReactNode;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
}

const SomaTechLayout: React.FC<SomaTechLayoutProps> = ({
  activeModule,
  sidebarCollapsed,
  setSidebarCollapsed,
  onModuleChange,
  onGoBack,
  canGoBack,
  onRequestAuth,
  onRequestUpgrade,
  children,
  user,
  authLoading,
  subscription,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [journeyOpen, setJourneyOpen] = useState(false);

  // Allow any component to open the journey via a custom event (avoids deep prop threading)
  useEffect(() => {
    const handler = () => setJourneyOpen(true);
    window.addEventListener('somatech:open-journey', handler);
    return () => window.removeEventListener('somatech:open-journey', handler);
  }, []);
  const { profile } = useAuth();
  const { reportError } = useError();
  const { trackPerformance } = usePerformance();

  const handleSidebarToggle = () => {
    try {
      trackPerformance("sidebarToggle", () => setSidebarCollapsed(!sidebarCollapsed));
    } catch (error) {
      reportError(error as Error, "sidebar-toggle");
    }
  };

  return (
    <ErrorBoundary>
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-card focus:px-4 focus:py-2 focus:shadow-elev-2"
      >
        Skip to content
      </a>

      <div className="min-h-screen w-full max-w-full overflow-x-hidden">
        <OfflineIndicator />

        <div className="flex min-h-screen w-full min-w-0">
          {/* Sidebar */}
          <SomaTechSidebar
            activeModule={activeModule}
            sidebarCollapsed={sidebarCollapsed}
            onModuleChange={onModuleChange}
            onRequestAuth={onRequestAuth}
            onRequestUpgrade={onRequestUpgrade}
            onSidebarToggle={handleSidebarToggle}
            user={user}
            authLoading={authLoading}
            subscription={subscription}
          />

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Sticky header */}
            <SomaTechHeader
              activeModule={activeModule}
              user={user}
              profile={profile}
              authLoading={authLoading}
              onModuleChange={onModuleChange}
              onMenuOpen={() => setMobileMenuOpen(true)}
              onGetStarted={() => setJourneyOpen(true)}
              onSignIn={onRequestAuth}
              onGoBack={onGoBack}
              canGoBack={canGoBack}
            />

            {/* Content */}
            <main
              id="main"
              className={EDGE_TO_EDGE_MODULES.has(activeModule)
                ? "flex-1 overflow-hidden flex flex-col edge-to-edge-main"
                : "flex-1 overflow-y-auto overflow-x-hidden pb-24 lg:pb-6"}
            >
              {EDGE_TO_EDGE_MODULES.has(activeModule) ? (
                // Edge-to-edge: no outer padding, module owns its own scroll
                <SomaTechContent activeModule={activeModule}>{children}</SomaTechContent>
              ) : (
                <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto w-full min-w-0">
                  <SomaTechContent activeModule={activeModule}>{children}</SomaTechContent>
                </div>
              )}
            </main>
          </div>

          {/* Mobile bottom nav */}
          <div className="lg:hidden">
            <BottomNavigation
              activeModule={activeModule}
              onModuleChange={onModuleChange}
              onRequestAuth={onRequestAuth}
              onRequestUpgrade={onRequestUpgrade}
              user={user}
              authLoading={authLoading}
              subscription={subscription}
            />
          </div>

          {/* Mobile slide-in navigation drawer */}
          <MobileNavigation
            activeModule={activeModule}
            onModuleChange={onModuleChange}
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            user={user}
            authLoading={authLoading}
            subscription={subscription}
            onRequestAuth={onRequestAuth}
            onRequestUpgrade={onRequestUpgrade}
          />

          <SomaTechDialogs />
          <NetworkStatus />
          <JourneyFlow
            open={journeyOpen}
            onClose={() => setJourneyOpen(false)}
            onRequestAuth={() => { setJourneyOpen(false); onRequestAuth(); }}
            onBrowseCommunity={() => { setJourneyOpen(false); onModuleChange('community'); }}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default SomaTechLayout;
