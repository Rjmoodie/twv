import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import {
  User, Shield, Bell, Settings,
  Crown, Users, CheckCircle2, AlertCircle, Circle,
  RefreshCw, ChevronRight, ShieldAlert,
} from "lucide-react";

import ProfileSettings from "./account/ProfileSettings";
import EnhancedSecuritySettings from "./account/EnhancedSecuritySettings";
import NotificationSettings from "./account/NotificationSettings";
import ThemeSettings from "./account/ThemeSettings";
import DangerZoneSettings from "./account/DangerZoneSettings";
import { cn } from "@/lib/utils";
import type { Profile } from "./types";

// ── Data layer ────────────────────────────────────────────────────────────────

async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

async function updateProfile({ userId, updates }: { userId: string; updates: Partial<Profile> }): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

// ── Account readiness ─────────────────────────────────────────────────────────

type ReadinessStatus = 'Getting started' | 'In progress' | 'Almost ready' | 'Complete';

interface ReadinessStep {
  id:          string;
  title:       string;
  description: string;
  targetTab:   string;
  priority:    'high' | 'medium' | 'low';
}

interface AccountReadiness {
  score:            number;         // 0–100
  statusLabel:      ReadinessStatus;
  profileScore:     number;         // profile_completion_score (0–100)
  mfaEnabled:       boolean;
  steps:            ReadinessStep[];
}

function deriveReadiness(profile: Profile): AccountReadiness {
  const profileScore    = profile.profile_completion_score ?? 0;
  const mfaEnabled      = !!profile.two_factor_enabled;

  // Weighted score: profile 70, security 30
  const score = Math.round(
    (profileScore / 100) * 70 +
    (mfaEnabled ? 30 : 0)
  );

  const statusLabel: ReadinessStatus =
    score >= 90 ? 'Complete' :
    score >= 65 ? 'Almost ready' :
    score >= 35 ? 'In progress' : 'Getting started';

  const steps: ReadinessStep[] = [];

  if (profileScore < 75) {
    steps.push({
      id:          'profile',
      title:       'Complete your profile',
      description: 'Improves personalization across your dashboard and Financial Coach.',
      targetTab:   'profile',
      priority:    'medium',
    });
  }
  if (!mfaEnabled) {
    steps.push({
      id:          'security',
      title:       'Enable two-factor authentication',
      description: 'Protects your account and any project data shared with you.',
      targetTab:   'security',
      priority:    'high',
    });
  }

  return { score, statusLabel, profileScore, mfaEnabled, steps };
}

// ── Status dot ────────────────────────────────────────────────────────────────

type DotState = 'complete' | 'partial' | 'empty';

function StatusDot({ state }: { state: DotState }) {
  return (
    <span className={cn(
      'inline-block w-1.5 h-1.5 rounded-full shrink-0',
      state === 'complete' ? 'bg-emerald-500' :
      state === 'partial'  ? 'bg-amber-400'   : 'bg-muted-foreground/30'
    )} />
  );
}

// ── Status card ───────────────────────────────────────────────────────────────

interface StatusCardProps {
  icon:       React.ReactNode;
  label:      string;
  value:      string;
  sub:        string;
  dot:        DotState;
  onClick:    () => void;
}

function StatusCard({ icon, label, value, sub, dot, onClick }: StatusCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left w-full rounded-2xl border border-border/50 bg-card/60 px-4 py-3.5 transition-all hover:border-border hover:shadow-sm hover:-translate-y-px active:translate-y-0"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
          {icon}
        </div>
        <StatusDot state={dot} />
      </div>
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold mt-0.5 leading-snug">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
    </button>
  );
}

// ── Recommended step ──────────────────────────────────────────────────────────

