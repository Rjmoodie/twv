import React, { useState } from 'react';
import { Search, ChevronLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/somatech/NotificationBell';
import { ProfileDropdown } from '@/components/somatech/ProfileDropdown';
import { useAuth } from '@/components/somatech/AuthProvider';
import { CommandPalette } from '@/components/somatech/CommandPalette';
import { useNavigate } from 'react-router-dom';
import SomaTechLogo from '@/components/somatech/SomaTechLogo';

interface SomaTechHeaderProps {
  activeModule: string;
  user: any;
  profile: any;
  authLoading: boolean;
  onModuleChange: (module: string) => void;
  onMenuOpen?: () => void;
  onGetStarted?: () => void;
  onSignIn?: () => void;
  onGoBack?: () => void;
  canGoBack?: boolean;
}

const SomaTechHeader: React.FC<SomaTechHeaderProps> = ({
  activeModule,
  user,
  profile,
  authLoading,
  onModuleChange,
  onMenuOpen,
  onGetStarted,
  onSignIn,
  onGoBack,
  canGoBack,
}) => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {/* Safe-area fill — covers the iOS status-bar region with the correct theme colour */}
      <div
        className="fixed inset-x-0 top-0 z-50 bg-background"
        style={{ height: 'env(safe-area-inset-top)' }}
        aria-hidden="true"
      />
      <header
        className="z-40 border-b border-border/40 bg-background backdrop-blur-2xl"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          boxShadow: '0 1px 0 hsl(var(--border) / 0.4)',
        }}
      >
        {/* ── Mobile layout ────────────────────────────────────────────── */}
        <div className="flex xl:hidden h-14 items-center gap-2 px-3">

          {/* Left: back or menu */}
          {canGoBack ? (
            <button
              onClick={onGoBack}
              aria-label="Go back"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/70 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={onMenuOpen}
              aria-label="Open menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/70 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          {/* Centre: search pill */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search"
            className="flex flex-1 items-center gap-2 h-9 rounded-xl bg-muted/50 border border-border/40 px-3 text-sm text-muted-foreground hover:bg-muted/80 hover:border-border/60 transition-all duration-150"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[13px]">Search</span>
          </button>

          {/* Right: actions */}
          <div className="flex items-center shrink-0">
            {authLoading ? (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <>
                <NotificationBell />
                <ProfileDropdown
                  username={profile?.username || user.email?.split('@')[0] || 'User'}
                  userEmail={user.email || ''}
                  avatarUrl={profile?.avatar_url ?? null}
                  onModuleChange={onModuleChange}
                />
              </>
            ) : (
              <Button size="sm" onClick={onSignIn ?? (() => navigate('/pricing'))}>
                Sign In
              </Button>
            )}
          </div>
        </div>

        {/* ── Desktop layout ────────────────────────────────────────────── */}
        <div className="hidden xl:flex h-16 items-center justify-between gap-4 px-4">

          {/* Left: logo + brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            {canGoBack && (
              <Button variant="ghost" size="sm" onClick={onGoBack} className="gap-1 text-muted-foreground">
                <ChevronLeft className="h-4 w-4" />
                <span className="text-sm">Back</span>
              </Button>
            )}
            <div className="h-9 w-9 rounded-2xl overflow-hidden shadow-elev-1 ring-1 ring-primary/20 shrink-0">
              <SomaTechLogo width={36} height={36} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-foreground">SomaTech</div>
              <div className="text-muted-foreground" style={{ fontSize: '0.6rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Financial Intelligence</div>
            </div>
          </div>

          {/* Centre: search pill */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:border-primary/30 hover:text-foreground transition-all duration-150 min-w-[220px]"
            aria-label="Open search"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="inline-flex items-center rounded border border-border/60 bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
              ⌘K
            </kbd>
          </button>

          {/* Right: actions */}
          <div className="flex items-center gap-1 shrink-0">
            {authLoading ? (
              <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
            ) : user ? (
              <>
                <NotificationBell />
                <ProfileDropdown
                  username={profile?.username || user.email?.split('@')[0] || 'User'}
                  userEmail={user.email || ''}
                  avatarUrl={profile?.avatar_url ?? null}
                  onModuleChange={onModuleChange}
                />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onSignIn ?? (() => navigate('/pricing'))}>
                  Sign In
                </Button>
                <Button size="sm" onClick={onGetStarted ?? (() => navigate('/pricing'))}>
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  );
};

export default SomaTechHeader;
