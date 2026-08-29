import React, { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, LogIn, ShieldCheck } from 'lucide-react';
import { getModuleAccessStatus, getModuleRule, getAccessRequirementLabel, personaLabels } from '@/config/moduleAccess';
import type { ModuleAccessStatus } from '@/config/moduleAccess';
import { useAuth } from '@/components/app/AuthProvider';
import { modules } from './constants';
import { Badge } from '@/components/ui/badge';
import { track } from '@/lib/analytics';

interface ModuleAccessGateProps {
  moduleId: string;
  user: User | null;
  authLoading: boolean;
  onRequestAuth: () => void;
  children: React.ReactNode;
}

const statusIcons: Record<ModuleAccessStatus, React.ReactNode> = {
  ok: null,
  loading: (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  ),
  unauthenticated: (
    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
      <LogIn className="h-7 w-7 text-primary" />
    </div>
  ),
  forbidden: (
    <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
      <Lock className="h-7 w-7 text-primary" />
    </div>
  ),
};

/**
 * This was a paywall. It offered plan comparisons and an upgrade button to
 * anyone who opened an internal module, because access was gated on subscription
 * tier inherited from somatech.
 *
 * TW Ventures gates on persona instead, so a denial is not something the reader
 * can resolve by paying — it is resolved by a workspace administrator granting
 * them a role. The screen now says which role is needed and who to ask.
 */
const ModuleAccessGate: React.FC<ModuleAccessGateProps> = ({
  moduleId,
  user,
  authLoading,
  onRequestAuth,
  children,
}) => {
  const { access, accessLoading, userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const accessStatus = getModuleAccessStatus(moduleId, {
    user,
    authLoading,
    accessLoading,
    personas: access.personas,
    isSuperAdmin,
  });

  const rule = getModuleRule(moduleId);
  const requirement = getAccessRequirementLabel(rule);

  // Where access actually bites. Fires once per gate impression, not per render,
  // so the count is of people blocked rather than of re-renders.
  useEffect(() => {
    if (accessStatus === 'unauthenticated' || accessStatus === 'forbidden') {
      track('gate_encountered', {
        module: moduleId,
        reason: accessStatus,
        required_personas: getModuleRule(moduleId)?.requiredPersonas?.join(',') ?? null,
      });
    }
  }, [accessStatus, moduleId]);

  if (accessStatus === 'ok') {
    return <>{children}</>;
  }

  if (accessStatus === 'loading') {
    return <>{statusIcons.loading}</>;
  }

  const moduleMeta = modules.find((module) => module.id === moduleId);
  const heldPersonas = access.personas.map((persona) => personaLabels[persona]);

  return (
    <Card className="border-dashed border-2 border-muted/60 bg-muted/30 backdrop-blur">
      <CardHeader className="text-center space-y-2">
        <div className="flex items-center justify-center">{statusIcons[accessStatus]}</div>
        <CardTitle className="text-xl font-semibold">
          {accessStatus === 'unauthenticated' ? 'Sign in to continue' : 'You do not have access to this area'}
        </CardTitle>
        <CardDescription className="text-base">
          {rule?.description || 'This area is restricted.'}
        </CardDescription>
        {moduleMeta && (
          <Badge variant="secondary" className="uppercase tracking-wide">
            {moduleMeta.name}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        {accessStatus === 'unauthenticated' ? (
          <Button onClick={() => onRequestAuth()} className="w-full sm:w-auto">
            <LogIn className="mr-2 h-4 w-4" />
            Sign in to continue
          </Button>
        ) : (
          <>
            {requirement && (
              <p className="text-sm text-muted-foreground">
                Requires <span className="font-medium text-foreground">{requirement}</span> access.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {heldPersonas.length
                ? <>You are signed in as <span className="font-medium text-foreground">{heldPersonas.join(' and ')}</span>.</>
                : 'Your account has no project or workspace role assigned yet.'}
            </p>
            {isSuperAdmin && (
              <p className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="h-3 w-3" /> Platform administrator
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Ask a workspace administrator to assign the role, or to invite you to the project.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ModuleAccessGate;
