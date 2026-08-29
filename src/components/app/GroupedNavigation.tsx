import React, { useMemo, useState } from 'react';
import {
  ChevronDown, ChevronRight, Lock, Loader2,
  LayoutDashboard, TrendingUp, Activity, Calendar, DollarSign,
  Eye, Building2, Database, RefreshCw, Home,
  User as LucideUser, Crown, GraduationCap, PieChart, Brain,
  BarChart3, Map, Users, Sparkles, HelpCircle,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { modules } from './constants';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

const NAV_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  LayoutDashboard, TrendingUp, Activity, Calendar, DollarSign,
  Eye, Building2, Database, RefreshCw, Crown, GraduationCap, PieChart, Brain, Home,
  BarChart3, Map, Users, Sparkles, HelpCircle,
  User: LucideUser,
};
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import { getModuleAccessStatus, getModuleRule, getAccessRequirementLabel } from '@/config/moduleAccess';
import { useAuth } from '@/components/app/AuthProvider';
import type { ModuleAccessStatus } from '@/config/moduleAccess';
import { toast } from '@/hooks/use-toast';

interface GroupedNavigationProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  variant?: 'desktop' | 'mobile' | 'dropdown';
  className?: string;
  user: User | null;
  authLoading: boolean;
  subscription: UseSubscriptionReturn;
  onRequestAuth?: () => void;
  onRequestUpgrade?: (moduleId: string) => void;
}

// Define the order and labels for nav groups.
// 'overview' renders as a flat non-collapsible section at the top.
const navGroupOrder: { key: string; name: string; flat?: boolean }[] = [
  { key: 'overview',    name: '',            flat: true },
  { key: 'investor',    name: 'Investor'   },
  { key: 'real-estate', name: 'Real Estate'},
  { key: 'planner',     name: 'Planner'    },
  { key: 'account',     name: 'Account'    },
];

// Group modules by navGroup
const groupModules = () => {
  const groups: Record<string, typeof modules> = {};
  for (const m of modules) {
    if (!m.navGroup) continue;
    if (!groups[m.navGroup]) groups[m.navGroup] = [];
    groups[m.navGroup].push(m);
  }
  return groups;
};

const GroupedNavigation = ({
  activeModule,
  onModuleChange,
  variant = 'desktop',
  className,
  user,
  authLoading,
  subscription,
  onRequestAuth,
  onRequestUpgrade,
}: GroupedNavigationProps) => {
  // Determine which group the active module belongs to so it starts expanded
  const activeGroup = useMemo(() => {
    const mod = modules.find(m => m.id === activeModule);
    return mod?.navGroup ?? null;
  }, [activeModule]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => ({
    investor:      activeGroup === 'investor'     || activeGroup === null,
    'real-estate': activeGroup === 'real-estate',
    planner:       activeGroup === 'planner',
    account:       activeGroup === 'account',
  }));

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const groups = useMemo(groupModules, []);

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
      const moduleName = modules.find((m) => m.id === moduleId)?.name || 'this module';
      toast({
        title: 'Upgrade required',
        description: tierLabel
          ? `Upgrade to ${tierLabel} to unlock ${moduleName}.`
          : (rule?.description || 'Upgrade your plan to unlock this module.'),
      });
      onRequestUpgrade?.(moduleId);
    }
  };

  const handleModuleSelect = (moduleId: string) => {
    const meta = getStatusMeta(moduleId);
    if (meta.status === 'ok') {
      onModuleChange(moduleId);
      return;
    }

    if (meta.status === 'loading') {
      return;
    }

    handleAccess(moduleId, meta.status);
  };

  const DynamicIcon = ({ iconName, className }: { iconName: string; className?: string }) => {
    const IconComponent = NAV_ICONS[iconName];
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  // Shared: render a single nav item button
  const renderNavItem = (module: typeof modules[number]) => {
    const isActive = activeModule === module.id;
    const { isLocked, isLoading, lockLabel } = getStatusMeta(module.id);
    return (
      <button
        key={module.id}
        onClick={() => handleModuleSelect(module.id)}
        data-active={isActive}
        className="nav-item-premium"
        title={lockLabel}
        aria-disabled={isLocked}
      >
        <DynamicIcon iconName={module.icon} className="nav-icon-premium" />
        <span className="nav-label-premium">{module.name}</span>
        {(isLocked || isLoading) && (
          <span className="ml-auto flex items-center text-muted-foreground">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          </span>
        )}
      </button>
    );
  };

  // Desktop Sidebar Navigation
  if (variant === 'desktop') {
    return (
      <nav className={cn('space-y-2', className)}>
        {navGroupOrder.map(({ key, name, flat }) => {
          const group = groups[key];
          if (!group || group.length === 0) return null;

          // Flat group (overview) — no collapsible, no section label, with a bottom divider
          if (flat) {
            return (
              <div key={key}>
                <div className="space-y-0.5">
                  {group.map(renderNavItem)}
                </div>
                <div className="my-2 h-px bg-border/40" />
              </div>
            );
          }

          return (
            <Collapsible
              key={key}
              open={openGroups[key]}
              onOpenChange={() => toggleGroup(key)}
            >
              <CollapsibleTrigger asChild>
                <button
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors duration-150 font-medium text-sm',
                    openGroups[key]
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                  )}
                >
                  <span className="nav-section-label !px-0 !py-0">{name}</span>
                  {openGroups[key] ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-0.5 space-y-0.5">
                {group.map(renderNavItem)}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>
    );
  }

  // Dropdown Navigation
  if (variant === 'dropdown') {
    return (
      <div className="flex items-center space-x-2">
        {navGroupOrder.map(({ key, name }) => {
          const group = groups[key];
          if (!group || group.length === 0) return null;
          return (
            <DropdownMenu key={key}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={group.some(m => m.id === activeModule) ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1"
                >
                  {name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {group.map(module => {
                  const meta = getStatusMeta(module.id);
                  return (
                    <DropdownMenuItem
                      key={module.id}
                      onSelect={(event) => {
                        const latestMeta = getStatusMeta(module.id);
                        if (latestMeta.status === 'ok') {
                          onModuleChange(module.id);
                          return;
                        }
                        event.preventDefault();
                        if (latestMeta.status !== 'loading') {
                          handleAccess(module.id, latestMeta.status);
                        }
                      }}
                      className={cn(
                        'cursor-pointer gap-2',
                        meta.isLocked && 'opacity-60'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <DynamicIcon iconName={module.icon} className="h-4 w-4" />
                        {module.name}
                      </span>
                      {(meta.isLocked || meta.isLoading) && (
                        <span className="ml-auto flex items-center text-muted-foreground">
                          {meta.isLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Lock className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}
      </div>
    );
  }

  // Mobile Navigation (same as desktop but more compact)
  return (
    <nav className={cn('space-y-1', className)}>
      {navGroupOrder.map(({ key, name, flat }) => {
        const group = groups[key];
        if (!group || group.length === 0) return null;

        if (flat) {
          return (
            <div key={key}>
              <div className="space-y-0.5">
                {group.map(renderNavItem)}
              </div>
              <div className="my-2 h-px bg-border/40" />
            </div>
          );
        }

        return (
          <Collapsible
            key={key}
            open={openGroups[key]}
            onOpenChange={() => toggleGroup(key)}
          >
            <CollapsibleTrigger asChild>
              <button
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-colors duration-150 text-sm font-medium',
                  openGroups[key]
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                )}
              >
                <span className="nav-section-label !px-0 !py-0">{name}</span>
                {openGroups[key] ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-0.5 space-y-0.5">
              {group.map(renderNavItem)}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
};

export default GroupedNavigation;