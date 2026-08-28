"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface DiscordLink {
  discord_user_id: string;
  created_at: string;
}

export default function DiscordLinkPage() {
  const supabase = createClientComponentClient();
  const [url, setUrl] = useState("");
  const [discordLink, setDiscordLink] = useState<DiscordLink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiscordLink();
    generateOAuthUrl();
  }, []);

  const loadDiscordLink = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: link } = await supabase
          .from("discord_links")
          .select("*")
          .eq("user_id", user.id)
          .single();
        
        setDiscordLink(link);
      }
    } catch (error) {
      console.error("Error loading Discord link:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateOAuthUrl = () => {
    const u = new URL("https://discord.com/api/oauth2/authorize");
    u.searchParams.set("client_id", process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID!);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "identify");
    u.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI!);
    setUrl(u.toString());
  };

  const handleDisconnect = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        await supabase
          .from("discord_links")
          .delete()
          .eq("user_id", user.id);
        
        setDiscordLink(null);
        toast.success("Discord account disconnected");
      }
    } catch (error) {
      toast.error("Failed to disconnect Discord account");
      console.error("Disconnect error:", error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Discord Integration</h1>
        <p className="text-muted-foreground">
          Connect your Discord account to get exclusive role access and community features
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Discord Account Status
          </CardTitle>
          <CardDescription>
            Link your Discord account to access exclusive community features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {discordLink ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Discord Account Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Connected on {new Date(discordLink.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Connected</Badge>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Benefits of Discord Integration:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Access to exclusive Discord channels</li>
                  <li>• Automatic role assignment based on subscription tier</li>
                  <li>• Priority support in Discord</li>
                  <li>• Community events and announcements</li>
                </ul>
              </div>

              <Button 
                variant="outline" 
                onClick={handleDisconnect}
                className="w-full"
              >
                Disconnect Discord Account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center p-6 border-2 border-dashed rounded-lg">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  No Discord account connected
                </p>
                <Button asChild className="w-full">
                  <a href={url} className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    <span>Connect with Discord</span>
                  </a>
                </Button>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">What happens when you connect:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Your Discord account will be linked to your SomaTech profile</li>
                  <li>• You'll automatically receive roles based on your subscription</li>
                  <li>• Access to exclusive Discord channels and features</li>
                  <li>• Seamless integration between platforms</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto">
                1
              </div>
              <h4 className="font-medium">Connect Account</h4>
              <p className="text-sm text-muted-foreground">
                Link your Discord account through secure OAuth
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto">
                2
              </div>
              <h4 className="font-medium">Subscribe</h4>
              <p className="text-sm text-muted-foreground">
                Choose a subscription plan that fits your needs
              </p>
            </div>
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto">
                3
              </div>
              <h4 className="font-medium">Get Access</h4>
              <p className="text-sm text-muted-foreground">
                Automatically receive Discord roles and exclusive access
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
