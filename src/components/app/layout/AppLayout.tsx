import React, { useState } from "react";
import type { User } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import OfflineIndicator from "@/components/app/OfflineIndicator";
import ErrorBoundary from "@/components/app/ErrorBoundary";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import AppContent from "./AppContent";
import AppDialogs from "./AppDialogs";
import BottomNavigation from "@/components/app/BottomNavigation";
import MobileNavigation from "@/components/app/MobileNavigation";
import NetworkStatus from "@/components/app/NetworkStatus";
import { useAuth } from "@/components/app/AuthProvider";
import { useError } from "@/components/app/ErrorProvider";
import { usePerformance } from "@/components/app/PerformanceProvider";

// Modules that should fill the full available height with their own internal scroll.
// For these, we skip the px-4/py-4 outer wrapper and set main to overflow-hidden
// so there's only ONE scroll container (the module's own).
const EDGE_TO_EDGE_MODULES = new Set<string>([]);

interface AppLayoutProps {
  activeModule: string;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  onModuleChange: (module: string) => void;
  onGoBack: () => void;
  canGoBack: boolean;
  onRequestAuth: () => void;
  children: React.ReactNode;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  activeModule,
  sidebarCollapsed,
  setSidebarCollapsed,
  onModuleChange,
  onGoBack,
  canGoBack,
  onRequestAuth,
  children,
  user,
  authLoading,
  subscription,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
          <AppSidebar
            activeModule={activeModule}
            sidebarCollapsed={sidebarCollapsed}
            onModuleChange={onModuleChange}
            onRequestAuth={onRequestAuth}
            onSidebarToggle={handleSidebarToggle}
            user={user}
            authLoading={authLoading}
            subscription={subscription}
          />

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Sticky header */}
            <AppHeader
              activeModule={activeModule}
              user={user}
              profile={profile}
              authLoading={authLoading}
              onModuleChange={onModuleChange}
              onMenuOpen={() => setMobileMenuOpen(true)}
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
                <AppContent activeModule={activeModule}>{children}</AppContent>
              ) : (
                <div className="px-4 py-4 sm:px-6 sm:py-6 max-w-7xl mx-auto w-full min-w-0">
                  <AppContent activeModule={activeModule}>{children}</AppContent>
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
          />

          <AppDialogs />
          <NetworkStatus />
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AppLayout;
