import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Shield, 
  Lock, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  Activity,
  FileText,
  Calendar,
  User,
  Globe,
  Monitor,
  Database
} from "lucide-react";

interface SecurityEvent {
  id: string;
  type: 'login' | 'access' | 'data_change' | 'permission_change' | 'failed_login';
  user_id: string;
  user_email: string;
  description: string;
  ip_address: string;
  location: string;
  timestamp: string;
  risk_level: 'low' | 'medium' | 'high';
  status: 'active' | 'resolved' | 'investigating';
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  user_id: string;
  user_email: string;
  old_values?: any;
  new_values?: any;
  timestamp: string;
  ip_address: string;
}

const SecurityAuditDashboard = () => {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([
    {
      id: '1',
      type: 'failed_login',
      user_id: 'unknown',
      user_email: 'attacker@example.com',
      description: 'Multiple failed login attempts',
      ip_address: '192.168.1.100',
      location: 'Unknown',
      timestamp: new Date().toISOString(),
      risk_level: 'high',
      status: 'investigating'
    },
    {
      id: '2',
      type: 'access',
      user_id: '123',
      user_email: 'admin@company.com',
      description: 'Admin panel access',
      ip_address: '10.0.0.5',
      location: 'San Francisco, CA',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      risk_level: 'low',
      status: 'active'
    }
  ]);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: '1',
      action: 'UPDATE',
      resource: 'user_permissions',
      user_id: '123',
      user_email: 'admin@company.com',
      old_values: { role: 'user' },
      new_values: { role: 'admin' },
      timestamp: new Date().toISOString(),
      ip_address: '10.0.0.5'
    }
  ]);

  const [securityMetrics, setSecurityMetrics] = useState({
    total_events: 156,
    high_risk_events: 3,
    active_sessions: 47,
    failed_logins_24h: 12,
    data_access_requests: 234,
    permission_changes: 5
  });

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low':
        return <Badge className="bg-accent/10 text-accent">Low</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>;
      case 'high':
        return <Badge className="bg-destructive/10 text-destructive">High</Badge>;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-accent" />;
      case 'investigating':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'login':
        return <User className="h-4 w-4 text-blue-600" />;
      case 'access':
        return <Eye className="h-4 w-4 text-accent" />;
      case 'data_change':
        return <Database className="h-4 w-4 text-purple-600" />;
      case 'permission_change':
        return <Shield className="h-4 w-4 text-warning" />;
      case 'failed_login':
        return <Lock className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics.total_events}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{securityMetrics.high_risk_events}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Globe className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics.active_sessions}</div>
            <p className="text-xs text-muted-foreground">Currently logged in</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <Lock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics.failed_logins_24h}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Access</CardTitle>
            <Database className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics.data_access_requests}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Permission Changes</CardTitle>
            <Shield className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityMetrics.permission_changes}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="events">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Security Events
          </TabsTrigger>
          <TabsTrigger value="audit">
            <FileText className="h-4 w-4 mr-2" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <Monitor className="h-4 w-4 mr-2" />
            Real-time Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Events</CardTitle>
              <CardDescription>
                Monitor security events and potential threats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {securityEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getEventTypeIcon(event.type)}
                          <span className="capitalize">{event.type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{event.user_email}</div>
                          <div className="text-xs text-muted-foreground">{event.ip_address}</div>
                        </div>
                      </TableCell>
                      <TableCell>{event.description}</TableCell>
                      <TableCell>{event.location}</TableCell>
                      <TableCell>{getRiskBadge(event.risk_level)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(event.status)}
                          <span className="capitalize">{event.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(event.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          Investigate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Complete log of all system changes and data access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell>{log.resource}</TableCell>
                      <TableCell>{log.user_email}</TableCell>
                      <TableCell>
                        {log.old_values && log.new_values && (
                          <div className="text-xs">
                            <div className="text-destructive">- {JSON.stringify(log.old_values)}</div>
                            <div className="text-accent">+ {JSON.stringify(log.new_values)}</div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(log.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{log.ip_address}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Real-time Security Monitoring</CardTitle>
              <CardDescription>
                Live monitoring of security metrics and threat detection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Real-time Monitoring Coming Soon</h3>
                <p className="text-muted-foreground">
                  Live security monitoring with threat detection and automated responses.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityAuditDashboard;