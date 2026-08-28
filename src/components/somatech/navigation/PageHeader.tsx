import React from 'react';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { useNavigation } from '@/contexts/NavigationContext';
import { modules } from '../constants';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
  showBreadcrumb?: boolean;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
  showBreadcrumb = true,
}: PageHeaderProps) {
  const { activeModule, navigateToModule } = useNavigation();

  // Fall back to the module's own metadata only when a caller says nothing.
  // `||` conflated that with an explicit empty string, so a screen that owns its
  // heading — the dashboard passes title="" because WelcomeSection greets the
  // user — got the module name stacked on top of it anyway.
  const currentModule = modules.find(m => m.id === activeModule);
  const moduleTitle = title ?? currentModule?.name ?? 'Dashboard';
  const moduleSubtitle = subtitle ?? currentModule?.description;

  if (!showBreadcrumb && !eyebrow && !moduleTitle && !moduleSubtitle && !actions) {
    return null;
  }

  return (
    <div className={cn("mb-4 sm:mb-6", className)}>
      {showBreadcrumb && (
        <div className="mb-3">
          <BreadcrumbNavigation
            activeModule={activeModule}
            onModuleChange={navigateToModule}
          />
        </div>
      )}

      {eyebrow && (
        <div className="label-wide text-primary mb-2">{eyebrow}</div>
      )}

      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {moduleTitle && (
            <h1 className="heading-tight text-2xl sm:text-3xl font-semibold text-foreground">
              {moduleTitle}
            </h1>
          )}
          {moduleSubtitle && (
            <p className="mt-1 text-sm sm:text-base text-muted-foreground">
              {moduleSubtitle}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
