import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building, 
  Users, 
  Settings, 
  UserPlus,
  Shield,
  Crown,
  Mail,
  Calendar,
  MoreVertical
} from "lucide-react";
import { useSubscriptionGating } from "@/hooks/useSubscriptionGating";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Organization {
  id: string;
  name: string;
  domain: string;
  plan: 'enterprise' | 'professional' | 'free';
  users_count: number;
  created_at: string;
  admin_email: string;
  settings: {
    sso_enabled: boolean;
    domain_verification: boolean;
    custom_branding: boolean;
  };
}

interface Workspace {
  id: string;
  name: string;
  organization_id: string;
  description: string;
  members_count: number;
  created_at: string;
  privacy: 'private' | 'public' | 'invite_only';
}

interface MultiTenantArchitectureProps {
  onUpgrade?: () => void;
}

const MultiTenantArchitecture = ({ onUpgrade }: MultiTenantArchitectureProps) => {
  const { canAccessFeature, hasFeature } = useSubscriptionGating();
  const [organizations, setOrganizations] = useState<Organization[]>([
    {
      id: '1',
      name: 'Acme Corporation',
      domain: 'acme.com',
      plan: 'enterprise',
      users_count: 47,
      created_at: '2024-01-15',
      admin_email: 'admin@acme.com',
      settings: {
        sso_enabled: true,
        domain_verification: true,
        custom_branding: true
      }
    },
    {
      id: '2',
      name: 'TechStart Inc',
      domain: 'techstart.io',
      plan: 'professional',
      users_count: 12,
      created_at: '2024-02-01',
      admin_email: 'ceo@techstart.io',
      settings: {
        sso_enabled: false,
        domain_verification: true,
        custom_branding: false
      }
    }
  ]);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: '1',
      name: 'Finance Team',
      organization_id: '1',
      description: 'Financial analysis and reporting workspace',
      members_count: 8,
      created_at: '2024-01-20',
      privacy: 'private'
    },
    {
      id: '2',
      name: 'Product Development',
      organization_id: '1',
      description: 'Product strategy and development planning',
      members_count: 15,
      created_at: '2024-01-25',
      privacy: 'invite_only'
    }
  ]);

  const hasMultiTenant = hasFeature('white_label') && canAccessFeature('enterprise');

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return <Badge className="bg-purple-100 text-purple-800">Enterprise</Badge>;
      case 'professional':
        return <Badge className="bg-blue-100 text-blue-800">Professional</Badge>;
      case 'free':
        return <Badge className="bg-gray-100 text-gray-800">Free</Badge>;
      default:
        return null;
    }
  };

  const getPrivacyBadge = (privacy: string) => {
    switch (privacy) {
      case 'private':
        return <Badge variant="secondary">Private</Badge>;
      case 'public':
        return <Badge className="bg-accent/10 text-accent">Public</Badge>;
      case 'invite_only':
        return <Badge className="bg-blue-100 text-blue-800">Invite Only</Badge>;
      default:
        return null;
    }
  };

  if (!hasMultiTenant) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader className="text-center">
          <Building className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle>Multi-Tenant Architecture</CardTitle>
          <CardDescription>
            Manage organizations, workspaces, and team collaboration with advanced access controls.
          </CardDescription>
          <Badge variant="outline" className="mx-auto">Enterprise Feature</Badge>
        </CardHeader>
        <CardContent className="text-center">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="space-y-2">
                <h4 className="font-medium">Organizations</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Domain verification</li>
                  <li>• SSO integration</li>
                  <li>• Custom branding</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Workspaces</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Team collaboration</li>
                  <li>• Access controls</li>
                  <li>• Project isolation</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Enterprise Features</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Role-based permissions</li>
                  <li>• Audit trails</li>
                  <li>• Advanced security</li>
                </ul>
              </div>
            </div>
            <Button onClick={onUpgrade} size="lg">
              Upgrade to Enterprise
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
          <h2 className="text-2xl font-bold">Multi-Tenant Management</h2>
          <p className="text-muted-foreground">Manage organizations and workspaces</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Building className="h-4 w-4 mr-2" />
            New Organization
          </Button>
          <Button>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Users
          </Button>
        </div>
      </div>

      <Tabs defaultValue="organizations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="organizations">
            <Building className="h-4 w-4 mr-2" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="workspaces">
            <Users className="h-4 w-4 mr-2" />
            Workspaces
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Global Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <Card key={org.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                        <Building className="h-5 w-5 text-primary-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{org.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{org.domain}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem>Edit Organization</DropdownMenuItem>
                        <DropdownMenuItem>View Users</DropdownMenuItem>
                        <DropdownMenuItem>Settings</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          Delete Organization
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    {getPlanBadge(org.plan)}
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{org.users_count} users</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>SSO Enabled</span>
                      {org.settings.sso_enabled ? (
                        <Shield className="h-4 w-4 text-accent" />
                      ) : (
                        <Shield className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Domain Verified</span>
                      {org.settings.domain_verification ? (
                        <Shield className="h-4 w-4 text-accent" />
                      ) : (
                        <Shield className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Custom Branding</span>
                      {org.settings.custom_branding ? (
                        <Crown className="h-4 w-4 text-purple-600" />
                      ) : (
                        <Crown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Created: {new Date(org.created_at).toLocaleDateString()}</span>
                    <div className="flex items-center space-x-1">
                      <Mail className="h-3 w-3" />
                      <span>{org.admin_email}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="workspaces" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((workspace) => (
              <Card key={workspace.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{workspace.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {organizations.find(o => o.id === workspace.organization_id)?.name}
                        </p>
                      </div>
                    </div>
                    {getPrivacyBadge(workspace.privacy)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{workspace.description}</p>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{workspace.members_count} members</span>
                    </div>
                    <div className="flex items-center space-x-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(workspace.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Tenant Settings</CardTitle>
              <CardDescription>
                Configure global settings that apply across all organizations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Authentication</h3>
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Input
                      id="session-timeout"
                      type="number"
                      defaultValue="60"
                      min="15"
                      max="480"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-policy">Password Policy</Label>
                    <select className="w-full p-2 border border-muted rounded-md">
                      <option value="standard">Standard</option>
                      <option value="strong">Strong</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Data & Privacy</h3>
                  <div className="space-y-2">
                    <Label htmlFor="data-retention">Data Retention (days)</Label>
                    <Input
                      id="data-retention"
                      type="number"
                      defaultValue="365"
                      min="30"
                      max="2555"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="backup-frequency">Backup Frequency</Label>
                    <select className="w-full p-2 border border-muted rounded-md">
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline">Reset to Defaults</Button>
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MultiTenantArchitecture;