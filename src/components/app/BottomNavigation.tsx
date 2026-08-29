import React, { useCallback, useMemo } from 'react';
import {
  LayoutDashboard, TrendingUp, Activity, Calendar, DollarSign,
  Eye, Building2, Database, RefreshCw, User, Crown, GraduationCap,
  Lock, Loader2, PieChart, BarChart3, Users, Map, Brain,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { modules } from './constants';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import { getModuleAccessStatus, getModuleRule, getAccessRequirementLabel } from '@/config/moduleAccess';
import { useAuth } from '@/components/app/AuthProvider';
import type { ModuleAccessStatus } from '@/config/moduleAccess';
import { toast } from '@/hooks/use-toast';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/lib/utils';

type NavModule = (typeof modules)[number];

// Primary tabs: home → underwriting → account.
//
// The inherited tabs (journey, insights, coach, community) went with the
// non-real-estate cut. Tabs are filtered against the registry below, so a stale
// id degrades silently to a missing tab rather than a broken one — which is why
// this list has to be kept in step with `modules` by hand.
const PRIMARY_TABS = [
  'dashboard',
  'portfolio',
  'real-estate',
  'account',
] as const;

// Computed once at module load — PRIMARY_TABS is a compile-time constant.
const NAV_MODULES = PRIMARY_TABS
  .map(id => modules.find(m => m.id === id))
  .filter(Boolean) as (typeof modules)[number][];

// Named icon map — avoids `import * as LucideIcons` which busts tree-shaking
const NAV_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  LayoutDashboard, TrendingUp, Activity, Calendar, DollarSign,
  Eye, Building2, Database, RefreshCw, User, Crown, GraduationCap, PieChart, BarChart3, Users, Map,
  Brain,
};

// Short labels — max ~7 chars for a 75px tab slot
const NAV_SHORT_LABELS: Record<string, string> = {
  'dashboard':       'Home',
  'portfolio':       'Portfolio',
  'real-estate':     'Deals',
  'account':         'Account',
};

interface BottomNavigationProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  user: SupabaseUser | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
  onRequestAuth?: () => void;
  onRequestUpgrade?: (moduleId: string) => void;
}

type StatusMeta = {
  status: ModuleAccessStatus;
  isLocked: boolean;
  isLoading: boolean;
  lockLabel?: string;
};

