import { useState } from "react";
import { useForm } from "react-hook-form";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ListingFormData } from "../types";
import BookOfRecordUpload from "./BookOfRecordUpload";

interface CreateListingFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

const CreateListingForm = ({ onSuccess, onBack }: CreateListingFormProps) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ListingFormData>({
    defaultValues: {
      visibility: 'public',
      bor_visibility: 'public'
    }
  });

  const handleDocumentsChange = (documents: string[], visibility: 'public' | 'premium' | 'on_request') => {
    setValue('bor_documents', documents);
    setValue('bor_visibility', visibility);
  };

  const industries = [
    "Technology", "Healthcare", "Financial Services", "Manufacturing",
    "Retail", "Real Estate", "Professional Services", "Food & Beverage",
    "Education", "Transportation", "Energy", "Media & Entertainment"
  ];

  const onSubmit = async (data: ListingFormData) => {
    setIsSubmitting(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to create a listing",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('business_listings')
        .insert({
          user_id: user.id,
          ...data,
          status: 'draft' // Start as draft, user can publish later
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your business listing has been created as a draft"
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error creating listing:', error);
      toast({
        title: "Error",
        description: "Failed to create listing. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step}
              </div>
              {step < 4 && <div className={`w-12 h-1 ${step < currentStep ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>
        <div className="text-sm text-muted-foreground">
          Step {currentStep} of 4
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_name">Business Name *</Label>
                <Input
                  id="business_name"
                  {...register("business_name", { required: "Business name is required" })}
                  placeholder="Enter business name"
                />
                {errors.business_name && (
                  <p className="text-sm text-destructive">{errors.business_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Select onValueChange={(value) => setValue("industry", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  {...register("location", { required: "Location is required" })}
                  placeholder="City, State, Country"
                />
                {errors.location && (
                  <p className="text-sm text-destructive">{errors.location.message}</p>
                )}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Business Description *</Label>
                <Textarea
                  id="description"
                  {...register("description", { required: "Description is required" })}
                  placeholder="Describe your business, what it does, and key highlights..."
                  rows={4}
                />
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Financial Information */}
      {currentStep === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="revenue">Annual Revenue (TTM) *</Label>
                <Input
                  id="revenue"
                  type="number"
                  {...register("revenue", { required: "Revenue is required", valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.revenue && (
                  <p className="text-sm text-destructive">{errors.revenue.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ebitda">EBITDA *</Label>
                <Input
                  id="ebitda"
                  type="number"
                  {...register("ebitda", { required: "EBITDA is required", valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.ebitda && (
                  <p className="text-sm text-destructive">{errors.ebitda.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cash_flow">Operating Cash Flow</Label>
                <Input
                  id="cash_flow"
                  type="number"
                  {...register("cash_flow", { valueAsNumber: true })}
                  placeholder="0 (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="asking_price">Asking Price *</Label>
                <Input
                  id="asking_price"
                  type="number"
                  {...register("asking_price", { required: "Asking price is required", valueAsNumber: true })}
                  placeholder="0"
                />
                {errors.asking_price && (
                  <p className="text-sm text-destructive">{errors.asking_price.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Additional Details */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Additional Business Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key_value_drivers">Key Value Drivers</Label>
                <Textarea
                  id="key_value_drivers"
                  {...register("key_value_drivers")}
                  placeholder="What makes this business valuable? (e.g., recurring revenue, strong brand, proprietary technology)"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="growth_potential">Growth Potential</Label>
                <Textarea
                  id="growth_potential"
                  {...register("growth_potential")}
                  placeholder="Describe growth opportunities and potential for expansion"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="competitive_advantages">Competitive Advantages</Label>
                <Textarea
                  id="competitive_advantages"
                  {...register("competitive_advantages")}
                  placeholder="What sets this business apart from competitors?"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Listing Visibility</CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={watch("visibility")}
                onValueChange={(value: any) => setValue("visibility", value)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="public" id="public" />
                  <Label htmlFor="public">Public - Anyone can view this listing</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="verified_only" id="verified_only" />
                  <Label htmlFor="verified_only">Verified Buyers Only - Require verification to view details</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 4: Book of Record Upload */}
      {currentStep === 4 && (
        <BookOfRecordUpload
          onDocumentsChange={handleDocumentsChange}
          initialDocuments={watch('bor_documents') || []}
          initialVisibility={watch('bor_visibility') || 'public'}
        />
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-6">
        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Options
          </Button>
          
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={prevStep}>
              Previous
            </Button>
          )}
        </div>

        <div className="flex gap-3">
          {currentStep < 4 ? (
            <Button type="button" onClick={nextStep}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Listing"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
};

export default CreateListingForm;