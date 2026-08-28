import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Clock, Users } from "lucide-react";

const FeaturedVideo = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-4 w-4 text-primary" />
          <span>Featured Learning</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-foreground">
              Advanced Financial Modeling Techniques
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Learn how to build sophisticated financial models for business valuation,
              DCF analysis, and investment decision making. Best practices used by top
              investment professionals.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>45 min</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                <span>2,847 views</span>
              </div>
            </div>
            <Button>
              <Play className="h-4 w-4" />
              Watch Now
            </Button>
          </div>
          <div className="relative">
            <div className="aspect-video bg-muted rounded-lg border border-border flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-background rounded-full border border-border flex items-center justify-center mx-auto shadow-sm">
                  <Play className="h-5 w-5 text-primary ml-0.5" />
                </div>
                <p className="text-xs text-muted-foreground">Video Preview</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeaturedVideo;