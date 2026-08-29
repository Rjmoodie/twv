import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/app/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, Link, Unlink, RefreshCw, AlertTriangle } from 'lucide-react';

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID;

function buildDiscordOAuthUrl(accessToken: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const redirectUri = `${supabaseUrl}/functions/v1/discord-oauth-callback`;
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state: accessToken, // pass JWT as state so callback can identify the user
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

export default function DiscordSettings() {
  const { userProfile } = useAuth();
  const { subscriptionTier, features } = useSubscription();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [justConnected, setJustConnected] = useState(false);

  const isConnected = !!userProfile?.discordId;
  const hasDiscordAccess = features.optionsTradingDiscord || features.discordChat;

  // Handle ?discord_connected=1 redirect from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('discord_connected') === '1') {
      setJustConnected(true);
      toast({ title: 'Discord connected', description: 'Your account is linked and roles have been synced.' });
      // Clean up the URL
      const clean = new URL(window.location.href);
      clean.searchParams.delete('discord_connected');
      window.history.replaceState({}, '', clean.toString());
    }
    if (params.get('discord_error')) {
      toast({
        title: 'Discord connection failed',
        description: decodeURIComponent(params.get('discord_error')!),
        variant: 'destructive',
      });
      const clean = new URL(window.location.href);
      clean.searchParams.delete('discord_error');
      window.history.replaceState({}, '', clean.toString());
    }
  }, []);

  const handleConnect = async () => {
    if (!DISCORD_CLIENT_ID) {
      toast({ title: 'Not configured', description: 'Discord OAuth is not set up yet.', variant: 'destructive' });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: 'Sign in required', description: 'Please sign in first.', variant: 'destructive' });
      return;
    }
    window.location.href = buildDiscordOAuthUrl(session.access_token);
  };

  const handleDisconnect = async () => {
    const { error } = await supabase
      .from('user_profiles')
      .update({ discord_id: null, discord_username: null })
      .eq('id', userProfile?.id);

    if (error) {
      toast({ title: 'Error', description: 'Could not disconnect Discord.', variant: 'destructive' });
    } else {
      toast({ title: 'Disconnected', description: 'Your Discord account has been unlinked.' });
      setJustConnected(false);
    }
  };

  const handleResync = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.functions.invoke('discord-role-sync', {
        body: { user_id: userProfile?.id },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      toast({ title: 'Roles synced', description: 'Your Discord roles have been updated.' });
    } catch {
      toast({ title: 'Sync failed', description: 'Could not sync roles. Please try again.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const tierLabel: Record<string, string> = {
    free: 'Free',
    tier1: 'Tier 1 — Options Trading',
    tier2: 'Tier 2 — Full Discord',
    tier3: 'Tier 3 — Full Discord',
  };

  return (
    <Card className="app-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
          </svg>
          Discord
        </CardTitle>
        <CardDescription>
          Link your Discord account to get server roles based on your subscription tier.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subscription tier badge */}
        <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Your tier</p>
            <p className="text-xs text-muted-foreground">{tierLabel[subscriptionTier] ?? subscriptionTier}</p>
          </div>
          <Badge variant={hasDiscordAccess ? 'default' : 'secondary'}>
            {hasDiscordAccess ? 'Discord access' : 'No Discord access'}
          </Badge>
        </div>

        {!hasDiscordAccess && (
          <div className="flex items-start gap-2 rounded-xl border border-warning/20/30 bg-warning/100/10 px-3 py-2.5 text-xs text-warning">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Upgrade to Tier 1 or higher to unlock Discord access and get your server roles.</span>
          </div>
        )}

        {/* Connection status */}
        {isConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-accent/20/30 bg-accent/10 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Connected</p>
                <p className="text-xs text-muted-foreground truncate">{userProfile?.discordUsername}</p>
              </div>
              {(justConnected) && (
                <Badge variant="secondary" className="text-xs shrink-0">Just linked</Badge>
              )}
            </div>

            <div className="flex gap-2">
              {hasDiscordAccess && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResync}
                  disabled={isSyncing}
                  className="gap-1.5 flex-1"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing…' : 'Re-sync roles'}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDisconnect}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Unlink className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={!DISCORD_CLIENT_ID}
            className="w-full gap-2"
            style={{ backgroundColor: '#5865F2' }}
          >
            <Link className="h-4 w-4" />
            Connect Discord
          </Button>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          TW Ventures only reads your Discord username and ID — it cannot post or read messages on your behalf.
        </p>
      </CardContent>
    </Card>
  );
}
