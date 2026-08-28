import { useEffect, useMemo, useRef, useState } from "react";
import { BusinessValuationInputs, ValuationMethods, BusinessValuationReport } from "./types";
import BusinessValuationInputForm from "./business-valuation/BusinessValuationInputForm";
import BusinessValuationResults from "./business-valuation/BusinessValuationResults";
import BusinessValuationChart from "./business-valuation/BusinessValuationChart";
import BusinessValuationExport from "./business-valuation/BusinessValuationExport";
import SWOTAnalysis from "./business-valuation/SWOTAnalysis";
import HorizontalAnalysis from "./business-valuation/HorizontalAnalysis";
import CommonSizeAnalysis from "./business-valuation/CommonSizeAnalysis";
import BCGMatrix from "./business-valuation/BCGMatrix";
import PortersStrategies from "./business-valuation/PortersStrategies";
import { calculateBusinessValuation } from "./business-valuation/valuationEngine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Layers, TrendingUp, PieChart, Target, Shield } from "lucide-react";
import { useBusinessValuationPrefill } from "@/hooks/usePFPrefill";
import DiscussWithCoach from "./DiscussWithCoach";
import type { ToolSession } from "@/lib/toolSessionTypes";
import { toast } from "@/hooks/use-toast";

const TAB_CONFIG = [
  { value: "valuation",   label: "Valuation", icon: Building2  },
  { value: "swot",        label: "SWOT",      icon: Layers     },
  { value: "trend",       label: "Trend",     icon: TrendingUp },
  { value: "common-size", label: "Size",      icon: PieChart   },
  { value: "bcg",         label: "BCG",       icon: Target     },
  { value: "porter",      label: "Porter's",  icon: Shield     },
] as const;

const BusinessValuation = () => {
  const [inputs, setInputs] = useState<BusinessValuationInputs>({
    industry: "",
    businessType: "",
    currentRevenue: 0,
    grossMargin: 60,
    ebitdaMargin: 25,
    netMargin: 15,
    revenueGrowth: 15,
    exitTimeframe: 5,
    discountRate: 10,
    terminalGrowthRate: 3,
  });

  const [methods, setMethods] = useState<ValuationMethods>({
    revenueMultiple: true,
    ebitdaMultiple: true,
    peMultiple: true,
    dcf: true,
  });

  const [report, setReport] = useState<BusinessValuationReport | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // PF pre-fill: seed revenue from Personal Finance side income on first load
  const pfPrefill = useBusinessValuationPrefill();
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current) return;
    if (!pfPrefill.monthlyRevenue) return;
    prefillApplied.current = true;
    setInputs(prev => ({
      ...prev,
      ...(prev.currentRevenue === 0 && pfPrefill.monthlyRevenue
        ? { currentRevenue: pfPrefill.monthlyRevenue * 12 }
        : {}),
    }));
  }, [pfPrefill]);

  // Coach session built from the latest valuation report
  const coachSession = useMemo((): ToolSession | null => {
    if (!report) return null;
    const base = report.scenarios.base.totalValue;
    const cons = report.scenarios.conservative.totalValue;
    const opt  = report.scenarios.optimistic.totalValue;
    const rev  = report.inputs.currentRevenue;
    return {
      tool: 'business-valuation',
      summary: `I ran a business valuation: base-case value $${base.toLocaleString()}, range $${cons.toLocaleString()}–$${opt.toLocaleString()}. Business has $${rev.toLocaleString()} annual revenue, ${report.inputs.ebitdaMargin}% EBITDA margin, ${report.inputs.revenueGrowth}% growth, ${report.inputs.exitTimeframe}-year exit horizon.`,
      key_outputs: {
        baseValue:          base,
        conservativeValue:  cons,
        optimisticValue:    opt,
        annualRevenue:      rev,
        ebitdaMargin:       report.inputs.ebitdaMargin,
      },
    };
  }, [report]);

  const handleInputChange = (field: keyof BusinessValuationInputs, value: any) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleMethodChange = (method: keyof ValuationMethods, checked: boolean) => {
    setMethods(prev => ({ ...prev, [method]: checked }));
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    try {
      setReport(calculateBusinessValuation(inputs, methods));
    } catch (error) {
      console.error("Error calculating valuation:", error);
      toast({
        title: "Could not calculate valuation",
        description: error instanceof Error ? error.message : "Check the inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <Tabs defaultValue="valuation" className="space-y-5">
      {/* Horizontally scrollable tab bar — scrollbar hidden on all platforms */}
      <div className="overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <TabsList className="inline-flex h-auto min-w-max gap-0.5 bg-muted/70 border border-border/50 rounded-2xl p-1">
          {TAB_CONFIG.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium whitespace-nowrap transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-elev-1"
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value="valuation">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BusinessValuationInputForm
              inputs={inputs}
              methods={methods}
              onInputChange={handleInputChange}
              onMethodChange={handleMethodChange}
              onCalculate={handleCalculate}
              isCalculating={isCalculating}
            />
            {report && (
              <div className="space-y-6">
                <BusinessValuationChart report={report} />
                <BusinessValuationExport report={report} />
              </div>
            )}
          </div>
          {report && (
            <>
              <BusinessValuationResults report={report} />
              {coachSession && (
                <div className="flex justify-end">
                  <DiscussWithCoach session={coachSession} size="sm" />
                </div>
              )}
            </>
          )}
        </div>
      </TabsContent>

      <TabsContent value="swot">       <SWOTAnalysis />        </TabsContent>
      <TabsContent value="trend">      <HorizontalAnalysis />  </TabsContent>
      <TabsContent value="common-size"><CommonSizeAnalysis />  </TabsContent>
      <TabsContent value="bcg">        <BCGMatrix />           </TabsContent>
      <TabsContent value="porter">     <PortersStrategies />   </TabsContent>
    </Tabs>
  );
};

export default BusinessValuation;
