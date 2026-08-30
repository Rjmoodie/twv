import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/components/app/AuthProvider';
import type { PortalIntent } from '@/lib/portalRouting';
import { canEnterPortal, getPreferredPortalPath } from '@/lib/portalRouting';

interface PortalRouteGuardProps {
  intent: PortalIntent;
  children: ReactNode;
}

export default function PortalRouteGuard({ intent, children }: PortalRouteGuardProps) {
  const { user, loading, accessLoading, access } = useAuth();

  // Signed-out visitors stay on the requested portal so its contextual auth
  // prompt can explain which invitation they need.
  if (!user || loading) return children;

  // Membership is a second authenticated request. Never decide from the empty
  // initial persona list or a legitimate PM could be redirected as a client.
  if (accessLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" aria-label="Checking portal access" /></div>;
  }

  if (!canEnterPortal(intent, access.personas)) {
    return <Navigate to={getPreferredPortalPath(access.personas)} replace />;
  }

  return children;
}

