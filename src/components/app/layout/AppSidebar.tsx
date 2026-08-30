import React from 'react';
import GroupedNavigation from '@/components/app/GroupedNavigation';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import AdminNavigation from '@/components/app/AdminNavigation';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import Logo from '@/components/app/Logo';

interface AppSidebarProps {
  activeModule: string;
  sidebarCollapsed: boolean;
  onModuleChange: (module: string) => void;
  onRequestAuth: () => void;
  onSidebarToggle: () => void;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
}

const AppSidebar: React.FC<AppSidebarProps> = ({
  activeModule,
  sidebarCollapsed,
  onModuleChange,
  onRequestAuth,
  onSidebarToggle,
  user,
  authLoading,
  subscription,
}) => {
  return (
    <aside
      className={cn(
        "operations-sidebar hidden lg:flex flex-col flex-shrink-0",
        "border-r",
        "transition-[width] duration-200 ease-in-out",
        sidebarCollapsed ? "w-[72px]" : "w-[264px]"
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn(
        "operations-sidebar__brand flex items-center border-b shrink-0",
        sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-4"
      )}
        style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(64px + env(safe-area-inset-top))' }}
      >
        <div className="operations-sidebar__mark shrink-0 overflow-hidden">
          <Logo width={42} height={36} />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="operations-sidebar__name">TW Ventures</p>
            <span className="operations-sidebar__rule" />
            <p className="operations-sidebar__section">Asset Operations</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="operations-sidebar__nav flex-1 overflow-y-auto py-4 px-3">
        <GroupedNavigation
          activeModule={activeModule}
          onModuleChange={onModuleChange}
          onRequestAuth={onRequestAuth}
          variant="desktop"
          user={user}
          authLoading={authLoading}
          subscription={subscription}
        />
      </nav>

      {/* Admin */}
      <div className="operations-sidebar__utility px-3 pb-2 border-t pt-2">
        <AdminNavigation />
      </div>

      {/* Collapse toggle */}
      <div className="operations-sidebar__utility p-3 border-t">
        <button
          onClick={onSidebarToggle}
          className={cn(
            "flex items-center w-full rounded-xl px-2 py-2 text-xs font-medium",
            "text-muted-foreground hover:text-foreground hover:bg-muted/70",
            "transition-colors duration-150",
            sidebarCollapsed ? "justify-center" : "gap-2"
          )}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed
            ? <PanelLeft className="h-4 w-4" />
            : <><PanelLeftClose className="h-4 w-4" /><span>Collapse</span></>
          }
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