const BottomNavigation = ({
  activeModule,
  onModuleChange,
  user,
  authLoading,
  subscription,
  onRequestAuth,
  onRequestUpgrade,
}: BottomNavigationProps) => {
  const { access, accessLoading, userProfile } = useAuth();
  const haptics = useHaptics();
  const isSuperAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const navModules = NAV_MODULES;

  // Batch access context — single memo so moduleStatusMap only recomputes when auth/subscription changes
  const accessContext = useMemo(() => ({
    user, authLoading, accessLoading, personas: access.personas, isSuperAdmin,
  }), [user, authLoading, accessLoading, access.personas, isSuperAdmin]);

  // Derive all statuses once per render, not per-button
  const moduleStatusMap = useMemo(() =>
    navModules.reduce<Record<string, StatusMeta>>((acc, module) => {
      const status = getModuleAccessStatus(module.id, accessContext);
      acc[module.id] = {
        status,
        isLocked: status === 'unauthenticated' || status === 'forbidden',
        isLoading: status === 'loading',
        lockLabel:
          status === 'unauthenticated' ? 'Sign in required'
          : status === 'forbidden'       ? 'Upgrade required'
          : undefined,
      };
      return acc;
    }, {}),
  [navModules, accessContext]);

  const handleAccess = useCallback((moduleId: string, status: ModuleAccessStatus) => {
    const rule       = getModuleRule(moduleId);
    const moduleName = modules.find(m => m.id === moduleId)?.name ?? 'this module';

    if (status === 'unauthenticated') {
      toast({ title: 'Sign in required', description: rule?.description ?? 'Please sign in to access this experience.' });
      onRequestAuth?.();
      return;
    }
    if (status === 'forbidden') {
      const tierLabel = getAccessRequirementLabel(rule);
      toast({
        title: 'Upgrade required',
        description: tierLabel
          ? `Upgrade to ${tierLabel} to unlock ${moduleName}.`
          : (rule?.description ?? 'Upgrade your plan to unlock this module.'),
      });
      onRequestUpgrade?.(moduleId);
    }
  }, [onRequestAuth, onRequestUpgrade]);

  const handleModuleSelect = useCallback((moduleId: string) => {
    const meta = moduleStatusMap[moduleId];
    if (!meta || meta.isLoading) return;

    if (meta.status === 'ok') {
      haptics.tap();
      onModuleChange(moduleId);
      // 'instant' — no scroll animation between tabs; user expects to land at top immediately
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }

    haptics.tick(); // subtle feedback even for locked/upgrade taps
    handleAccess(moduleId, meta.status);
  }, [moduleStatusMap, haptics, onModuleChange, handleAccess]);

  return (
    <nav
      aria-label="Primary mobile navigation"
      className="fixed inset-x-0 z-30 border-t border-border/40 bg-background/85 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70 lg:hidden transition-[bottom,opacity] duration-300 ease-out"
      id="bottom-nav"
      style={{
        bottom: 'var(--keyboard-height, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: "0 -1px 0 hsl(var(--border) / 0.5), 0 -4px 24px hsl(var(--primary) / 0.05)"
      }}
    >
      <div
        className="grid h-16"
        style={{ gridTemplateColumns: `repeat(${navModules.length}, minmax(0, 1fr))` }}
      >
        {navModules.map((module) => {
          const Icon     = NAV_ICONS[module.icon as keyof typeof NAV_ICONS];
          const meta     = moduleStatusMap[module.id];
          const isActive = activeModule === module.id;
          const label    = NAV_SHORT_LABELS[module.id] ?? module.name;
          const isLocked = meta?.isLocked;
          const isLoading = meta?.isLoading;

          return (
            <button
              key={module.id}
              type="button"
              onClick={() => handleModuleSelect(module.id)}
              disabled={isLoading}
              aria-label={isLocked && meta?.lockLabel ? `${module.name}. ${meta.lockLabel}.` : module.name}
              aria-current={isActive ? 'page' : undefined}
              title={meta?.lockLabel ?? module.name}
              className={cn(
                'group relative flex min-w-0 flex-col items-center justify-center gap-1 px-1',
                'touch-manipulation select-none transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-0',
                isActive  && 'text-primary',
                !isActive && !isLocked && 'text-muted-foreground hover:text-foreground',
                isLocked  && 'text-muted-foreground/45',
                isLoading && 'cursor-wait opacity-60',
              )}
            >
              {/* Active top bar */}
              {isActive && (
                <span className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
              )}

              {/* Icon pill — active gets a tinted bg, taps get a pressed feel */}
              <span className={cn(
                'relative flex h-8 w-10 items-center justify-center rounded-xl transition-all duration-150',
                isActive  && 'bg-primary/10',
                !isActive && 'group-active:bg-muted',
              )}>
                {Icon
                  ? <Icon
                      className={cn(
                        'h-5 w-5 shrink-0 transition-transform duration-150',
                        isActive  && 'scale-110',
                        !isActive && 'group-active:scale-95',
                      )}
                      aria-hidden="true"
                    />
                  : <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden="true" />
                }

                {/* Lock / loading badge */}
                {(isLocked || isLoading) && (
                  <span className="absolute -right-0.5 -top-0.5 rounded-full border border-border bg-background p-0.5">
                    {isLoading
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin text-muted-foreground" aria-hidden="true" />
                      : <Lock    className="h-2.5 w-2.5 text-muted-foreground"               aria-hidden="true" />
                    }
                  </span>
                )}
              </span>

              {/* Label — whitespace-nowrap since short labels are guaranteed to fit */}
              <span className={cn(
                'whitespace-nowrap text-center text-[10px] leading-none',
                isActive ? 'font-semibold' : 'font-medium',
              )}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
