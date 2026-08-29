import React from 'react';
import GroupedNavigation from '@/components/app/GroupedNavigation';
import AdminNavigation from '@/components/app/AdminNavigation';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
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
        "hidden lg:flex flex-col flex-shrink-0",
        "border-r border-border/40 bg-background/75 backdrop-blur-2xl",
        "transition-[width] duration-200 ease-in-out",
        sidebarCollapsed ? "w-[72px]" : "w-[264px]"
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn(
        "flex items-center border-b border-border/60 shrink-0",
        sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-4"
      )}
        style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(64px + env(safe-area-inset-top))' }}
      >
        <div className="shrink-0 rounded-2xl overflow-hidden ring-1 ring-primary/20 shadow-elev-1">
          <Logo width={32} height={32} />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="heading-tight text-sm font-bold text-foreground">TW Ventures</p>
            <p className="label-wide text-muted-foreground" style={{ fontSize: "0.6rem" }}>Real Estate Operations</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
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
      <div className="px-2 pb-2 border-t border-border/60 pt-2">
        <AdminNavigation />
      </div>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-border/60">
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
