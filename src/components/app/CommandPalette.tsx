import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { modules } from './constants';
import {
  LayoutDashboard, TrendingUp, Activity, Calendar, DollarSign,
  Eye, Building2, Database, RefreshCw, User, Crown, GraduationCap,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useNavigation } from '@/contexts/NavigationContext';
import { cn } from '@/lib/utils';

const NAV_ICONS: Record<string, React.ComponentType<LucideProps>> = {
  LayoutDashboard, TrendingUp, Activity, Calendar, DollarSign,
  Eye, Building2, Database, RefreshCw, User, Crown, GraduationCap,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const { navigateToModule, activeModule } = useNavigation();
  const [search, setSearch] = useState('');

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === 'k' && e.metaKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const filteredModules = modules.filter((module) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      module.name.toLowerCase().includes(searchLower) ||
      module.description.toLowerCase().includes(searchLower) ||
      module.id.toLowerCase().includes(searchLower)
    );
  });

  const handleSelect = (moduleId: string) => {
    navigateToModule(moduleId);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput 
        placeholder="Search modules, actions..." 
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No modules found.</CommandEmpty>
        
        <CommandGroup heading="Modules">
          {filteredModules.map((module) => {
            const IconComponent = NAV_ICONS[module.icon];
            const isActive = module.id === activeModule;
            
            return (
              <CommandItem
                key={module.id}
                onSelect={() => handleSelect(module.id)}
                className={cn(
                  "flex items-center gap-3",
                  isActive && "bg-primary/5"
                )}
              >
                {IconComponent && <IconComponent className="h-4 w-4 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{module.name}</span>
                    {isActive && (
                      <span className="text-xs text-muted-foreground">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {module.description}
                  </p>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

