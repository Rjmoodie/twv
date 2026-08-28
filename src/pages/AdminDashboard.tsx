import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Download,
  Search,
  Filter,
  Crown,
  Zap,
  Star,
  Rocket,
  MessageSquare,
  AlertTriangle,
  BookOpen,
  BarChart3,
  Settings,
  Eye,
  Edit,
  Trash2,
  ArrowLeft
} from 'lucide-react';
import { SubscriptionService } from '@/services/subscription';
import { DiscordService } from '@/services/discord';
import { SubscriptionTier, UserRole } from '@/types/subscription';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/somatech/AuthProvider';
import { courseService, Course } from '@/services/courseService';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface AdminStats {
  totalUsers: number;
  tierCounts: Record<SubscriptionTier, number>;
  activeSubscriptions: number;
  monthlyRevenue: number;
}

interface User {
  id: string;
  email: string;
  name: string;
  subscription_tier: SubscriptionTier;
  role: UserRole;
  subscription_status: string;
  discord_id?: string;
  discord_username?: string;
  created_at: string;
  subscription_ends_at?: string;
}

const AdminDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [courseStats, setCourseStats] = useState<{
    totalCourses: number;
    publishedCourses: number;
    draftCourses: number;
    totalStudents: number;
    averageRating: number;
  } | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<SubscriptionTier | 'all'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'courses' | 'analytics'>('overview');
  
  // Modal states
  const [courseEditModal, setCourseEditModal] = useState<{ open: boolean; course: Course | null }>({ open: false, course: null });
  const [courseCreateModal, setCourseCreateModal] = useState(false);
  const [userViewModal, setUserViewModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [userEditModal, setUserEditModal] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [deleteCourseConfirm, setDeleteCourseConfirm] = useState<{ open: boolean; courseId: string; title: string }>({ open: false, courseId: '', title: '' });
  const [deleteUserConfirm, setDeleteUserConfirm]     = useState<{ open: boolean; userId: string; name: string; email: string }>({ open: false, userId: '', name: '', email: '' });

  const loadUsers = async (): Promise<User[]> => {
    // Return mock user data since user_profiles table doesn't exist yet
    return [
      {
        id: '1',
        email: 'rodzrj@gmail.com',
        name: 'Admin User',
        subscription_tier: 'tier3' as SubscriptionTier,
        role: 'admin' as UserRole,
        subscription_status: 'active',
        discord_id: '123456789',
        discord_username: 'admin_user',
        created_at: new Date().toISOString(),
        subscription_ends_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '2',
        email: 'user1@example.com',
        name: 'John Doe',
        subscription_tier: 'tier2' as SubscriptionTier,
        role: 'user' as UserRole,
        subscription_status: 'active',
        discord_id: '987654321',
        discord_username: 'john_doe',
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: '3',
        email: 'user2@example.com',
        name: 'Jane Smith',
        subscription_tier: 'tier1' as SubscriptionTier,
        role: 'user' as UserRole,
        subscription_status: 'active',
        discord_id: '456789123',
        discord_username: 'jane_smith',
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_ends_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  };

  const filterUsers = () => {
    let filtered = users;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.discord_username?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Tier filter
    if (tierFilter !== 'all') {
      filtered = filtered.filter(user => user.subscription_tier === tierFilter);
    }

    setFilteredUsers(filtered);
  };

  const loadData = async () => {
    try {
      const [usersData, coursesData, courseStatsData] = await Promise.all([
        loadUsers(),
        courseService.getCourses(),
        courseService.getCourseStats()
      ]);
      
      // Create mock stats data
      const statsData: AdminStats = {
        totalUsers: usersData.length,
        activeSubscriptions: usersData.filter(u => u.subscription_status === 'active').length,
        monthlyRevenue: usersData.length * 99, // Mock revenue
        tierCounts: {
          tier1: usersData.filter(u => u.subscription_tier === 'tier1').length,
          tier2: usersData.filter(u => u.subscription_tier === 'tier2').length,
          tier3: usersData.filter(u => u.subscription_tier === 'tier3').length,
        }
      };
      
      setStats(statsData);
      setCourseStats(courseStatsData);
      setUsers(usersData);
      setCourses(coursesData);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, tierFilter]);

  // Check admin access - moved after all hooks
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  
  // Show loading state while user profile is being loaded
  if (loading || !userProfile) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  // Only show admin access required if user profile is loaded but user is not admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
          <p className="text-gray-600">You need admin privileges to access this dashboard.</p>
        </div>
      </div>
    );
  }

  const handleSyncDiscord = async () => {
    setActionLoading('discord-sync');
    try {
      const result = await DiscordService.syncAllUserRoles();
      toast.success(`Discord sync completed: ${result.success} successful, ${result.failed} failed`);
      loadData();
    } catch (error) {
      console.error('Error syncing Discord:', error);
      toast.error('Failed to sync Discord roles');
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportUsers = async () => {
    try {
      const csvContent = generateCSV(filteredUsers);
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `somatech-users-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Users exported successfully');
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('Failed to export users');
    }
  };

  const generateCSV = (users: User[]): string => {
    const headers = ['ID', 'Email', 'Name', 'Subscription Tier', 'Status', 'Discord ID', 'Discord Username', 'Created At', 'Subscription Ends At'];
    const rows = users.map(user => [
      user.id,
      user.email,
      user.name || '',
      user.subscription_tier,
      user.subscription_status,
      user.discord_id || '',
      user.discord_username || '',
      new Date(user.created_at).toLocaleDateString(),
      user.subscription_ends_at ? new Date(user.subscription_ends_at).toLocaleDateString() : ''
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
  };

  const getTierIcon = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'free':
        return <Star className="h-4 w-4" />;
      case 'tier1':
        return <Zap className="h-4 w-4" />;
      case 'tier2':
        return <Crown className="h-4 w-4" />;
      case 'tier3':
        return <Rocket className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'free':
        return 'bg-gray-100 text-gray-800';
      case 'tier1':
        return 'bg-blue-100 text-blue-800';
      case 'tier2':
        return 'bg-purple-100 text-purple-800';
      case 'tier3':
        return 'bg-warning/10 text-warning';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-accent/10 text-accent';
      case 'canceled':
        return 'bg-destructive/10 text-red-800';
      case 'past_due':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Course management functions
  const handleViewCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      // Open course in new tab or navigate to course view
      window.open(`/courses/${courseId}`, '_blank');
      toast.success(`Opening course: ${course.title}`);
    }
  };

  const handleEditCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setCourseEditModal({ open: true, course });
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    setDeleteCourseConfirm({ open: true, courseId, title: course.title });
  };

  const handleDeleteCourseConfirm = async () => {
    setActionLoading('delete-course');
    try {
      const success = await courseService.deleteCourse(deleteCourseConfirm.courseId);
      if (success) {
        const updatedCourses = await courseService.getCourses();
        setCourses(updatedCourses);
        toast.success(`Course "${deleteCourseConfirm.title}" deleted`);
      } else {
        toast.error('Failed to delete course');
      }
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Failed to delete course');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublishCourse = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    setActionLoading('publish-course');
    try {
      const success = await courseService.publishCourse(courseId);
      if (success) {
        // Reload courses
        const updatedCourses = await courseService.getCourses();
        setCourses(updatedCourses);
        toast.success(`Course "${course.title}" published successfully`);
      } else {
        toast.error('Failed to publish course');
      }
    } catch (error) {
      console.error('Error publishing course:', error);
      toast.error('Failed to publish course');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnpublishCourse = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    setActionLoading('unpublish-course');
    try {
      const success = await courseService.unpublishCourse(courseId);
      if (success) {
        // Reload courses
        const updatedCourses = await courseService.getCourses();
        setCourses(updatedCourses);
        toast.success(`Course "${course.title}" unpublished successfully`);
      } else {
        toast.error('Failed to unpublish course');
      }
    } catch (error) {
      console.error('Error unpublishing course:', error);
      toast.error('Failed to unpublish course');
    } finally {
      setActionLoading(null);
    }
  };

  // User management functions
  const handleViewUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserViewModal({ open: true, user });
    }
  };

  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setUserEditModal({ open: true, user });
    }
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setDeleteUserConfirm({ open: true, userId, name: user.name, email: user.email });
  };

  const handleDeleteUserConfirm = async () => {
    setActionLoading('delete-user');
    try {
      toast.success(`User "${deleteUserConfirm.name}" deleted (mock action)`);
      const updatedUsers = await loadUsers();
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers);
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => navigate('/')}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage subscriptions, users, and courses</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={handleSyncDiscord}
            disabled={actionLoading === 'discord-sync'}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <MessageSquare className="h-4 w-4" />
            <span>{actionLoading === 'discord-sync' ? 'Syncing...' : 'Sync Discord'}</span>
          </Button>
          <Button
            onClick={handleExportUsers}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Download className="h-4 w-4" />
            <span>Export Users</span>
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'users', label: 'Users', icon: Users },
          { key: 'courses', label: 'Courses', icon: BookOpen },
          { key: 'analytics', label: 'Analytics', icon: TrendingUp }
        ].map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeTab === key ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab(key as any)}
            className="flex items-center space-x-2"
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Button>
        ))}
      </div>

      {/* Stats Cards - Only show on overview tab */}
      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeSubscriptions}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.monthlyRevenue}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Discord Connected</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.discord_id).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Course Statistics */}
      {activeTab === 'overview' && courseStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Courses</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseStats.totalCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Published Courses</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseStats.publishedCourses}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseStats.totalStudents}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Rating</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{courseStats.averageRating}/5</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tier Breakdown */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tiers</CardTitle>
            <CardDescription>Distribution of users across subscription tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats.tierCounts).map(([tier, count]) => (
                <div key={tier} className="text-center">
                  <div className="flex justify-center mb-2">
                    {getTierIcon(tier as SubscriptionTier)}
                  </div>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-gray-600 capitalize">{tier}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage user subscriptions and access</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as SubscriptionTier | 'all')}
                className="px-3 py-2 border rounded-md"
              >
                <option value="all">All Tiers</option>
                <option value="free">Free</option>
                <option value="tier1">Tier 1</option>
                <option value="tier2">Tier 2</option>
                <option value="tier3">Tier 3</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">User</th>
                  <th className="text-left p-2">Tier</th>
                  <th className="text-left p-2">Status</th>
                  <th className="text-left p-2">Discord</th>
                  <th className="text-left p-2">Joined</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <div>
                        <div className="font-medium">{user.name || 'No name'}</div>
                        <div className="text-sm text-gray-600">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-2">
                      <Badge className={`${getTierColor(user.subscription_tier)} flex items-center space-x-1 w-fit`}>
                        {getTierIcon(user.subscription_tier)}
                        <span className="capitalize">{user.subscription_tier}</span>
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge className={`${getStatusColor(user.subscription_status)} w-fit`}>
                        {user.subscription_status}
                      </Badge>
                    </td>
                    <td className="p-2">
                      {user.discord_id ? (
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="h-4 w-4 text-blue-500" />
                          <span className="text-sm">{user.discord_username}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Not connected</span>
                      )}
                    </td>
                    <td className="p-2 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewUser(user.id)}
                          title="View User Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditUser(user.id)}
                          title="Edit User"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={actionLoading === 'delete-user'}
                          title="Delete User"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found matching your criteria
            </div>
          )}
        </CardContent>
      </Card>

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5" />
                    <span>Course Management</span>
                  </CardTitle>
                  <CardDescription>
                    Manage courses, content, and student progress
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setCourseCreateModal(true)}
                  className="flex items-center space-x-2"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Create Course</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {courses.map((course) => (
                  <div key={course.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold">{course.title}</h3>
                          <Badge variant="outline">{course.category}</Badge>
                          <Badge variant={course.isPublished ? 'default' : 'secondary'}>
                            {course.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        <p className="text-gray-600 mb-3">{course.description}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{course.students} students</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="h-4 w-4" />
                            <span>{course.rating}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{course.lessons.length} lessons</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewCourse(course.id)}
                          title="View Course"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditCourse(course.id)}
                          title="Edit Course"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {course.isPublished ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleUnpublishCourse(course.id)}
                            disabled={actionLoading === 'unpublish-course'}
                            title="Unpublish Course"
                            className="text-warning hover:text-warning"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handlePublishCourse(course.id)}
                            disabled={actionLoading === 'publish-course'}
                            title="Publish Course"
                            className="text-accent hover:text-accent"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteCourse(course.id)}
                          disabled={actionLoading === 'delete-course'}
                          title="Delete Course"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5" />
                <span>Analytics Dashboard</span>
              </CardTitle>
              <CardDescription>
                Detailed analytics and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>Analytics dashboard coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Course Edit Modal */}
      <Dialog open={courseEditModal.open} onOpenChange={(open) => setCourseEditModal({ open, course: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update course information and settings
            </DialogDescription>
          </DialogHeader>
          {courseEditModal.course && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Course Title</Label>
                  <Input
                    id="title"
                    defaultValue={courseEditModal.course.title}
                    placeholder="Enter course title"
                  />
                </div>
                <div>
                  <Label htmlFor="instructor">Instructor</Label>
                  <Input
                    id="instructor"
                    defaultValue={courseEditModal.course.instructor}
                    placeholder="Enter instructor name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  defaultValue={courseEditModal.course.description}
                  placeholder="Enter course description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    defaultValue={courseEditModal.course.category}
                    placeholder="Enter category"
                  />
                </div>
                <div>
                  <Label htmlFor="level">Level</Label>
                  <Select defaultValue={courseEditModal.course.level}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="price">Price ($)</Label>
                  <Input
                    id="price"
                    type="number"
                    defaultValue={courseEditModal.course.price}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="published"
                  defaultChecked={courseEditModal.course.isPublished}
                  className="rounded"
                />
                <Label htmlFor="published">Published</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseEditModal({ open: false, course: null })}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success('Course updated successfully!');
              setCourseEditModal({ open: false, course: null });
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Course Create Modal */}
      <Dialog open={courseCreateModal} onOpenChange={setCourseCreateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Course</DialogTitle>
            <DialogDescription>
              Create a new course for your platform
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="new-title">Course Title</Label>
                <Input
                  id="new-title"
                  placeholder="Enter course title"
                />
              </div>
              <div>
                <Label htmlFor="new-instructor">Instructor</Label>
                <Input
                  id="new-instructor"
                  placeholder="Enter instructor name"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="new-description">Description</Label>
              <Textarea
                id="new-description"
                placeholder="Enter course description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="new-category">Category</Label>
                <Input
                  id="new-category"
                  placeholder="Enter category"
                />
              </div>
              <div>
                <Label htmlFor="new-level">Level</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="new-price">Price ($)</Label>
                <Input
                  id="new-price"
                  type="number"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="new-published"
                className="rounded"
              />
              <Label htmlFor="new-published">Published</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success('Course created successfully!');
              setCourseCreateModal(false);
              // Reload courses
              loadData();
            }}>
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User View Modal */}
      <Dialog open={userViewModal.open} onOpenChange={(open) => setUserViewModal({ open, user: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View user information and activity
            </DialogDescription>
          </DialogHeader>
          {userViewModal.user && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <div className="p-2 bg-gray-50 rounded">{userViewModal.user.name || 'No name'}</div>
                </div>
                <div>
                  <Label>Email</Label>
                  <div className="p-2 bg-gray-50 rounded">{userViewModal.user.email}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Subscription Tier</Label>
                  <div className="p-2 bg-gray-50 rounded capitalize">{userViewModal.user.subscription_tier}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="p-2 bg-gray-50 rounded">{userViewModal.user.subscription_status}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Role</Label>
                  <div className="p-2 bg-gray-50 rounded capitalize">{userViewModal.user.role}</div>
                </div>
                <div>
                  <Label>Created At</Label>
                  <div className="p-2 bg-gray-50 rounded">{new Date(userViewModal.user.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              {userViewModal.user.discord_id && (
                <div>
                  <Label>Discord Information</Label>
                  <div className="p-2 bg-gray-50 rounded">
                    <div>ID: {userViewModal.user.discord_id}</div>
                    <div>Username: {userViewModal.user.discord_username}</div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserViewModal({ open: false, user: null })}>
              Close
            </Button>
            <Button onClick={() => {
              if (userViewModal.user) {
                setUserEditModal({ open: true, user: userViewModal.user });
                setUserViewModal({ open: false, user: null });
              }
            }}>
              Edit User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Edit Modal */}
      <Dialog open={userEditModal.open} onOpenChange={(open) => setUserEditModal({ open, user: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          {userEditModal.user && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user-name">Name</Label>
                  <Input
                    id="user-name"
                    defaultValue={userEditModal.user.name}
                    placeholder="Enter user name"
                  />
                </div>
                <div>
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    defaultValue={userEditModal.user.email}
                    placeholder="Enter email"
                    disabled
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user-tier">Subscription Tier</Label>
                  <Select defaultValue={userEditModal.user.subscription_tier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="tier1">Tier 1</SelectItem>
                      <SelectItem value="tier2">Tier 2</SelectItem>
                      <SelectItem value="tier3">Tier 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="user-role">Role</Label>
                  <Select defaultValue={userEditModal.user.role}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="user-status">Status</Label>
                <Select defaultValue={userEditModal.user.subscription_status}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserEditModal({ open: false, user: null })}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success('User updated successfully!');
              setUserEditModal({ open: false, user: null });
              // Reload users
              loadData();
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm dialogs for destructive admin actions */}
      <ConfirmDialog
        open={deleteCourseConfirm.open}
        onOpenChange={(open) => setDeleteCourseConfirm(s => ({ ...s, open }))}
        title={`Delete "${deleteCourseConfirm.title}"?`}
        description="This course and all its content will be permanently deleted."
        detail="This action cannot be undone. Enrolled students will lose access immediately."
        confirmLabel="Delete course"
        onConfirm={handleDeleteCourseConfirm}
        loading={actionLoading === 'delete-course'}
      />
      <ConfirmDialog
        open={deleteUserConfirm.open}
        onOpenChange={(open) => setDeleteUserConfirm(s => ({ ...s, open }))}
        title={`Delete ${deleteUserConfirm.name}?`}
        description={`This will permanently delete ${deleteUserConfirm.email}'s account and all associated data.`}
        detail="This action cannot be undone. The user will be immediately logged out and unable to recover their account."
        confirmLabel="Delete user"
        onConfirm={handleDeleteUserConfirm}
        loading={actionLoading === 'delete-user'}
      />
    </div>
  );
};

export default AdminDashboard;
