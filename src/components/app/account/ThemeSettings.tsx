import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTheme } from 'next-themes';
import { Monitor, Moon, Sun, Check, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ThemeValue = 'light' | 'dark' | 'system';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ThemeOption {
  value: ThemeValue;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  theme_preference: string;
  onboarding_completed: boolean;
  profile_completion_score: number;
}

interface ThemeSettingsProps {
  profile: Profile;
  onUpdate: (updates: Partial<Profile>) => Promise<void>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  {
    value: 'light'  as const,
    label: 'Light',
    description: 'Clean, bright interface for daytime use.',
    icon: Sun,
  },
  {
    value: 'dark'   as const,
    label: 'Dark',
    description: 'Reduced glare for low-light work sessions.',
    icon: Moon,
  },
  {
    value: 'system' as const,
    label: 'System',
    description: 'Automatically matches your device setting.',
    icon: Monitor,
  },
] satisfies ThemeOption[];

// ── Sub-components ────────────────────────────────────────────────────────────

function ThemeOptionCard({
  option,
  isSelected,
  isSaving,
  resolvedDisplay,
}: {
  option: ThemeOption;
  isSelected: boolean;
  isSaving: boolean;
  resolvedDisplay: string;
}) {
  const Icon = option.icon;

  return (
    <div className="relative">
      <RadioGroupItem
        value={option.value}
        id={`theme-${option.value}`}
        className="sr-only"
      />
      <Label
        htmlFor={`theme-${option.value}`}
        className={cn(
          'relative flex flex-col gap-3 rounded-2xl border p-4 cursor-pointer select-none',
          'transition-all duration-200',
          'hover:bg-muted/40',
          'focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2',
          isSelected
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-border bg-card'
        )}
      >
        {/* Selected indicator — top-right corner */}
        <div className="absolute top-3 right-3 h-5 w-5">
          {isSelected && (
            isSaving ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
              </div>
            )
          )}
        </div>

        {/* Icon container */}
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0',
          isSelected ? 'bg-primary/10' : 'bg-muted/50'
        )}>
          <Icon className={cn('h-4 w-4', isSelected ? 'text-primary' : 'text-muted-foreground')} />
        </div>

        {/* Text */}
        <div className="space-y-0.5 pr-4">
          <p className={cn(
            'text-sm font-semibold leading-none',
            isSelected ? 'text-foreground' : 'text-foreground/80'
          )}>
            {option.label}
          </p>
          <p className="text-xs text-muted-foreground leading-snug mt-1">
            {option.description}
          </p>
          {option.value === 'system' && isSelected && (
            <p className="text-[11px] text-primary/70 mt-1.5 font-medium">
              Currently using {resolvedDisplay} mode
            </p>
          )}
        </div>
      </Label>
    </div>
  );
}

