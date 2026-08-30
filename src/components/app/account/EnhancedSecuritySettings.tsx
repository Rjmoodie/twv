import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Shield, AlertTriangle, Download, Trash2, History, Smartphone, Eye } from "lucide-react";

interface LoginActivity {
  id: string;
  login_timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  location: string | null;
  success: boolean;
}

const EnhancedSecuritySettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loginActivity, setLoginActivity] = useState<LoginActivity[]>([]);
  const [showLoginHistory, setShowLoginHistory] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLoginActivity();
    }
  }, [user]);

  const fetchLoginActivity = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('login_activity')
        .select('*')
        .eq('user_id', user.id)
        .order('login_timestamp', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLoginActivity((data || []).map(item => ({
        ...item,
        ip_address: item.ip_address?.toString() || 'Unknown'
      })));
    } catch (error) {
      console.error('Error fetching login activity:', error);
    }
  };


  const handleRequestDataExport = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('data_export_requests')
        .insert({
          user_id: user.id,
          request_type: 'export'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Data export request submitted. You'll receive an email when ready.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request data export",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccountDeletion = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('data_export_requests')
        .insert({
          user_id: user.id,
          request_type: 'deletion'
        });

      if (error) throw error;

      toast({
        title: "Account Deletion Requested",
        description: "Your account deletion request has been submitted. This action cannot be undone.",
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request account deletion",
        variant: "destructive",
      });
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Login Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>Login Activity</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowLoginHistory(!showLoginHistory)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showLoginHistory ? "Hide" : "View"} History
            </Button>
          </div>
          <CardDescription>
            Monitor recent login activity on your account
          </CardDescription>
        </CardHeader>
        {showLoginHistory && (
          <CardContent>
            <div className="space-y-3">
              {loginActivity.length > 0 ? (
                loginActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getDeviceIcon(activity.device_type)}
                      <div>
                        <div className="font-medium">{activity.device_type}</div>
                        <div className="text-sm text-muted-foreground">
                          {activity.ip_address} • {activity.location}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatTimestamp(activity.login_timestamp)}
                      </div>
                      <Badge variant={activity.success ? "default" : "destructive"}>
                        {activity.success ? "Success" : "Failed"}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No login activity recorded yet
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <Separator />

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Data & Privacy</CardTitle>
          <CardDescription>
            Manage your personal data and privacy settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <h4 className="font-medium">Export Your Data</h4>
              <p className="text-sm text-muted-foreground">
                Download a copy of all your personal data (GDPR compliant)
              </p>
            </div>
            <Button variant="outline" onClick={handleRequestDataExport} disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              Request Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-destructive rounded-lg">
            <div className="space-y-1">
              <h4 className="font-medium text-destructive">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers. Are you absolutely sure?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRequestAccountDeletion}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Yes, Delete My Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
            <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-medium">Data Processing Notice</h4>
              <p className="text-sm text-muted-foreground">
                Data export and deletion requests are processed manually and may take up to 30 days to complete. 
                You'll receive email notifications about the status of your request.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedSecuritySettings;
