import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  Calculator,
  Gauge,
  Landmark,
  ChevronRight,
  CheckCircle 
} from "lucide-react";
import Logo from './Logo';

interface OnboardingWelcomeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const OnboardingWelcome = ({ open, onOpenChange, onComplete }: OnboardingWelcomeProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  const completeAt = (moduleId: 'dashboard' | 'real-estate') => {
    onComplete();
    onOpenChange(false);
    navigate(`/?module=${moduleId}`);
  };

  const steps = [
    {
      title: "Welcome to TW Ventures",
      description: "Real estate operations, from acquisition through stabilization",
      content: (
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center mx-auto bg-background p-2">
            <Logo width={80} height={80} />
          </div>
          <p className="text-muted-foreground">
            Underwrite properties, compare deal structures, and carry decisions forward into the project lifecycle.
          </p>
        </div>
      )
    },
    {
      title: "Start with underwriting",
      description: "The current workspace focuses on evaluating real estate opportunities",
      content: (
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Calculator className="h-8 w-8 text-blue-600" />
              <div>
                <h4 className="font-semibold">BRRRR analysis</h4>
                <p className="text-sm text-muted-foreground">Model acquisition through refinance</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Landmark className="h-8 w-8 text-accent" />
              <div>
                <h4 className="font-semibold">Rental analysis</h4>
                <p className="text-sm text-muted-foreground">Evaluate buy-and-hold cash flow</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Building2 className="h-8 w-8 text-purple-600" />
              <div>
                <h4 className="font-semibold">Deal comparison</h4>
                <p className="text-sm text-muted-foreground">Compare saved opportunities</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center space-x-3">
              <Gauge className="h-8 w-8 text-warning" />
              <div>
                <h4 className="font-semibold">Rates context</h4>
                <p className="text-sm text-muted-foreground">Ground assumptions in current rates</p>
              </div>
            </div>
          </Card>
        </div>
      )
    },
    {
      title: "Get Started",
      description: "Open the workspace and evaluate a deal",
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-accent mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">You're all set!</h3>
            <p className="text-muted-foreground">
              Start a real estate analysis or review the rate environment from the dashboard.
            </p>
          </div>
          <div className="flex flex-col space-y-2">
            <Button onClick={() => completeAt('real-estate')} className="w-full">
              <Building2 className="h-4 w-4 mr-2" />
              Start a Real Estate Analysis
            </Button>
            <Button variant="outline" onClick={() => completeAt('dashboard')} className="w-full">
              <Gauge className="h-4 w-4 mr-2" />
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
