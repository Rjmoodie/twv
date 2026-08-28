import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Home, RefreshCw, DollarSign, TrendingUp, HelpCircle, ArrowRight } from "lucide-react";

export const BRRRRExplainer = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      icon: Home,
      title: "Buy",
      color: "text-blue-500",
      description: "Purchase an undervalued property with potential for improvement",
      details: [
        "Look for distressed or undervalued properties",
        "Secure financing (hard money, private lending, or cash)",
        "Factor in purchase price, closing costs, and acquisition fees",
        "Aim for 70-80% of ARV (After Repair Value)"
      ]
    },
    {
      icon: RefreshCw,
      title: "Rehab",
      color: "text-warning",
      description: "Renovate the property to increase its value and rental income",
      details: [
        "Create a detailed renovation budget",
        "Include 10-20% contingency for unexpected costs",
        "Focus on improvements that add value",
        "Track holding costs during renovation period"
      ]
    },
    {
      icon: DollarSign,
      title: "Rent",
      color: "text-accent",
      description: "Find quality tenants and generate positive cash flow",
      details: [
        "Research market rent rates in the area",
        "Screen tenants thoroughly",
        "Factor in vacancy rates (typically 5-10%)",
        "Account for property management, taxes, insurance, and maintenance"
      ]
    },
    {
      icon: TrendingUp,
      title: "Refinance",
      color: "text-purple-500",
      description: "Pull out your invested capital to repeat the process",
      details: [
        "Get property appraised at new value (ARV)",
        "Refinance based on 70-80% LTV of appraised value",
        "Use cash-out to fund next deal",
        "Keep the property for long-term rental income"
      ]
    }
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          What is BRRRR?
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" />
            The BRRRR Strategy Explained
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Strategy Overview</CardTitle>
              <CardDescription>
                BRRRR is a real estate investment strategy that allows investors to build wealth 
                by recycling their capital to acquire multiple properties.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Key Benefits:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Scale your portfolio faster</li>
                    <li>• Recycle your capital</li>
                    <li>• Force appreciation through improvements</li>
                    <li>• Generate ongoing cash flow</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Success Metrics:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Cash-on-Cash Return: 8-15%+</li>
                    <li>• Cap Rate: 6-12%</li>
                    <li>• 1% Rule: Monthly rent ≥ 1% of purchase price</li>
                    <li>• Capital Recovery: 80-100%</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step Navigation */}
          <div className="flex justify-center gap-2 flex-wrap">
            {steps.map((step, index) => (
              <Button
                key={index}
                variant={currentStep === index ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentStep(index)}
                className="gap-2"
              >
                <step.icon className={`h-4 w-4 ${step.color}`} />
                {step.title}
              </Button>
            ))}
          </div>

          {/* Current Step Detail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  {(() => {
                    const StepIcon = steps[currentStep].icon;
                    return <StepIcon className={`h-6 w-6 ${steps[currentStep].color}`} />;
                  })()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Step {currentStep + 1}</Badge>
                    <span className={steps[currentStep].color}>{steps[currentStep].title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground font-normal">
                    {steps[currentStep].description}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {steps[currentStep].details.map((detail, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <ArrowRight className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={currentStep === 0}
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            >
              Previous Step
            </Button>
            <Button
              disabled={currentStep === steps.length - 1}
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
            >
              Next Step
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};