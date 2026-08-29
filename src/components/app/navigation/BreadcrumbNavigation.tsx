import React from 'react';
import { ChevronRight } from 'lucide-react';
import { modules } from '../constants';
import { cn } from '@/lib/utils';

interface BreadcrumbNavigationProps {
  activeModule: string;
  onModuleChange: (module: string) => void;
  onBack?: () => void;
  showBackButton?: boolean;
  className?: string;
}

export const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({
  activeModule,
  onModuleChange,
  onBack,
  showBackButton = false,
  className
}) => {
  const currentModule = modules.find(m => m.id === activeModule);
  
  // Get nav group for breadcrumb
  const getNavGroupName = (moduleId: string) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module?.navGroup) return null;
    
    const groupNames: Record<string, string> = {
      'dashboard': 'Dashboard',
      'financial': 'Financial Tools',
      'account': 'Account',
    };
    return groupNames[module.navGroup] || module.navGroup;
  };

  const navGroup = getNavGroupName(activeModule);
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      onModuleChange('dashboard');
    }
  };

  // Only show breadcrumb if not on dashboard and we have a nav group
  if (activeModule === 'dashboard' || !navGroup || !currentModule) {
    return null;
  }

  return (
    <nav className={cn("flex items-center gap-2", className)} aria-label="Breadcrumb">
      {showBackButton && (
        <button
          onClick={handleBack}
          className="text-[11px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      )}
      
      <div className="flex items-center gap-2 text-[11px] tracking-widest uppercase text-muted-foreground">
        {showBackButton && <span>/</span>}
        <button
          onClick={() => onModuleChange('dashboard')}
          className="hover:text-foreground transition-colors"
        >
          {navGroup}
        </button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{currentModule.name}</span>
      </div>
    </nav>
  );
};
