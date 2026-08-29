import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Users, 
  BarChart3, 
  Shield, 
  Database,
  FileText,
  MessageSquare,
  DollarSign,
  Activity
} from 'lucide-react';
import { useAuth } from '@/components/app/AuthProvider';
import { useNavigate } from 'react-router-dom';

const AdminNavigation: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';

  if (!isAdmin) {
    return null;
  }

  const adminMenuItems = [
    {
      id: 'dashboard',
      label: 'Admin Dashboard',
      icon: BarChart3,
      path: '/admin',
      description: 'Site-wide analytics and overview'
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      path: '/admin/users',
      description: 'Manage users and subscriptions'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: Activity,
      path: '/admin/analytics',
      description: 'Detailed site analytics'
    },
    {
      id: 'financial',
      label: 'Financial Tools',
      icon: DollarSign,
      path: '/admin/financial',
      description: 'Manage financial tools and data'
    },
    {
      id: 'content',
      label: 'Content Management',
      icon: FileText,
      path: '/admin/content',
      description: 'Manage site content and pages'
    },
    {
      id: 'communications',
      label: 'Communications',
      icon: MessageSquare,
      path: '/admin/communications',
      description: 'Manage emails and notifications'
    },
    {
      id: 'database',
      label: 'Database',
      icon: Database,
      path: '/admin/database',
      description: 'Database management and backups'
    }
  ];

  const superAdminItems = [
    {
      id: 'system',
      label: 'System Settings',
      icon: Settings,
      path: '/admin/system',
      description: 'System configuration and settings'
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      path: '/admin/security',
      description: 'Security settings and access control'
    }
  ];

  const handleNavigation = (path: string) => {
    if (path.startsWith('/admin')) {
      navigate(path);
    } else if (path.includes('?')) {
      const [basePath, query] = path.split('?');
      navigate({ pathname: basePath, search: query ? `?${query}` : '' });
    } else {
      navigate(path);
    }
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      {/* Admin Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center space-x-2 bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/10"
      >
        <Settings className="h-4 w-4" />
        <span>Admin</span>
        {/* Only a super admin has anything to add here; for a plain admin the
            badge just repeated the label. */}
        {isSuperAdmin && (
          <Badge variant="destructive" className="ml-1 text-xs">
            Super
          </Badge>
        )}
      </Button>

      {/* Admin Menu Dropdown */}
      {isExpanded && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Admin Panel
              </h3>
              <Badge variant={isSuperAdmin ? 'destructive' : 'default'}>
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </Badge>
            </div>

            <div className="space-y-1">
              {adminMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <item.icon className="h-5 w-5 text-gray-500 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </button>
              ))}

              {isSuperAdmin && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-600 my-2"></div>
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 px-3 py-1">
                    Super Admin Only
                  </div>
                  {superAdminItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleNavigation(item.path)}
                      className="w-full flex items-start space-x-3 p-3 rounded-lg hover:bg-destructive/10 dark:hover:bg-destructive/10/20 transition-colors text-left"
                    >
                      <item.icon className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <p>Role: <span className="font-medium">{userProfile?.role}</span></p>
                <p>Tier: <span className="font-medium">{userProfile?.subscriptionTier}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </div>
  );
};

export default AdminNavigation;
