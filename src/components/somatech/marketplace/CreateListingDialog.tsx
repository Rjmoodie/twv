import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, FileText, BarChart } from "lucide-react";
import CreateListingForm from "./CreateListingForm";

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CreateListingDialog = ({ open, onOpenChange }: CreateListingDialogProps) => {
  const [currentStep, setCurrentStep] = useState<'options' | 'form'>('options');

  const handleReset = () => {
    setCurrentStep('options');
  };

  const handleOptionSelect = (option: string) => {
    if (option === 'manual') {
      setCurrentStep('form');
    } else {
      // Future: integrate with DCF/Valuation tools
      setCurrentStep('form');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentStep === 'options' ? 'List Your Business' : 'Business Information'}
          </DialogTitle>
        </DialogHeader>

        {currentStep === 'options' ? (
          <div className="space-y-6">
            <p className="text-muted-foreground">
              Choose how you'd like to create your business listing:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Import from DCF */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleOptionSelect('dcf')}>
                <CardHeader className="text-center">
                  <BarChart className="h-12 w-12 mx-auto text-primary" />
                  <CardTitle className="text-lg">Import from DCF</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center">
                    Use your existing DCF analysis to pre-fill financial data and valuation
                  </p>
                  <Button variant="outline" className="w-full mt-4" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              {/* Import from Valuation */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleOptionSelect('valuation')}>
                <CardHeader className="text-center">
                  <Calculator className="h-12 w-12 mx-auto text-primary" />
                  <CardTitle className="text-lg">Import from Valuation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center">
                    Use your business valuation results to create a comprehensive listing
                  </p>
                  <Button variant="outline" className="w-full mt-4" disabled>
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>

              {/* Manual Entry */}
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleOptionSelect('manual')}>
                <CardHeader className="text-center">
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                  <CardTitle className="text-lg">Manual Entry</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center">
                    Enter your business information manually with guided form fields
                  </p>
                  <Button className="w-full mt-4">
                    Start Manual Entry
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <CreateListingForm onSuccess={() => onOpenChange(false)} onBack={handleReset} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CreateListingDialog;