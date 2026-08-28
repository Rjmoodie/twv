import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { BarChart3, TrendingUp, Clock, Target, Award, Calendar, Activity, FileText, Crown, Users, Settings } from "lucide-react";
import { useUserStats } from './hooks/useUserStats';
import { useAuth } from './AuthProvider';

const UserDashboard = () => {
  const { stats, recentActivity, loading, error } = useUserStats();
  const { userProfile } = useAuth();

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getMembershipDuration = () => {
    if (!stats.member_since) return '0 days';
    const memberSince = new Date(stats.member_since);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - memberSince.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months`;
    return `${Math.floor(diffDays / 365)} years`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
              <p className="text-muted-foreground text-lg">
                Track your progress and activity on SomaTech
              </p>
            </div>
            {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
              <Badge variant="default" className="flex items-center gap-2 px-3 py-1">
                <Crown className="h-4 w-4" />
                {userProfile.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </Badge>
            )}
          </div>
        </div>

        {/* Admin Quick Actions */}
        {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <Crown className="h-5 w-5" />
                Admin Quick Actions
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                Quick access to admin features and management tools
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                  <Users className="h-6 w-6" />
                  <span>User Management</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                  <Crown className="h-6 w-6" />
                  <span>Course Management</span>
                </Button>
                <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
                  <Settings className="h-6 w-6" />
                  <span>System Settings</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="elegant-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{stats.total_analyses}</p>
                  <p className="text-sm text-muted-foreground">Analyses</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{stats.watchlist_items}</p>
                  <p className="text-sm text-muted-foreground">Watchlist Items</p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{stats.saved_plans}</p>
                  <p className="text-sm text-muted-foreground">Saved Plans</p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-foreground">{stats.login_count}</p>
                  <p className="text-sm text-muted-foreground">Total Logins</p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center">
                  <Activity className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Completion */}
          <Card className="premium-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Award className="h-5 w-5 text-primary" />
                </div>
                Profile Completion
              </CardTitle>
              <CardDescription className="text-base">
                Complete your profile to unlock all features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{stats.profile_completion}%</span>
                </div>
                <Progress value={stats.profile_completion} className="h-2" />
              </div>
              
              {stats.profile_completion < 100 && (
                <Button 
                  size="sm" 
                  onClick={() => window.location.href = '/somatech?module=account'}
                  className="w-full"
                >
                  Complete Profile
                </Button>
              )}
              
              {stats.profile_completion === 100 && (
                <div className="flex items-center gap-2 text-accent text-sm">
                  <Award className="h-4 w-4" />
                  <span>Profile Complete!</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="premium-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-accent" />
                </div>
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-medium">{formatDate(stats.member_since)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Membership Duration</span>
                <span className="text-sm font-medium">{getMembershipDuration()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Last Login</span>
                <span className="text-sm font-medium">{formatDateTime(stats.last_login)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Account Status</span>
                <Badge variant="default">Active</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <Card className="premium-card">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="w-10 h-10 bg-success/10 rounded-xl flex items-center justify-center">
                <Clock className="h-5 w-5 text-success" />
              </div>
              Recent Activity
            </CardTitle>
            <CardDescription className="text-base">
              Your latest actions on SomaTech
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => {
                  const IconComponent = activity.icon;
                  return (
                    <div key={index} className="flex items-center gap-4 p-4 surface-card hover:bg-muted/30 transition-colors">
                      <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <IconComponent className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="font-medium text-sm text-foreground">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">{activity.subtitle}</div>
                      </div>
                      <div className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDate(activity.timestamp)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No recent activity. Start by analyzing a stock or creating a plan!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserDashboard;
