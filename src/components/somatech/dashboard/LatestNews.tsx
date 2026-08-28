import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, ExternalLink, Clock } from "lucide-react";
import { NewsItem } from "./mockData";

interface LatestNewsProps {
  news: NewsItem[];
}

const LatestNews = ({ news }: LatestNewsProps) => {
  return (
    <Card className="premium-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <span>Latest Financial News</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {news.map((item) => (
            <div key={item.id} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1.5 min-w-0">
                  <h4 className="font-semibold text-foreground text-sm sm:text-base leading-snug">
                    {item.title}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.summary}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{item.timestamp}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.source}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0 h-9 w-9 p-0" aria-label="Open article">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LatestNews;
