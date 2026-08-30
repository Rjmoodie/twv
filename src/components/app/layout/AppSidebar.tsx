import React from 'react';
import GroupedNavigation from '@/components/app/GroupedNavigation';
import AdminNavigation from '@/components/app/AdminNavigation';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import Logo from '@/components/app/Logo';

interface AppSidebarProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  onRequestAuth: () => void;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
}

const AppSidebar: React.FC<AppSidebarProps> = ({
  activeModule,
  onModuleChange,
  onRequestAuth,
  user,
  authLoading,
  subscription,
}) => {
  return (
    <aside
      className={cn(
        "operations-sidebar hidden lg:flex flex-col flex-shrink-0",
        "border-r",
        "w-[264px]"
      )}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className={cn(
        "operations-sidebar__brand flex items-center border-b shrink-0",
        "gap-2.5 px-4"
      )}
        style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(64px + env(safe-area-inset-top))' }}
      >
        <div className="operations-sidebar__mark shrink-0 overflow-hidden">
          <Logo width={42} height={36} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="operations-sidebar__name">TW Ventures</p>
          <span className="operations-sidebar__rule" />
          <p className="operations-sidebar__section">Asset Operations</p>
        </div>
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

    </aside>
  );
};

export default AppSidebar;
