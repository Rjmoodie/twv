import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  Clock, 
  Database, 
  Server, 
  Wifi,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Zap
} from "lucide-react";

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  status: 'good' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  icon: React.ComponentType<any>;
}

interface SystemHealth {
  overall: number;
  database: number;
  api: number;
  cdn: number;
  uptime: number;
}

const PerformanceMonitoring = () => {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([
    {
      name: 'Response Time',
      value: 247,
      unit: 'ms',
      status: 'good',
      trend: 'down',
      icon: Clock
    },
    {
      name: 'Database Queries',
      value: 1.2,
      unit: 's',
      status: 'good',
      trend: 'stable',
      icon: Database
    },
    {
      name: 'API Latency',
      value: 89,
      unit: 'ms',
      status: 'good',
      trend: 'down',
      icon: Server
    },
    {
      name: 'Network Speed',
      value: 156,
      unit: 'Mbps',
      status: 'good',
      trend: 'up',
      icon: Wifi
    }
  ]);

  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 98.7,
    database: 99.2,
    api: 98.1,
    cdn: 99.9,
    uptime: 99.95
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-accent';
      case 'warning': return 'text-yellow-600';
      case 'critical': return 'text-destructive';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4 text-accent" />;
      case 'warning': return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'critical': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const getTrendIcon = (trend: string) => {
    const className = trend === 'up' ? 'text-accent' : trend === 'down' ? 'text-destructive' : 'text-gray-600';
    return <TrendingUp className={`h-3 w-3 transform ${trend === 'down' ? 'rotate-180' : ''} ${className}`} />;
  };

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Overview
          </CardTitle>
          <CardDescription>
            Real-time monitoring of platform performance and availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{systemHealth.overall}%</div>
              <p className="text-sm text-muted-foreground">Overall Health</p>
              <Progress value={systemHealth.overall} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{systemHealth.database}%</div>
              <p className="text-sm text-muted-foreground">Database</p>
              <Progress value={systemHealth.database} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{systemHealth.api}%</div>
              <p className="text-sm text-muted-foreground">API</p>
              <Progress value={systemHealth.api} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{systemHealth.cdn}%</div>
              <p className="text-sm text-muted-foreground">CDN</p>
              <Progress value={systemHealth.cdn} className="mt-2" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{systemHealth.uptime}%</div>
              <p className="text-sm text-muted-foreground">Uptime</p>
              <Progress value={systemHealth.uptime} className="mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
                <div className="flex items-center space-x-1">
                  {getStatusIcon(metric.status)}
                  <Icon className={`h-4 w-4 ${getStatusColor(metric.status)}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">
                      {metric.value}{metric.unit}
                    </div>
                    <Badge variant={metric.status === 'good' ? 'default' : 
                      metric.status === 'warning' ? 'secondary' : 'destructive'}>
                      {metric.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                    {getTrendIcon(metric.trend)}
                    <span className="capitalize">{metric.trend}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
            <CardDescription>Average response time over the last 24 hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center border border-dashed border-muted rounded">
              <div className="text-center">
                <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Performance charts integration coming soon
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>4xx and 5xx errors over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center border border-dashed border-muted rounded">
              <div className="text-center">
                <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Error tracking charts coming soon
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Performance Alerts</CardTitle>
          <CardDescription>Latest system alerts and notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <CheckCircle className="h-5 w-5 text-accent" />
              <div className="flex-1">
                <p className="text-sm font-medium">System Performance Optimal</p>
                <p className="text-xs text-muted-foreground">All systems operating within normal parameters</p>
              </div>
              <span className="text-xs text-muted-foreground">2 min ago</span>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">Database Query Optimization</p>
                <p className="text-xs text-muted-foreground">Some queries taking longer than usual - auto-optimization applied</p>
              </div>
              <span className="text-xs text-muted-foreground">15 min ago</span>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">CDN Cache Refreshed</p>
                <p className="text-xs text-muted-foreground">Content delivery network cache successfully updated</p>
              </div>
              <span className="text-xs text-muted-foreground">1 hour ago</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceMonitoring;