import { quickActions, type QuickAction } from './quickActionsConfig';
import { useState, useEffect, memo } from "react";
import { Plus, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { User } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import { getModuleAccessStatus, getModuleRule, getAccessRequirementLabel } from '@/config/moduleAccess';
import { useAuth } from '@/components/app/AuthProvider';
import type { ModuleAccessStatus } from '@/config/moduleAccess';
import { toast } from '@/hooks/use-toast';

interface FloatingActionMenuProps {
  onModuleSelect: (module: string) => void;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
  onRequestAuth?: () => void;
  onRequestUpgrade?: (moduleId: string) => void;
}

interface QuickActionButtonProps {
  action: QuickAction;
  onClick: (module: string) => void;
  locked?: boolean;
  loading?: boolean;
  title?: string;
}

const MemoQuickActionButton = memo(({ action, onClick, locked, loading, title }: QuickActionButtonProps) => (
  <Button
    key={action.module}
    onClick={() => onClick(action.module)}
    className={`w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-110 active:scale-95 bg-gradient-to-r ${action.color} border-0 animate-bounce-subtle touch-manipulation ${locked ? 'opacity-60' : ''}`}
    style={{ animationDelay: `${action.id.length * 10}ms` }}
    title={title || action.title}
    aria-label={action.title}
    aria-disabled={locked}
    disabled={loading}
  >
    {loading ? (
      <Loader2 className="h-6 w-6 text-white animate-spin" />
    ) : locked ? (
      <Lock className="h-6 w-6 text-white" />
    ) : (
      <action.icon className="h-6 w-6 text-white" />
    )}
  </Button>
));
MemoQuickActionButton.displayName = 'MemoQuickActionButton';

const FloatingActionMenu = ({
  onModuleSelect,
  user,
  authLoading,
  onRequestAuth,
  onRequestUpgrade,
}: FloatingActionMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const floatingActions = quickActions.filter(a => a.floating);

  const { access, accessLoading, userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const getStatusMeta = (moduleId: string) => {
    const status = getModuleAccessStatus(moduleId, {
      user,
      authLoading,
      accessLoading,
      personas: access.personas,
      isSuperAdmin,
    });

    return {
      status,
      isLocked: status === 'unauthenticated' || status === 'forbidden',
      isLoading: status === 'loading',
      lockLabel:
        status === 'unauthenticated'
          ? 'Sign in required'
          : status === 'forbidden'
            ? 'Upgrade required'
            : undefined,
    };
  };

  const handleAccess = (moduleId: string, status: ModuleAccessStatus) => {
    if (status === 'unauthenticated') {
      const rule = getModuleRule(moduleId);
      toast({
        title: 'Sign in required',
        description: rule?.description || 'Please sign in to access this experience.',
      });
      onRequestAuth?.();
      return;
    }

    if (status === 'forbidden') {
      const rule = getModuleRule(moduleId);
      const tierLabel = getAccessRequirementLabel(rule);
      const moduleName = quickActions.find(action => action.module === moduleId)?.title || 'this module';
      toast({
        title: 'Upgrade required',
        description: tierLabel
          ? `Upgrade to ${tierLabel} to unlock ${moduleName}.`
          : (rule?.description || 'Upgrade your plan to unlock this module.'),
      });
      onRequestUpgrade?.(moduleId);
    }
  };

  const handleActionClick = (module: string) => {
    const meta = getStatusMeta(module);
    if (meta.status === 'ok') {
      onModuleSelect(module);
      setIsOpen(false);
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
      return;
    }

    if (meta.status === 'loading') {
      return;
    }

    handleAccess(module, meta.status);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (isOpen && !target.closest('.floating-action-menu')) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div
      className="fixed right-4 z-50 floating-action-menu lg:right-8 lg:bottom-8"
      style={{
        bottom: isMobile
          ? 'calc(4rem + env(safe-area-inset-bottom) + 1rem)'
          : undefined,
      }}
    >
      {/* Quick Action Buttons */}
      <div className={`flex flex-col-reverse space-y-reverse space-y-3 mb-4 transition-all duration-300 ${
        isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}>
        {floatingActions.map((action) => {
          const meta = getStatusMeta(action.module);
          return (
            <MemoQuickActionButton
              key={action.id}
              action={action}
              onClick={handleActionClick}
              locked={meta.isLocked}
              loading={meta.isLoading}
              title={meta.lockLabel || action.title}
            />
          );
        })}
      </div>
      {/* Main FAB */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-full shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation ${
          isOpen ? "rotate-45" : "rotate-0"
        }`}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
      >
        <Plus className="h-8 w-8 text-white transition-transform duration-300" />
      </Button>
    </div>
  );
};

export default FloatingActionMenu;