function ThemePreview() {
  return (
    <div
      className="rounded-2xl border bg-background overflow-hidden select-none pointer-events-none"
      aria-hidden="true"
    >
      {/* Top nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="h-2 w-16 rounded-full bg-muted-foreground/20" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-10 rounded-full bg-muted-foreground/15" />
          <div className="h-2 w-10 rounded-full bg-muted-foreground/15" />
          <div className="w-6 h-6 rounded-full bg-muted border" />
        </div>
      </div>

      <div className="flex" style={{ minHeight: 172 }}>
        {/* Side nav */}
        <div className="w-11 border-r bg-muted/20 flex flex-col items-center gap-3 py-4 shrink-0">
          {[true, false, false, false, false].map((active, i) => (
            <div
              key={i}
              className={cn(
                'w-5 h-5 rounded-lg transition-colors',
                active ? 'bg-primary/40' : 'bg-muted-foreground/15'
              )}
            />
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-3 space-y-2.5 min-w-0">
          {/* Page title */}
          <div className="h-2.5 w-28 rounded-full bg-foreground/15" />

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-card p-2.5 space-y-1.5">
              <div className="h-1.5 w-14 rounded-full bg-muted-foreground/25" />
              <div className="h-3 w-20 rounded-full bg-foreground/20" />
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-accent/60" />
                <div className="h-1.5 w-8 rounded-full bg-accent/40" />
              </div>
            </div>
            <div className="rounded-xl border bg-card p-2.5 space-y-1.5">
              <div className="h-1.5 w-14 rounded-full bg-muted-foreground/25" />
              <div className="h-3 w-16 rounded-full bg-foreground/20" />
              <div className="flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
                <div className="h-1.5 w-10 rounded-full bg-blue-500/30" />
              </div>
            </div>
          </div>

          {/* Chart block */}
          <div className="rounded-xl border bg-card p-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="h-1.5 w-16 rounded-full bg-muted-foreground/25" />
              <div className="h-1.5 w-8 rounded-full bg-muted-foreground/15" />
            </div>
            <div className="flex items-end gap-[3px] h-9">
              {[38, 62, 48, 70, 52, 78, 58, 85, 65, 90, 72, 88].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/25"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-1.5">
            <div className="h-6 flex-1 rounded-lg bg-primary/75" />
            <div className="h-6 w-16 rounded-lg bg-muted border" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThemeStatusRow({
  activeTheme,
  resolvedDisplay,
  lastSaved,
}: {
  activeTheme: ThemeValue;
  resolvedDisplay: string;
  lastSaved: Date | null;
}) {
  const label = THEME_OPTIONS.find(o => o.value === activeTheme)?.label ?? 'System';

  return (
    <dl className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <dt>Preference:</dt>
        <dd className="text-foreground font-medium">{label}</dd>
      </div>
      <span className="text-border select-none" aria-hidden>·</span>
      <div className="flex items-center gap-1">
        <dt>Active:</dt>
        <dd className="text-foreground font-medium">{resolvedDisplay}</dd>
      </div>
      {lastSaved && (
        <>
          <span className="text-border select-none" aria-hidden>·</span>
          <dd className="text-muted-foreground">Saved just now</dd>
        </>
      )}
    </dl>
  );
}

function ThemeSettingsSkeleton() {
  return (
    <div className="space-y-5">
      <Card className="app-card">
        <CardHeader className="pb-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-72 mt-1" />
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Skeleton className="h-[104px] rounded-2xl" />
            <Skeleton className="h-[104px] rounded-2xl" />
            <Skeleton className="h-[104px] rounded-2xl" />
          </div>
          <Skeleton className="h-4 w-48" />
        </CardContent>
      </Card>
      <Skeleton className="h-[248px] rounded-2xl" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ThemeSettings = ({ profile, onUpdate }: ThemeSettingsProps) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted,     setMounted]     = useState(false);
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('idle');
  const [savingTheme, setSavingTheme] = useState<ThemeValue | null>(null);
  const [lastSaved,   setLastSaved]   = useState<Date | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const handleThemeChange = useCallback(async (newTheme: ThemeValue) => {
    const currentTheme = (theme ?? profile.theme_preference ?? 'system') as ThemeValue;
    if (newTheme === currentTheme) return;

    const previousTheme = currentTheme;
    setSavingTheme(newTheme);
    setSaveStatus('saving');
    setTheme(newTheme);

    try {
      await onUpdate({ theme_preference: newTheme });
      setSaveStatus('saved');
      setLastSaved(new Date());
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setTheme(previousTheme);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3500);
    } finally {
      setSavingTheme(null);
    }
  }, [theme, profile.theme_preference, setTheme, onUpdate]);

  if (!mounted) return <ThemeSettingsSkeleton />;

  const activeTheme     = (theme ?? profile.theme_preference ?? 'system') as ThemeValue;
  const resolvedDisplay = resolvedTheme === 'dark' ? 'Dark' : 'Light';

  return (
    <div className="space-y-5">
      {/* ── Appearance selection ──────────────────────────────────────────── */}
      <Card className="app-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Choose how TW Ventures looks across your dashboard. This preference is saved to your profile.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <RadioGroup
            value={activeTheme}
            onValueChange={(v) => handleThemeChange(v as ThemeValue)}
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            {THEME_OPTIONS.map(option => (
              <ThemeOptionCard
                key={option.value}
                option={option}
                isSelected={activeTheme === option.value}
                isSaving={savingTheme === option.value}
                resolvedDisplay={resolvedDisplay}
              />
            ))}
          </RadioGroup>

          {/* Save feedback — aria-live keeps screen readers updated */}
          <div aria-live="polite" aria-atomic="true" className="min-h-5">
            {saveStatus === 'saved' && (
              <div className="flex items-center gap-1.5 text-xs text-accent dark:text-accent">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Appearance preference saved.
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                Couldn't save your preference. Your previous theme was restored.
              </div>
            )}
          </div>

          <Separator />

          <ThemeStatusRow
            activeTheme={activeTheme}
            resolvedDisplay={resolvedDisplay}
            lastSaved={lastSaved}
          />
        </CardContent>
      </Card>

      {/* ── Interface preview ─────────────────────────────────────────────── */}
      <Card className="app-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Interface Preview</CardTitle>
              <CardDescription className="mt-1">
                A quick look at how cards, actions, and insight panels will appear.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs capitalize shrink-0">
              {resolvedDisplay}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ThemePreview />
        </CardContent>
      </Card>
    </div>
  );
};

export default ThemeSettings;
