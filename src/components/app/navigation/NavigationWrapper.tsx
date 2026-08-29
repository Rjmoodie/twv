import React from 'react';
import { PageHeader } from './PageHeader';
import { useNavigation } from '@/contexts/NavigationContext';
import { modules } from '../constants';

interface NavigationWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showBreadcrumbs?: boolean;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Accepted for call-site compatibility and ignored. Back, menu and profile
   * live in the app header (AppHeader), not in the per-module page header,
   * so PageHeader has never rendered them.
   */
  showBackButton?: boolean;
  showMenuButton?: boolean;
  showUserButton?: boolean;
  onMenuClick?: () => void;
  onUserClick?: () => void;
}

export const NavigationWrapper: React.FC<NavigationWrapperProps> = ({
  children,
  title,
  subtitle,
  showBreadcrumbs = true,
  actions,
  className
}) => {
  const { activeModule } = useNavigation();

  // Resolve the module's own metadata only when the caller stays silent — an
  // explicit "" means "this screen renders its own heading", which `||` ate.
  const currentModule = modules.find(m => m.id === activeModule);
  const moduleTitle = title ?? currentModule?.name;
  const moduleSubtitle = subtitle ?? currentModule?.description;

  return (
    <div className={className}>
      {/* PageHeader spells this prop in the singular. Passing the plural meant
          every caller's `showBreadcrumbs={false}` was dropped on the floor and
          breadcrumbs rendered on screens that had asked to hide them. */}
      <PageHeader
        title={moduleTitle}
        subtitle={moduleSubtitle}
        showBreadcrumb={showBreadcrumbs}
        actions={actions}
      />
      <div className="animate-fade-in">
        {children}
      </div>
    </div>
  );
};
