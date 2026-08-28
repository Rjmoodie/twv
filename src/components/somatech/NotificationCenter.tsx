import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, Filter, MoreHorizontal, Trash2, ExternalLink, AlertCircle, Info, CheckCircle, AlertTriangle, TrendingUp, DollarSign, BarChart3, CheckCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'alert' | 'analysis_complete' | 'watchlist_alert' | 'price_target' | 'weekly_summary';
  category: 'system' | 'analysis' | 'watchlist' | 'portfolio' | 'security' | 'marketing';
  read: boolean;
  action_url: string | null;
  action_label: string | null;
  priority: number;
  created_at: string;
  read_at: string | null;
}

const fetchNotifications = async (userId: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
};

const NotificationCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | 'system' | 'analysis' | 'watchlist'>('all');

  const { data: notifications, isLoading, error } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => user ? fetchNotifications(user.id) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 60000
  });

  const subscribeToNotifications = () => {
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
          
          // Show toast for high priority notifications
          if (newNotification.priority >= 3) {
            toast({
              title: newNotification.title,
              description: newNotification.message,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications();
  }, [user?.id]);

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;

      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', user.id);

      if (error) throw error;

      // setNotifications(prev => prev.filter(n => n.id !== notificationId)); // This line is removed as notifications state is now managed by React Query
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
      case 'analysis_complete':
        return <CheckCircle className="h-5 w-5 text-accent" />;
      case 'warning':
      case 'watchlist_alert':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'price_target':
        return <DollarSign className="h-5 w-5 text-blue-600" />;
      case 'weekly_summary':
        return <BarChart3 className="h-5 w-5 text-purple-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getFilteredNotifications = () => {
    switch (filter) {
      case 'unread':
        return notifications?.filter(n => !n.read) || [];
      case 'system':
      case 'analysis':
      case 'watchlist':
        return notifications?.filter(n => n.category === filter) || [];
      default:
        return notifications || [];
    }
  };

  const unreadCount = notifications?.filter(n => !n.read).length || 0;
  const filteredNotifications = getFilteredNotifications();

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Error loading notifications</h3>
        <p className="text-muted-foreground">
          Failed to fetch notifications. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(value: any) => setFilter(value)}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-1 text-xs">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  {filteredNotifications.length > 0 ? (
                    <div className="divide-y">
                      {filteredNotifications.map((notification) => (
                        <div 
                          key={notification.id}
                          className={`p-4 hover:bg-muted/50 transition-colors ${
                            !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              {getNotificationIcon(notification.type)}
                            </div>
                            
                            <div className="flex-grow min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className={`font-medium truncate ${
                                      !notification.read ? 'text-foreground' : 'text-muted-foreground'
                                    }`}>
                                      {notification.title}
                                    </h3>
                                    {!notification.read && (
                                      <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {notification.message}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>{formatTime(notification.created_at)}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {notification.category}
                                    </Badge>
                                    {notification.priority > 3 && (
                                      <Badge variant="destructive" className="text-xs">
                                        High Priority
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {notification.action_url && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.location.href = notification.action_url!}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      {notification.action_label || 'View'}
                                    </Button>
                                  )}
                                  
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {!notification.read && (
                                        <DropdownMenuItem onClick={() => markAsRead(notification.id)}>
                                          <Check className="h-4 w-4 mr-2" />
                                          Mark as Read
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        onClick={() => deleteNotification(notification.id)}
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No notifications</h3>
                      <p className="text-muted-foreground">
                        {filter === 'unread' 
                          ? "You're all caught up! No unread notifications."
                          : "You don't have any notifications yet."}
                      </p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NotificationCenter;
