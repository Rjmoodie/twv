import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  TrendingUp, 
  PieChart, 
  Calculator, 
  Building, 
  Star,
  ChevronRight,
  CheckCircle 
} from "lucide-react";
import SomaTechLogo from './SomaTechLogo';

interface OnboardingWelcomeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const OnboardingWelcome = ({ open, onOpenChange, onComplete }: OnboardingWelcomeProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to SomaTech",
      description: "Your comprehensive financial intelligence platform",
      content: (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center mx-auto bg-background p-2">
            <SomaTechLogo width={80} height={80} />
          </div>
          <p className="text-muted-foreground">
            SomaTech provides professional-grade financial analysis tools to help you make informed investment decisions.
          </p>
        </div>
      )
    },
    {
      title: "Powerful Financial Tools",
      description: "Everything you need for comprehensive analysis",
      content: (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <h4 className="font-semibold">Stock Analysis</h4>
                <p className="text-sm text-muted-foreground">DCF models & valuations</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Star className="h-8 w-8 text-accent" />
              <div>
                <h4 className="font-semibold">Watchlist</h4>
                <p className="text-sm text-muted-foreground">Track your investments</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Building className="h-8 w-8 text-purple-600" />
              <div>
                <h4 className="font-semibold">Business Valuation</h4>
                <p className="text-sm text-muted-foreground">Evaluate companies</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Calculator className="h-8 w-8 text-warning" />
              <div>
                <h4 className="font-semibold">Financial Planning</h4>
                <p className="text-sm text-muted-foreground">Retirement & real estate</p>
              </div>
            </div>
          </Card>
        </div>
      )
    },
    {
      title: "Get Started",
      description: "Begin your financial analysis journey",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-accent mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">You're all set!</h3>
            <p className="text-muted-foreground">
              Start by analyzing a stock or exploring the dashboard to see market insights.
            </p>
          </div>
          <div className="flex flex-col space-y-2">
            <Button onClick={() => { onComplete(); onOpenChange(false); }} className="w-full">
              <TrendingUp className="h-4 w-4 mr-2" />
              Start with Stock Analysis
            </Button>
            <Button variant="outline" onClick={() => { onComplete(); onOpenChange(false); }} className="w-full">
              <PieChart className="h-4 w-4 mr-2" />
              Explore Dashboard
            </Button>
          </div>
        </div>
      )
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const currentStepData = steps[currentStep];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center">{currentStepData.title}</DialogTitle>
          <p className="text-center text-muted-foreground">{currentStepData.description}</p>
        </DialogHeader>
        
        <div className="py-6">
          {currentStepData.content}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-8 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <Button variant="outline" onClick={prevStep}>
                Back
              </Button>
            )}
            {currentStep < steps.length - 1 ? (
              <Button onClick={nextStep}>
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={() => { onComplete(); onOpenChange(false); }}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingWelcome;