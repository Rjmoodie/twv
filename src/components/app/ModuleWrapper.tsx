import React, { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/app/ErrorBoundary';

interface ModuleWrapperProps {
  children: React.ReactNode;
  /**
   * Id of the module being rendered. Used as the boundary's reset key — see the
   * note below. Omitting it means a crash here survives until a full reload.
   */
  moduleId?: string;
  fallback?: React.ReactNode;
}

/**
 * Wraps every lazy-loaded module with:
 * 1. Suspense — shows a skeleton while the JS chunk downloads
 * 2. ErrorBoundary — isolates chunk load failures so one broken module
 *    can't crash the entire application
 *
 * The `key` on the boundary is what makes that isolation hold *across*
 * navigations. Every module renders through this same component at the same
 * position in the tree, so without a key React reconciles them as one instance
 * and the caught-error state carries over: crash Real Estate once and every
 * module you open afterwards renders "Failed to load module" until the tab is
 * reloaded. Keying by module id remounts the boundary on each switch, so the
 * failure stays with the module that caused it.
 *
 * React.lazy caches a rejected import promise, so remounting this boundary does
 * not actually retry a chunk that failed after a deployment. A full reload is
 * required to fetch the current index and its content-hashed chunk graph.
 */
const ModuleWrapper: React.FC<ModuleWrapperProps> = ({
  children,
  moduleId,
  fallback = <ModuleSkeleton />,
}) => {
  return (
    <ErrorBoundary key={moduleId}>
      <Suspense fallback={fallback}>
        <div className="animate-fade-in h-full flex flex-col">
          {children}
        </div>
      </Suspense>
    </ErrorBoundary>
  );
};

const ModuleSkeleton = () => (
  <div className="space-y-4 p-4">
    {/* Page header */}
    <div className="space-y-2">
      <Skeleton className="h-7 w-48 rounded-xl" />
      <Skeleton className="h-4 w-72 rounded-lg" />
    </div>
    {/* Summary cards */}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
    {/* Main content */}
    <Skeleton className="h-64 w-full rounded-2xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  </div>
);

export default ModuleWrapper;
