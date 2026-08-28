import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { InvestmentThesis } from "./types";
import { Shield, Rocket, FileText } from "lucide-react";

interface InvestmentThesisGeneratorProps {
  ticker: string;
  investmentThesis: InvestmentThesis;
  setInvestmentThesis: (thesis: InvestmentThesis) => void;
}

const InvestmentThesisGenerator = ({ ticker, investmentThesis, setInvestmentThesis }: InvestmentThesisGeneratorProps) => {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5 text-primary" />
          {ticker} — Investment Thesis
        </CardTitle>
        <CardDescription className="text-gray-600 dark:text-gray-400">
          Document your comprehensive investment analysis and thesis for {ticker}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor={`${ticker}-thesis-moat`} className="flex items-center space-x-2 text-base font-semibold text-gray-700 dark:text-gray-300">
            <Shield className="h-5 w-5 text-accent" />
            <span>{ticker} Economic Moat & Competitive Advantages</span>
          </Label>
          <Textarea
            id={`${ticker}-thesis-moat`}
            maxLength={12000}
            className="min-h-24 border-2 border-gray-200 focus:border-accent/20 focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:focus:border-accent/20 dark:focus:ring-green-800 transition-all duration-200 resize-none"
            placeholder={`Describe ${ticker}'s competitive moats, brand strength, network effects, switching costs, intellectual property, regulatory advantages...`}
            value={investmentThesis.moat}
            onChange={(e) => setInvestmentThesis({ ...investmentThesis, moat: e.target.value })}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Consider: Brand loyalty, network effects, cost advantages, regulatory barriers, patents
          </div>
        </div>
        
        <div className="space-y-3">
          <Label htmlFor={`${ticker}-thesis-risks`} className="flex items-center space-x-2 text-base font-semibold text-gray-700 dark:text-gray-300">
            <Shield className="h-5 w-5 text-destructive" />
            <span>{ticker} Key Risks & Concerns</span>
          </Label>
          <Textarea
            id={`${ticker}-thesis-risks`}
            maxLength={8000}
            className="min-h-24 border-2 border-gray-200 focus:border-destructive/20 focus:ring-2 focus:ring-destructive/40 dark:border-gray-700 dark:focus:border-destructive/20 dark:focus:ring-destructive/40 transition-all duration-200 resize-none"
            placeholder={`${ticker} regulatory risks, competition, balance sheet concerns, market risks, management risks, technology disruption...`}
            value={investmentThesis.risks}
            onChange={(e) => setInvestmentThesis({ ...investmentThesis, risks: e.target.value })}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            ⚠️ Consider: Regulatory changes, competitive threats, debt levels, market volatility, management quality
          </div>
        </div>
        
        <div className="space-y-3">
          <Label htmlFor={`${ticker}-thesis-opportunities`} className="flex items-center space-x-2 text-base font-semibold text-gray-700 dark:text-gray-300">
            <Rocket className="h-5 w-5 text-blue-600" />
            <span>{ticker} Growth Opportunities</span>
          </Label>
          <Textarea
            id={`${ticker}-thesis-opportunities`}
            maxLength={8000}
            className="min-h-24 border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:focus:border-blue-400 dark:focus:ring-blue-800 transition-all duration-200 resize-none"
            placeholder={`${ticker} market expansion, product innovation, M&A opportunities, margin improvement, international growth, new business lines...`}
            value={investmentThesis.opportunities}
            onChange={(e) => setInvestmentThesis({ ...investmentThesis, opportunities: e.target.value })}
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Consider: New markets, product launches, acquisitions, operational improvements, digital transformation
          </div>
        </div>
        
        {/* Character count indicators */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t border-border">
          <div className="text-center">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">Moat Analysis</div>
            <div className="text-base sm:text-lg font-bold text-accent">{investmentThesis.moat.length}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">characters</div>
          </div>
          <div className="text-center">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">Risk Assessment</div>
            <div className="text-base sm:text-lg font-bold text-destructive">{investmentThesis.risks.length}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">characters</div>
          </div>
          <div className="text-center">
            <div className="text-xs sm:text-sm font-medium text-muted-foreground">Growth Potential</div>
            <div className="text-base sm:text-lg font-bold text-primary">{investmentThesis.opportunities.length}</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground">characters</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvestmentThesisGenerator;
