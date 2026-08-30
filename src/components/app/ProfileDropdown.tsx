import React, { useState } from 'react';
import { Settings, LogOut, ChevronsUpDown, Sun, Moon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useAuth } from './AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ProfileDropdownProps {
  username: string;
  userEmail: string;
  avatarUrl?: string | null;
  onModuleChange?: (module: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function Avatar({ initials, avatarUrl, size = 'sm' }: { initials: string; avatarUrl?: string | null; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  if (avatarUrl) {
    return (
      <div className={cn('rounded-full shrink-0 overflow-hidden', dim)}>
        <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={cn(
      'rounded-full bg-primary flex items-center justify-center shrink-0 select-none',
      dim
    )}>
      <span className={cn(
        'font-semibold text-primary-foreground leading-none',
        size === 'sm' ? 'text-[11px]' : 'text-sm'
      )}>
        {initials}
      </span>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ProfileDropdown = ({ username, userEmail, avatarUrl, onModuleChange }: ProfileDropdownProps) => {
  const { signOut, access } = useAuth();
  const { toast } = useToast();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    // Dispatch custom event so useStatusBarTheme picks it up
    window.dispatchEvent(new Event('themechange'));
  };

  const initials = getInitials(username, userEmail);
  const roleLabel = access.personas.includes('admin')
    ? 'Organization administrator'
    : access.personas.includes('project_manager')
      ? 'Project manager'
      : access.personas.includes('investor') || access.personas.includes('client')
        ? 'Investor partner'
        : 'Secure project account';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      toast({ title: 'Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
    setShowSignOutDialog(false);
  };

  const goToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onModuleChange) {
      onModuleChange('account');
    } else {
      const url = new URL(window.location.href);
      url.searchParams.set('module', 'account');
      window.location.href = url.toString();
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* ── Trigger ─────────────────────────────────────────────────────── */}
          <button className={cn(
            'group flex items-center gap-2 rounded-xl border border-border/50 bg-background',
            'px-2.5 py-1.5 transition-all duration-150',
            'hover:border-border hover:bg-muted/40',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}>
            <div className="relative">
              <Avatar initials={initials} avatarUrl={avatarUrl} size="sm" />
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent border-2 border-background" />
            </div>

            <div className="hidden sm:flex flex-col items-start min-w-0">
              <span className="text-[13px] font-medium text-foreground leading-none truncate max-w-[100px]">
                {username || userEmail.split('@')[0]}
              </span>
              <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Operations</span>
            </div>

            <ChevronsUpDown className="hidden sm:block h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          </button>
        </DropdownMenuTrigger>

        {/* ── Dropdown ──────────────────────────────────────────────────────── */}
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="operations-profile-menu w-72 p-0 overflow-hidden shadow-lg border border-border/60"
        >
          {/* Identity header */}
          <div className="flex items-center gap-3 px-4 py-3.5 bg-muted/30 border-b border-border/40">
            <div className="relative shrink-0">
              <Avatar initials={initials} avatarUrl={avatarUrl} size="md" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent border-2 border-background" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground truncate leading-snug">
                {username || userEmail.split('@')[0]}
              </p>
              <p className="text-[11px] text-muted-foreground truncate leading-snug mt-0.5">
                {userEmail}
              </p>
              <div className="mt-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary bg-primary/10 px-2 py-1 leading-none">
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Menu items */}
          <div className="p-1">
            <DropdownMenuItem
              onClick={goToSettings}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm text-foreground/80"
            >
              <Settings className="h-4 w-4 text-muted-foreground shrink-0" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={toggleTheme}
              className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm text-foreground/80"
            >
              <div className="flex items-center gap-2.5">
                {darkMode
                  ? <Sun className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <Moon className="h-4 w-4 text-muted-foreground shrink-0" />}
                {darkMode ? 'Light mode' : 'Dark mode'}
              </div>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator className="my-0" />

          <div className="p-1">
            <DropdownMenuItem
              onClick={() => setShowSignOutDialog(true)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm text-destructive focus:text-destructive focus:bg-destructive/8"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Sign out confirmation ────────────────────────────────────────────── */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
