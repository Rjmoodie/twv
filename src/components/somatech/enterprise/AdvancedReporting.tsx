import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Download, 
  FileText, 
  BarChart3, 
  PieChart,
  Calendar,
  Filter,
  Mail,
  Printer,
  Share,
  TrendingUp,
  Users,
  DollarSign
} from "lucide-react";
import { useSubscriptionGating } from "@/hooks/useSubscriptionGating";

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  premium: boolean;
  icon: React.ComponentType<any>;
}

interface AdvancedReportingProps {
  onUpgrade?: () => void;
}

const AdvancedReporting = ({ onUpgrade }: AdvancedReportingProps) => {
  const { canAccessFeature, hasFeature } = useSubscriptionGating();
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  const hasAdvancedReporting = hasFeature('advanced_analytics') && canAccessFeature('professional');

  const reportTemplates: ReportTemplate[] = [
    {
      id: 'usage-summary',
      name: 'Usage Summary',
      description: 'Comprehensive overview of platform usage and activity',
      category: 'usage',
      premium: false,
      icon: BarChart3
    },
    {
      id: 'financial-analysis',
      name: 'Financial Analysis',
      description: 'Detailed financial calculations and projections report',
      category: 'financial',
      premium: true,
      icon: DollarSign
    },
    {
      id: 'user-engagement',
      name: 'User Engagement',
      description: 'User behavior analysis and engagement metrics',
      category: 'analytics',
      premium: true,
      icon: Users
    },
    {
      id: 'performance-metrics',
      name: 'Performance Metrics',
      description: 'System performance and uptime analysis',
      category: 'technical',
      premium: true,
      icon: TrendingUp
    },
    {
      id: 'custom-dashboard',
      name: 'Custom Dashboard',
      description: 'Build your own custom report with selected metrics',
      category: 'custom',
      premium: true,
      icon: PieChart
    }
  ];

  const generateReport = async (templateId: string, format: 'pdf' | 'excel' | 'csv') => {
    if (!hasAdvancedReporting) {
      return;
    }

    // Mock report generation
    console.log(`Generating ${format} report for template: ${templateId}`);
    
    // In a real implementation, this would call an API
    const blob = new Blob(['Mock report data'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${templateId}-${Date.now()}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const scheduleReport = async (templateId: string, frequency: 'daily' | 'weekly' | 'monthly') => {
    if (!hasAdvancedReporting) {
      return;
    }

    console.log(`Scheduling ${frequency} report for template: ${templateId}`);
    // Implementation would save schedule to backend
  };

  if (!hasAdvancedReporting) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader className="text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle>Advanced Reporting & Export</CardTitle>
          <CardDescription>
            Generate comprehensive reports with advanced analytics and automated scheduling.
          </CardDescription>
          <Badge variant="outline" className="mx-auto">Professional Feature</Badge>
        </CardHeader>
        <CardContent className="text-center">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="space-y-2">
                <h4 className="font-medium">Report Templates</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Financial analysis reports</li>
                  <li>• User engagement metrics</li>
                  <li>• Performance analytics</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Export Formats</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• PDF reports</li>
                  <li>• Excel spreadsheets</li>
                  <li>• CSV data exports</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Automation</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Scheduled reports</li>
                  <li>• Email delivery</li>
                  <li>• Custom dashboards</li>
                </ul>
              </div>
            </div>
            <Button onClick={onUpgrade} size="lg">
              Upgrade to Professional
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Advanced Reporting</h2>
          <p className="text-muted-foreground">Generate and export comprehensive reports</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Report
          </Button>
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            Report Templates
          </TabsTrigger>
          <TabsTrigger value="custom">
            <PieChart className="h-4 w-4 mr-2" />
            Custom Reports
          </TabsTrigger>
          <TabsTrigger value="scheduled">
            <Calendar className="h-4 w-4 mr-2" />
            Scheduled Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTemplates.map((template) => {
              const Icon = template.icon;
              return (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedTemplate === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Icon className="h-8 w-8 text-primary" />
                      {template.premium && (
                        <Badge variant="secondary">Premium</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateReport(template.id, 'pdf');
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        PDF
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateReport(template.id, 'excel');
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Excel
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateReport(template.id, 'csv');
                        }}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        CSV
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {selectedTemplate && (
            <Card>
              <CardHeader>
                <CardTitle>Report Configuration</CardTitle>
                <CardDescription>
                  Configure your report settings and parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dateFrom">From Date</Label>
                    <Input
                      id="dateFrom"
                      type="date"
                      defaultValue="2024-01-01"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateTo">To Date</Label>
                    <Input
                      id="dateTo"
                      type="date"
                      defaultValue={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex space-x-2">
                    <Button variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Email Report
                    </Button>
                    <Button variant="outline">
                      <Share className="h-4 w-4 mr-2" />
                      Share Link
                    </Button>
                    <Button variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                  </div>
                  <Button 
                    onClick={() => generateReport(selectedTemplate, 'pdf')}
                  >
                    Generate Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="custom" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Report Builder</CardTitle>
              <CardDescription>
                Build custom reports with your selected metrics and visualizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Custom Report Builder Coming Soon</h3>
                <p className="text-muted-foreground">
                  Drag-and-drop report builder with custom metrics and visualizations.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Reports</CardTitle>
              <CardDescription>
                Manage your automated report schedules and delivery preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Report Scheduling Coming Soon</h3>
                <p className="text-muted-foreground">
                  Automated report generation and email delivery on your schedule.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdvancedReporting;