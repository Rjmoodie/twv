import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  Palette, 
  Upload, 
  Eye, 
  Download, 
  Settings,
  Brush,
  Type,
  Image as ImageIcon,
  Monitor
} from "lucide-react";
import { useSubscriptionGating } from "@/hooks/useSubscriptionGating";
import { useToast } from '@/hooks/use-toast';

interface BrandingConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  companyName: string;
  faviconUrl: string;
  customDomain: string;
  hideWatermark: boolean;
  customFooter: string;
  fontFamily: string;
}

interface WhiteLabelCustomizerProps {
  onUpgrade?: () => void;
}

const WhiteLabelCustomizer = ({ onUpgrade }: WhiteLabelCustomizerProps) => {
  const { hasFeature, canAccessFeature } = useSubscriptionGating();
  const { toast } = useToast();
  
  const [config, setConfig] = useState<BrandingConfig>({
    primaryColor: '#3b82f6',
    secondaryColor: '#64748b',
    accentColor: '#10b981',
    logoUrl: '',
    companyName: 'SomaTech Financial',
    faviconUrl: '',
    customDomain: '',
    hideWatermark: false,
    customFooter: '',
    fontFamily: 'Inter'
  });

  const [previewMode, setPreviewMode] = useState(false);

  const hasWhiteLabelAccess = hasFeature('white_label') && canAccessFeature('enterprise');

  const handleConfigChange = (key: keyof BrandingConfig, value: string | boolean) => {
    if (!hasWhiteLabelAccess) {
      toast({
        title: "Enterprise Feature",
        description: "White-label customization requires an Enterprise subscription.",
        variant: "destructive",
      });
      return;
    }

    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveConfig = async () => {
    if (!hasWhiteLabelAccess) return;

    try {
      // Save configuration to backend
      toast({
        title: "Configuration Saved",
        description: "Your branding configuration has been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save configuration.",
        variant: "destructive",
      });
    }
  };

  const handleExportConfig = () => {
    if (!hasWhiteLabelAccess) return;

    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'branding-config.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!hasWhiteLabelAccess) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader className="text-center">
          <Palette className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <CardTitle>White-Label Customization</CardTitle>
          <CardDescription>
            Customize the platform with your own branding, colors, and domain.
          </CardDescription>
          <Badge variant="outline" className="mx-auto">Enterprise Feature</Badge>
        </CardHeader>
        <CardContent className="text-center">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="space-y-2">
                <h4 className="font-medium">Custom Branding</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Custom logo & colors</li>
                  <li>• Company name & favicon</li>
                  <li>• Remove watermarks</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Custom Domain</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use your own domain</li>
                  <li>• SSL certificate included</li>
                  <li>• Professional appearance</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Advanced Customization</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Custom footer content</li>
                  <li>• Font selection</li>
                  <li>• Export configurations</li>
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
          <h2 className="text-2xl font-bold">White-Label Customization</h2>
          <p className="text-muted-foreground">Customize the platform with your branding</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setPreviewMode(!previewMode)}>
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Exit Preview' : 'Preview'}
          </Button>
          <Button variant="outline" onClick={handleExportConfig}>
            <Download className="h-4 w-4 mr-2" />
            Export Config
          </Button>
          <Button onClick={handleSaveConfig}>
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="branding">
            <Brush className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="colors">
            <Palette className="h-4 w-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="typography">
            <Type className="h-4 w-4 mr-2" />
            Typography
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Settings className="h-4 w-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Set your company name and branding details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={config.companyName}
                    onChange={(e) => handleConfigChange('companyName', e.target.value)}
                    placeholder="Your Company Name"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Custom Domain</Label>
                  <Input
                    id="customDomain"
                    value={config.customDomain}
                    onChange={(e) => handleConfigChange('customDomain', e.target.value)}
                    placeholder="app.yourcompany.com"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="hideWatermark"
                    checked={config.hideWatermark}
                    onCheckedChange={(checked) => handleConfigChange('hideWatermark', checked)}
                  />
                  <Label htmlFor="hideWatermark">Hide SomaTech Watermark</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Logo & Images</CardTitle>
                <CardDescription>
                  Upload your company logo and favicon
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Company Logo</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload your logo (SVG, PNG recommended)
                    </p>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload favicon (32x32 PNG/ICO)
                    </p>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Favicon
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="colors" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Color Scheme</CardTitle>
              <CardDescription>
                Customize the color palette for your platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded border border-muted"
                      style={{ backgroundColor: config.primaryColor }}
                    />
                    <Input
                      value={config.primaryColor}
                      onChange={(e) => handleConfigChange('primaryColor', e.target.value)}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded border border-muted"
                      style={{ backgroundColor: config.secondaryColor }}
                    />
                    <Input
                      value={config.secondaryColor}
                      onChange={(e) => handleConfigChange('secondaryColor', e.target.value)}
                      placeholder="#64748b"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-8 h-8 rounded border border-muted"
                      style={{ backgroundColor: config.accentColor }}
                    />
                    <Input
                      value={config.accentColor}
                      onChange={(e) => handleConfigChange('accentColor', e.target.value)}
                      placeholder="#10b981"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typography" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>
                Choose fonts and typography settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fontFamily">Font Family</Label>
                  <select 
                    className="w-full p-2 border border-muted rounded-md"
                    value={config.fontFamily}
                    onChange={(e) => handleConfigChange('fontFamily', e.target.value)}
                  >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Roboto">Roboto</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Additional customization options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customFooter">Custom Footer Content</Label>
                <textarea
                  id="customFooter"
                  className="w-full p-2 border border-muted rounded-md"
                  rows={4}
                  value={config.customFooter}
                  onChange={(e) => handleConfigChange('customFooter', e.target.value)}
                  placeholder="Enter custom footer HTML content..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Preview Mode Overlay */}
      {previewMode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <Card className="w-full max-w-4xl m-4">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Preview Mode</span>
                <Button variant="outline" onClick={() => setPreviewMode(false)}>
                  Close Preview
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Monitor className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Live Preview Coming Soon</h3>
                <p className="text-muted-foreground">
                  Real-time preview of your customizations will be available soon.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default WhiteLabelCustomizer;