function SetupStep({ step, onNavigate }: { step: ReadinessStep; onNavigate: (tab: string) => void }) {
  return (
    <button
      onClick={() => onNavigate(step.targetTab)}
      className="group flex items-start gap-3 w-full text-left rounded-2xl border border-border/50 bg-card/40 px-4 py-3 transition-all hover:border-border hover:bg-card/70"
    >
      <div className={cn(
        'w-1.5 rounded-full self-stretch shrink-0 mt-1',
        step.priority === 'high' ? 'bg-primary/50' : 'bg-muted-foreground/25'
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{step.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ACCOUNT_TABS = ['profile', 'security', 'notifications', 'theme', 'account-data', 'admin'];

const AccountSettings: React.FC = () => {
  const { user, userProfile } = useAuth();
  const { toast }             = useToast();
  const queryClient           = useQueryClient();

  // The bell's "View all notifications" and any future deep link need to land
  // on a specific tab. Without this the tab was always 'profile', so every such
  // link dropped the reader on the profile form instead of what they clicked.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(
    requestedTab && ACCOUNT_TABS.includes(requestedTab) ? requestedTab : 'profile',
  );

  // A later link to the same module must move the tab too, not just the first.
  useEffect(() => {
    if (requestedTab && ACCOUNT_TABS.includes(requestedTab) && requestedTab !== activeTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  // Selecting a tab by hand should not leave a stale ?tab= in the URL that
  // would snap the reader back on the next render.
  const selectTab = (next: string) => {
    setActiveTab(next);
    if (searchParams.get('tab')) {
      const params = new URLSearchParams(searchParams);
      params.delete('tab');
      setSearchParams(params, { replace: true });
    }
  };
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn:  () => fetchProfile(user!.id),
    enabled:  !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: updateProfile,
    onMutate: async (variables) => {
      const key = ['profile', variables.userId] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Profile>(key);
      if (previous) queryClient.setQueryData<Profile>(key, { ...previous, ...variables.updates } as Profile);
      return { previous, key };
    },
    onError: (error: Error, _vars, ctx) => {
      if (ctx?.previous && ctx.key) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ title: 'Update failed', description: error?.message ?? 'Could not save. Please try again.', variant: 'destructive' });
    },
    onSuccess: (updated, vars) => {
      queryClient.setQueryData(['profile', vars.userId], updated);
      toast({ title: 'Saved', description: 'Your settings were updated.' });
    },
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: ['profile', vars.userId] });
    },
  });

  const handleUpdateProfile = useCallback(async (updates: Partial<Profile>): Promise<void> => {
    if (!user?.id) return;
    mutation.mutate({ userId: user.id, updates });
  }, [mutation, user?.id]);

  const readiness = useMemo(() => {
    if (!profileQuery.data) return null;
    return deriveReadiness(profileQuery.data);
  }, [profileQuery.data]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-7 w-32 bg-muted/60 rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-muted/40 rounded-lg animate-pulse" />
        </div>
        {/* Summary skeleton */}
        <div className="h-20 w-full bg-muted/40 rounded-2xl animate-pulse" />
        {/* Cards skeleton */}
        <div className="grid grid-cols-2 gap-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
        {/* Tabs skeleton */}
        <div className="h-10 bg-muted/30 rounded-2xl animate-pulse" />
        <div className="h-48 bg-muted/20 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (profileQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-5 py-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="font-medium text-sm">Couldn't load your settings</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Check your connection and try again. Your data hasn't been affected.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => profileQuery.refetch()} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
            <Button size="sm" variant="outline" onClick={() => queryClient.clear()}>
              Reset cache
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const profile = profileQuery.data;
  if (!profile) return null;

  // ── Tab config (with dot states) ──────────────────────────────────────────

  const profileDot: DotState  = (readiness?.profileScore ?? 0) >= 75 ? 'complete' : (readiness?.profileScore ?? 0) > 0 ? 'partial' : 'empty';
  const securityDot: DotState = readiness?.mfaEnabled ? 'complete' : 'partial';

  const tabs = [
    { value: 'profile',       label: 'Profile',       icon: <User className="h-4 w-4 shrink-0" />,          dot: profileDot  },
    { value: 'security',      label: 'Security',      icon: <Shield className="h-4 w-4 shrink-0" />,         dot: securityDot },
    { value: 'notifications', label: 'Notifications', icon: <Bell className="h-4 w-4 shrink-0" />,           dot: 'empty' as DotState },
    { value: 'theme',         label: 'Appearance',    icon: <Settings className="h-4 w-4 shrink-0" />,       dot: 'complete' as DotState },
    { value: 'account-data', label: 'Data & billing', icon: <ShieldAlert className="h-4 w-4 shrink-0" />,   dot: 'empty' as DotState },
    ...(isAdmin ? [{ value: 'admin', label: 'Admin', icon: <Crown className="h-4 w-4 shrink-0" />, dot: 'complete' as DotState }] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your identity, connected accounts, and preferences so TW Ventures can personalise your insights.
        </p>
      </div>

      {/* ── Readiness summary ───────────────────────────────────────────────── */}
      {readiness && (
        <div className="rounded-2xl border border-border/50 bg-card/60 px-5 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Account setup</p>
              <p className="text-xs text-muted-foreground mt-0.5">{readiness.statusLabel}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {readiness.score >= 90
                ? <CheckCircle2 className="h-4 w-4 text-accent" />
                : <Circle className="h-4 w-4 text-muted-foreground/40" />
              }
              <span className="text-sm font-semibold tabular-nums">{readiness.score}%</span>
            </div>
          </div>
          {/* Segmented bar — proportional to each component's weight in the score */}
          <div
            className="flex gap-0.5 h-1.5 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={readiness.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Account setup ${readiness.score}% complete`}
          >
            {/* Profile 70% */}
            <div className="rounded-l-full bg-primary/15 overflow-hidden" style={{ flexBasis: '70%' }}>
              <div className="h-full bg-primary transition-all duration-500 rounded-l-full"
                style={{ width: `${readiness.profileScore}%` }} />
            </div>
            {/* Security 30% */}
            <div className="rounded-r-full bg-primary/15 overflow-hidden" style={{ flexBasis: '30%' }}>
              <div className="h-full bg-primary transition-all duration-500 rounded-r-full"
                style={{ width: readiness.mfaEnabled ? '100%' : '0%' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Status cards ────────────────────────────────────────────────────── */}
      {readiness && (
        <div className="grid grid-cols-2 gap-3">
          <StatusCard
            icon={<User className="h-4 w-4" />}
            label="Profile"
            value={`${readiness.profileScore}% complete`}
            sub={readiness.profileScore >= 75 ? 'Fully personalised' : 'Add bio & location'}
            dot={profileDot}
            onClick={() => setActiveTab('profile')}
          />
          <StatusCard
            icon={<Shield className="h-4 w-4" />}
            label="Security"
            value={readiness?.mfaEnabled ? 'Protected' : 'Review needed'}
            sub={readiness?.mfaEnabled ? '2FA enabled' : 'Enable 2FA for full protection'}
            dot={securityDot}
            onClick={() => setActiveTab('security')}
          />
        </div>
      )}

      {/* ── Recommended steps ───────────────────────────────────────────────── */}
      {readiness && readiness.steps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-0.5">
            Recommended setup
          </p>
          <div className="space-y-2">
            {readiness.steps.slice(0, 2).map(step => (
              <SetupStep key={step.id} step={step} onNavigate={setActiveTab} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={selectTab} className="space-y-4">
        {/* Mobile: native select */}
        <div className="sm:hidden">
          <div className="relative">
            <select
              value={activeTab}
              onChange={e => setActiveTab(e.target.value)}
              className="w-full appearance-none rounded-2xl border border-border/60 bg-card/60 px-4 py-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring pr-10"
            >
              {tabs.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        {/* Desktop: scrollable tab strip */}
        <TabsList className="hidden sm:flex w-full justify-start overflow-x-auto whitespace-nowrap rounded-2xl border border-border/60 bg-card/60 p-1 scrollbar-hide">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value} className="shrink-0 gap-2 rounded-xl">
              {t.icon}
              {t.label}
              <StatusDot state={t.dot} />
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile"       className="space-y-4"><ProfileSettings profile={profile} onUpdate={handleUpdateProfile} /></TabsContent>
        <TabsContent value="security"      className="space-y-4"><EnhancedSecuritySettings /></TabsContent>
        <TabsContent value="notifications" className="space-y-4"><NotificationSettings /></TabsContent>
        <TabsContent value="theme"         className="space-y-4"><ThemeSettings profile={profile} onUpdate={handleUpdateProfile} /></TabsContent>
        <TabsContent value="account-data"  className="space-y-4"><DangerZoneSettings /></TabsContent>

        {isAdmin && (
          <TabsContent value="admin" className="space-y-4">
            <Card className="app-card">
              <CardContent className="pt-5 space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
                  <div>
                    <p className="font-medium text-sm">Current role</p>
                    <p className="text-xs text-muted-foreground">
                      {userProfile?.role === 'super_admin' ? 'Super Admin' : 'Admin'} — elevated platform access
                    </p>
                  </div>
                  <Crown className="h-4 w-4 text-warning shrink-0" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    [<Users className="h-3.5 w-3.5" />, 'User management'],
                    [<Shield className="h-3.5 w-3.5" />, 'System settings'],
                    [<Crown className="h-3.5 w-3.5" />, 'Course management'],
                    [<Settings className="h-3.5 w-3.5" />, 'Analytics access'],
                  ].map(([icon, label], i) => (
                    <div key={i} className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      {icon}{label}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 px-4 py-3">
                  Admin privileges grant access regardless of subscription tier. Use the admin dashboard for user and system management.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default AccountSettings;
