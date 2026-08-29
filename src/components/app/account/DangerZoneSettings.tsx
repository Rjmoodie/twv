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
import { useAuth } from '@/components/app/AuthProvider';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ── Data export ───────────────────────────────────────────────────────────────

interface ExportQueryResult {
  data: unknown;
  error: { message: string } | null;
}

interface ExportQuery extends PromiseLike<ExportQueryResult> {
  eq(column: string, value: string): ExportQuery;
}

interface ExportTable {
  select(columns?: string): ExportQuery;
}

async function exportUserData(userId: string): Promise<void> {
  // These queries intentionally use the authenticated client. Database RLS is
  // the export boundary: personal tables are filtered to this user and shared
  // workspace tables include only organizations the user may already access.
  // Remove the generated typing escape after types are regenerated from the
  // new foundation migrations.
  const db = supabase as unknown as { from(table: string): ExportTable };
  const exportQueries: Array<[string, ExportQuery]> = [
    ['user_profile', db.from('user_profiles').select('*').eq('id', userId)],
    ['profile', db.from('profiles').select('*').eq('id', userId)],
    ['public_profile', db.from('public_profiles').select('*').eq('user_id', userId)],
    ['system_settings', db.from('system_settings').select('*').eq('user_id', userId)],
    ['login_activity', db.from('login_activity').select('*').eq('user_id', userId)],
    ['data_export_requests', db.from('data_export_requests').select('*').eq('user_id', userId)],
    ['billing_customers', db.from('billing_customers').select('*').eq('user_id', userId)],
    ['subscriptions', db.from('subscriptions').select('*').eq('user_id', userId)],
    ['usage_tracking', db.from('usage_tracking').select('*').eq('user_id', userId)],
    ['organizations', db.from('organizations').select('*')],
    ['organization_memberships', db.from('organization_members').select('*').eq('user_id', userId)],
    ['properties', db.from('properties').select('*')],
    ['deals', db.from('deals').select('*')],
    ['underwriting_versions', db.from('underwriting_versions').select('*')],
    ['brrrr_deals', db.from('brrrr_deals').select('*').eq('user_id', userId)],
    ['projects', db.from('projects').select('*')],
    ['project_budgets', db.from('project_budgets').select('*')],
    ['budget_line_items', db.from('budget_line_items').select('*')],
    ['project_costs', db.from('project_costs').select('*')],
    ['draw_requests', db.from('draw_requests').select('*')],
    ['draw_items', db.from('draw_items').select('*')],
    ['project_milestones', db.from('project_milestones').select('*')],
    ['lead_reviews', db.from('lead_reviews').select('*').eq('user_id', userId)],
    ['feedback', db.from('user_feedback').select('*').eq('user_id', userId)],
    ['feature_votes', db.from('feature_votes').select('*').eq('user_id', userId)],
    [
      'email_preferences',
      db.from('user_email_preferences')
        .select('user_id, transactional_enabled, reminders_enabled, updates_enabled, marketing_enabled, digest_enabled, unsubscribed, unsubscribed_at, created_at, updated_at')
        .eq('user_id', userId),
    ],
    ['notifications', db.from('notifications').select('*').eq('user_id', userId)],
    [
      'push_subscriptions',
      db.from('push_subscriptions')
        .select('id, user_id, endpoint, user_agent, created_at, updated_at')
        .eq('user_id', userId),
    ],
    ['calendar_reminders', db.from('calendar_reminders').select('*').eq('user_id', userId)],
  ];

  const exportedEntries = await Promise.all(exportQueries.map(async ([name, query]) => {
    const { data, error } = await query;
    if (error) throw new Error(`Could not export ${name}: ${error.message}`);
    return [name, data ?? []] as const;
  }));

  const blob = new Blob([JSON.stringify({
    exported_at: new Date().toISOString(),
    ...Object.fromEntries(exportedEntries),
  }, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tw-ventures-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Account deletion ──────────────────────────────────────────────────────────

async function deleteAccount(userId: string): Promise<void> {
  // The edge function validates ownership and subscription/workspace safety,
  // deletes a sole-member workspace, then removes the Auth user. Foreign-key
  // cascades perform the data cleanup in the same trusted backend boundary.
  const { error: fnError } = await supabase.functions.invoke('delete-account', {
    body: { user_id: userId },
  });
  if (fnError) throw new Error('Account deletion failed. Please contact your workspace administrator.');
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
      toast({ title: 'Could not open billing portal', description: 'Please contact your workspace administrator.', variant: 'destructive' });
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
        description: err instanceof Error ? err.message : 'Please contact your workspace administrator.',
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
            Download your profile, workspaces, properties, deals, underwriting, projects, leads, and account activity.
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
            Permanently deletes your account and sole-member workspaces. Active subscriptions and shared workspaces
            must be resolved first. This cannot be undone.
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
