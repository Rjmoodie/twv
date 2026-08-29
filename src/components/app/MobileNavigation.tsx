import { X } from 'lucide-react';
import Logo from './Logo';
import GroupedNavigation from './GroupedNavigation';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';

interface MobileNavigationProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  isOpen: boolean;
  onClose: () => void;
  user: SupabaseUser | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
  onRequestAuth?: () => void;
}

const MobileNavigation = ({
  activeModule,
  onModuleChange,
  isOpen,
  onClose,
  user,
  authLoading,
  subscription,
  onRequestAuth,
}: MobileNavigationProps) => {
  const handleModuleSelect = (moduleId: string) => {
    onModuleChange(moduleId);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 h-full w-[304px] bg-background/90 backdrop-blur-xl border-r border-border/60 shadow-elev-3 z-50 lg:hidden flex flex-col transition-transform duration-200 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 border-b border-border/60 shrink-0"
          style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(64px + env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-2xl overflow-hidden shadow-elev-1 ring-1 ring-border/40">
              <Logo width={36} height={36} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">TW Ventures</div>
              <div className="text-xs text-muted-foreground">Real Estate Operations</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Module list — mirrors desktop GroupedNavigation exactly */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          <GroupedNavigation
            activeModule={activeModule}
            onModuleChange={handleModuleSelect}
            variant="mobile"
            user={user}
            authLoading={authLoading}
            subscription={subscription}
            onRequestAuth={onRequestAuth}
          />
        </nav>

      </div>
    </>
  );
};

export default MobileNavigation;
