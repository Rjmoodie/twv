import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const DonationSuccess = () => {
  const [searchParams] = useSearchParams();
  const [confirming, setConfirming] = useState(true);
  const [donation, setDonation] = useState<any>(null);
  
  const sessionId = searchParams.get('session_id');
  const campaignId = searchParams.get('campaign');

  useEffect(() => {
    const confirmDonation = async () => {
      if (!sessionId) {
        setConfirming(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('confirm-donation', {
          body: { session_id: sessionId }
        });

        if (error) throw error;

        if (data.success) {
          setDonation(data.donation);
          toast({
            title: "Donation confirmed!",
            description: "Thank you for your generous contribution.",
          });
        } else {
          throw new Error(data.error || "Payment confirmation failed");
        }
      } catch (error) {
        console.error('Error confirming donation:', error);
        toast({
          title: "Error",
          description: "Failed to confirm donation. Please contact support.",
          variant: "destructive",
        });
      } finally {
        setConfirming(false);
      }
    };

    confirmDonation();
  }, [sessionId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (confirming) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Confirming your donation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-accent" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <Heart className="h-5 w-5 text-destructive" />
            Donation Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {donation && (
            <>
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(donation.amount)}
              </div>
              <p className="text-muted-foreground">
                Thank you, {donation.donor_name}! Your contribution makes a difference.
              </p>
              {donation.message && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm italic">"{donation.message}"</p>
                </div>
              )}
            </>
          )}
          
          <div className="pt-4">
            <Button 
              onClick={() => window.location.href = `/somatech${campaignId ? `?campaign=${campaignId}` : ''}`}
              className="w-full"
            >
              Return to Campaign
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DonationSuccess;