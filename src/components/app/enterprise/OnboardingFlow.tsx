import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  X,
  Calculator,
  BarChart3,
  Building2,
  PiggyBank,
  TrendingUp,
  Users,
  Zap,
  Star
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  content: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const OnboardingFlow = ({ open, onOpenChange, onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to TW Ventures',
      description: 'Your comprehensive financial analysis platform',
      icon: Star,
      content: (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Professional Financial Tools</h3>
            <p className="text-muted-foreground">
              TW Ventures provides enterprise-grade financial analysis tools including DCF modeling,
              cash flow analysis, retirement planning, real estate calculators, and more.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">15+</div>
              <div className="text-sm text-muted-foreground">Financial Tools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">50k+</div>
              <div className="text-sm text-muted-foreground">Calculations</div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: 'Dashboard Overview',
      description: 'Your command center for financial insights',
      icon: BarChart3,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg">
              <TrendingUp className="h-5 w-5 text-accent mb-2" />
              <div className="text-sm font-medium">Market Data</div>
              <div className="text-xs text-muted-foreground">Real-time market insights</div>
            </div>
            <div className="p-3 border rounded-lg">
              <Calculator className="h-5 w-5 text-blue-500 mb-2" />
              <div className="text-sm font-medium">Quick Tools</div>
              <div className="text-xs text-muted-foreground">Access your calculations</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            The dashboard provides an overview of your saved projects, recent calculations, 
            and market insights to help you make informed financial decisions.
          </p>
        </div>
      ),
      action: {
        label: 'Try Dashboard',
        onClick: () => {
          setCompletedSteps(prev => new Set([...prev, currentStep]));
          toast({ title: "Dashboard explored!", description: "You can always return to the dashboard from the sidebar." });
        }
      }
    },
    {
      id: 'tools',
      title: 'Financial Tools',
      description: 'Explore our comprehensive toolkit',
      icon: Calculator,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {[
              { icon: BarChart3, name: 'DCF Analysis', desc: 'Value companies with discounted cash flow' },
              { icon: PiggyBank, name: 'Retirement Planning', desc: 'Plan your financial future' },
              { icon: Building2, name: 'Real Estate', desc: 'Analyze property investments' },
              { icon: TrendingUp, name: 'Cash Flow', desc: 'Model business cash flows' }
            ].map((tool, index) => (
              <div key={index} className="flex items-center gap-3 p-2 border rounded-lg">
                <tool.icon className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">{tool.name}</div>
                  <div className="text-xs text-muted-foreground">{tool.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Each tool is designed for professional analysis with exportable reports and saving capabilities.
          </p>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Premium Features',
      description: 'Unlock advanced capabilities',
      icon: Zap,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {[
              { feature: 'Advanced Analytics', desc: 'Deep insights and comparisons', premium: true },
              { feature: 'Unlimited Saves', desc: 'Store unlimited projects', premium: true },
              { feature: 'Priority Support', desc: '24/7 premium support', premium: true },
              { feature: 'Basic Tools', desc: 'Core financial calculators', premium: false }
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-accent" />
                  <div>
                    <div className="text-sm font-medium">{item.feature}</div>
                    <div className="text-xs text-muted-foreground">{item.desc}</div>
                  </div>
                </div>
                {item.premium && (
                  <Badge variant="outline" className="text-xs">Pro</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      ),
      action: {
        label: 'View Pricing',
        onClick: () => {
          setCompletedSteps(prev => new Set([...prev, currentStep]));
          toast({ title: "Pricing viewed!", description: "You can upgrade anytime from your profile." });
        }
      }
    },
    {
      id: 'complete',
      title: 'You\'re All Set!',
      description: 'Start building your financial models',
      icon: Check,
      content: (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Ready to Analyze</h3>
            <p className="text-muted-foreground">
              You now have access to all TW Ventures tools. Start with any financial analysis tool
              from the sidebar or explore the dashboard for market insights.
            </p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">💡 Pro Tip</p>
            <p className="text-xs text-muted-foreground">
              Save your analyses to track progress over time and export professional reports for presentations.
            </p>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    onComplete();
    onOpenChange(false);
    toast({
      title: "Welcome to TW Ventures!",
      description: "You've completed the onboarding. Start exploring your financial tools.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <currentStepData.icon className="h-5 w-5" />
                {currentStepData.title}
              </DialogTitle>
              <DialogDescription>{currentStepData.description}</DialogDescription>
            </div>
            <Badge variant="outline">
              {currentStep + 1} of {steps.length}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Step Content */}
          <Card>
            <CardContent className="p-6">
              {currentStepData.content}
            </CardContent>
          </Card>

          {/* Action Button */}
          {currentStepData.action && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={currentStepData.action.onClick}
                className="animate-pulse"
              >
                {currentStepData.action.label}
              </Button>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Skip
              </Button>
              
              {currentStep === steps.length - 1 ? (
                <Button onClick={handleComplete}>
                  Get Started
                  <Zap className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Next
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingFlow;
