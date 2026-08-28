import React, { createContext, useContext, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import type { UseSubscriptionReturn } from '@/hooks/useSubscription';
import { savePendingAction, type PendingAction } from '@/lib/pendingAction';

interface GuardActionOptions {
  requiresAuth?: boolean;
  requiredTier?: string;
  pendingAction?: PendingAction;
  onAllowed: () => void;
  authMessage?: string;
  upgradeModuleId?: string;
}

interface ActionGuardContextValue {
  guardAction: (options: GuardActionOptions) => void;
  requestAuth: (message?: string, pendingAction?: PendingAction) => void;
  requestUpgrade: (moduleId: string) => void;
}

const ActionGuardContext = createContext<ActionGuardContextValue | null>(null);

interface ActionGuardProviderProps {
  children: React.ReactNode;
  user: User | null;
  subscription: UseSubscriptionReturn;
  onRequestAuth: (message: string | null, pendingAction?: PendingAction) => void;
  onRequestUpgrade: (moduleId: string) => void;
}

export const ActionGuardProvider: React.FC<ActionGuardProviderProps> = ({
  children,
  user,
  subscription,
  onRequestAuth,
  onRequestUpgrade,
}) => {
  const requestAuth = useCallback((message?: string, action?: PendingAction) => {
    if (action) savePendingAction(action);
    onRequestAuth(message ?? null, action);
  }, [onRequestAuth]);

  const requestUpgrade = useCallback((moduleId: string) => {
    onRequestUpgrade(moduleId);
  }, [onRequestUpgrade]);

  const guardAction = useCallback((options: GuardActionOptions) => {
    const {
      requiresAuth = true,
      requiredTier,
      pendingAction,
      onAllowed,
      authMessage,
      upgradeModuleId,
    } = options;

    if (requiresAuth && !user) {
      requestAuth(authMessage, pendingAction);
      return;
    }

    if (requiredTier && !subscription.loading) {
      const tier = subscription.subscriptionTier ?? 'free';
      const tiers = ['free', 'basic', 'pro', 'enterprise'];
      const userTierIdx = tiers.indexOf(tier);
      const requiredTierIdx = tiers.indexOf(requiredTier);
      if (userTierIdx < requiredTierIdx) {
        requestUpgrade(upgradeModuleId ?? requiredTier);
        return;
      }
    }

    onAllowed();
  }, [user, subscription, requestAuth, requestUpgrade]);

  return (
    <ActionGuardContext.Provider value={{ guardAction, requestAuth, requestUpgrade }}>
      {children}
    </ActionGuardContext.Provider>
  );
};

export function useActionGuard(): ActionGuardContextValue {
  const ctx = useContext(ActionGuardContext);
  if (!ctx) throw new Error('useActionGuard must be used within ActionGuardProvider');
  return ctx;
}
