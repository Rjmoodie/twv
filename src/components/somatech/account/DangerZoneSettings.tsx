import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertTriangle, Trash2, Download, CreditCard,
  Loader2, ExternalLink, ShieldAlert,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Data export ───────────────────────────────────────────────────────────────

async function exportUserData(userId: string): Promise<void> {
  const [profile, plaidConns, journeyPosts, snapshots, cashFlows, brokerAuthorizations, brokerConnections, brokerSnapshots, brokerPositions, brokerExecutions, tradeAnnotations, tradePublications] = await Promise.allSettled([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('plaid_connections').select('item_id, institution_name, accounts, last_synced_at').eq('user_id', userId),
    supabase.from('journey_posts').select('*').eq('user_id', userId),
    supabase.from('net_worth_snapshots').select('*').eq('user_id', userId),
    supabase.from('cash_flows').select('*').eq('user_id', userId),
    (supabase as any).from('brokerage_authorizations').select('id,provider,status,refresh_expires_at,last_authorized_at,disconnected_at,created_at').eq('user_id', userId),
    (supabase as any).from('brokerage_connections').select('id,portfolio_id,authorization_id,provider,environment,account_id,account_type,account_number_last_four,display_name,capabilities,is_active,is_primary,connection_status,last_sync_attempt_at,last_positions_synced_at,last_executions_synced_at,provider_data_as_of,last_reconciled_at,reconciliation_status,reconciliation_variance,last_sync_error,created_at,updated_at').eq('user_id', userId),
    (supabase as any).from('brokerage_account_snapshots').select('*').eq('user_id', userId),
    (supabase as any).from('brokerage_positions').select('*').eq('user_id', userId),
    (supabase as any).from('brokerage_executions').select('*').eq('user_id', userId),
    (supabase as any).from('trade_annotations').select('*').eq('user_id', userId),
    (supabase as any).from('trade_publications').select('*').eq('user_id', userId),
  ]);

  const extract = (r: PromiseSettledResult<any>) =>
    r.status === 'fulfilled' ? (r.value.data ?? []) : [];

  const blob = new Blob([JSON.stringify({
    exported_at: new Date().toISOString(),
    profile: extract(profile),
    plaid_connections: extract(plaidConns),
    journey_posts: extract(journeyPosts),
    net_worth_snapshots: extract(snapshots),
    cash_flows: extract(cashFlows),
    brokerage_authorizations: extract(brokerAuthorizations),
    brokerage_connections: extract(brokerConnections),
    brokerage_account_snapshots: extract(brokerSnapshots),
    brokerage_positions: extract(brokerPositions),
    brokerage_executions: extract(brokerExecutions),
    trade_annotations: extract(tradeAnnotations),
    trade_publications: extract(tradePublications),
  }, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `somatech-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Account deletion ──────────────────────────────────────────────────────────

async function deleteAccount(userId: string): Promise<void> {
  // Step 1: Delete auth user first via edge function (requires service role).
  // We do this BEFORE wiping table data so that if the edge function fails,
  // no data is lost and the user can try again.
  const { error: fnError } = await supabase.functions.invoke('delete-account', {
    body: { user_id: userId },
  });
  if (fnError) throw new Error('Account deletion failed. Please contact support@somatech.pro');

  // Step 2: Wipe all user data now that auth account is gone.
  // Using allSettled so a missing table doesn't block the rest.
  await Promise.allSettled([
    supabase.from('journey_posts').delete().eq('user_id', userId),
    supabase.from('post_reactions').delete().eq('user_id', userId),
    supabase.from('plaid_connections').delete().eq('user_id', userId),
    supabase.from('net_worth_snapshots').delete().eq('user_id', userId),
    supabase.from('cash_flows').delete().eq('user_id', userId),
    supabase.from('watchlist').delete().eq('user_id', userId),
    supabase.from('coach_profiles').delete().eq('user_id', userId),
    supabase.from('notifications').delete().eq('user_id', userId),
    supabase.from('profiles').delete().eq('id', userId),
  ]);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DangerZoneSettings() {
  const { user, signOut } = useAuth();
  const { openCustomerPortal, subscriptionTier, isActive } = useSubscription();

  const [exportLoading, setExportLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleExport = async () => {
    if (!user) return;
    setExportLoading(true);
    try {
      await exportUserData(user.id);
      toast({ title: 'Data exported', description: 'Your data has been downloaded as a JSON file.' });
    } catch {
      toast({ title: 'Export failed', description: 'Please try again or contact support.', variant: 'destructive' });
    } finally {
      setExportLoading(false);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } catch {
      toast({ title: 'Could not open billing portal', description: 'Please contact support@somatech.pro', variant: 'destructive' });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || deleteConfirm !== 'DELETE') return;
    setDeleteLoading(true);
    try {
      await deleteAccount(user.id);
      await signOut();
      toast({ title: 'Account deleted', description: 'Your account and data have been permanently removed.' });
    } catch (err) {
      toast({
        title: 'Deletion failed',
        description: err instanceof Error ? err.message : 'Please contact support@somatech.pro',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Subscription management */}
      <Card className="app-card">
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Subscription</h3>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium capitalize">
                {subscriptionTier === 'free' ? 'Free plan' : `${subscriptionTier?.replace('tier', 'Tier ')} plan`}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive ? 'Active' : 'No active subscription'}
              </p>
            </div>
            {subscriptionTier !== 'free' && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePortal}
                disabled={portalLoading}
                className="gap-1.5 shrink-0"
              >
                {portalLoading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <ExternalLink className="h-3.5 w-3.5" />}
                Manage billing
              </Button>
            )}
          </div>

          {subscriptionTier !== 'free' && (
            <p className="text-xs text-muted-foreground px-1">
              Cancel anytime via the billing portal. Access continues until the end of your billing period.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Data export */}
      <Card className="app-card">
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Download className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Export your data</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Download a copy of all your data — profile, financial snapshots, journey posts, and connected accounts.
            Your right under GDPR Article 20.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportLoading}
            className="gap-2"
          >
            {exportLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Download className="h-3.5 w-3.5" />}
            {exportLoading ? 'Preparing…' : 'Download my data'}
          </Button>
        </CardContent>
      </Card>

      {/* Account deletion */}
      <Card className={cn('app-card', 'border-destructive/30')}>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-destructive">Delete account</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Permanently deletes your account, all financial data, journey posts, and bank connections.
            This cannot be undone.
          </p>

          {!deleteOpen ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteOpen(true)}
              className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete my account
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium leading-relaxed">
                  This will permanently erase all your data. Type <strong>DELETE</strong> to confirm.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="delete-confirm" className="text-xs">Confirmation</Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value.toUpperCase())}
                  placeholder="Type DELETE"
                  className="h-9 text-sm border-destructive/40 focus-visible:ring-destructive/30"
                  autoComplete="off"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteConfirm !== 'DELETE' || deleteLoading}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2"
                >
                  {deleteLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Trash2 className="h-3.5 w-3.5" />}
                  {deleteLoading ? 'Deleting…' : 'Delete permanently'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
