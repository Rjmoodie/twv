import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ExternalLink, Clock, Star } from "lucide-react";

const LearningResources = () => {
  const resources = [
    { title: "Financial Statement Analysis", description: "Master the art of reading and analyzing financial statements", duration: "30 min", rating: 4.8, category: "Fundamentals" },
    { title: "DCF Modeling Best Practices",  description: "Advanced techniques for discounted cash flow valuation",        duration: "45 min", rating: 4.9, category: "Valuation"    },
    { title: "Portfolio Risk Management",    description: "Strategies for managing portfolio risk and diversification",    duration: "25 min", rating: 4.7, category: "Risk"          }
  ];

  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>Learning Resources</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource, index) => (
            <div key={index} className="border border-border rounded-xl p-4 flex flex-col gap-3 hover:bg-muted/40 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="text-xs">{resource.category}</Badge>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-warning fill-current" />
                  <span className="text-xs font-medium">{resource.rating}</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-sm leading-snug">{resource.title}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{resource.description}</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{resource.duration}</span>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Open resource">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LearningResources;
