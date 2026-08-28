import { useState } from "react";
import { CashFlowInputs, CashFlowReport } from "./types";
import CashFlowInputForm from "./cash-flow/CashFlowInputForm";
import CashFlowResults from "./cash-flow/CashFlowResults";
import CashFlowChart from "./cash-flow/CashFlowChart";
import CashFlowExport from "./cash-flow/CashFlowExport";
import { calculateCashFlow } from "./cash-flow/cashFlowEngine";
import { modules } from "./constants";
import { toast } from "@/hooks/use-toast";


const module = modules.find(m => m.id === "cash-flow");

const CashFlowSimulator = () => {
  const [inputs, setInputs] = useState<CashFlowInputs>({
    businessName: "",
    industry: "",
    startingCash: 0,
    timeframe: 12,
    monthlyRevenue: 0,
    revenueGrowthRate: 0,
    hasSeasonality: false,
    seasonalityMultiplier: 1.2,
    accountsReceivableDays: 30,
    accountsPayableDays: 30,
    fixedExpenses: [
      { name: "Rent", amount: 0, isPercentage: false },
      { name: "Payroll", amount: 0, isPercentage: false }
    ],
    variableExpenses: [
      { name: "Cost of Goods Sold", amount: 30, isPercentage: true },
      { name: "Marketing", amount: 0, isPercentage: false }
    ],
    taxRate: 25,
    loanAmount: 0,
    interestRate: 0,
    loanTermMonths: 0,
    equityRaised: 0,
    equityRaiseMonth: 1
  });

  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [activeScenario, setActiveScenario] = useState<'conservative' | 'base' | 'optimistic'>('base');

  const handleInputChange = (field: keyof CashFlowInputs, value: any) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const handleCalculate = () => {
    setIsCalculating(true);
    try {
      const calculatedReport = calculateCashFlow(inputs);
      setReport(calculatedReport);
    } catch (error) {
      console.error("Error calculating cash flow:", error);
      toast({
        title: "Could not calculate cash flow",
        description: error instanceof Error ? error.message : "Check the inputs and try again.",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleScenarioChange = (scenario: 'conservative' | 'base' | 'optimistic') => {
    setActiveScenario(scenario);
  };

  // JSON-LD structured data for the cash flow simulator
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": module?.name,
    "description": module?.seo?.description,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "All",
    "publisher": {
      "@type": "Organization",
      "name": "SomaTech"
    }
  };

  return (
    <>

      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <CashFlowInputForm
              inputs={inputs}
              onInputChange={handleInputChange}
              onCalculate={handleCalculate}
              isCalculating={isCalculating}
            />
          </div>
          {report && (
            <div className="space-y-6">
              <CashFlowChart report={report} activeScenario={activeScenario} />
              <CashFlowExport report={report} activeScenario={activeScenario} />
            </div>
          )}
        </div>
        {report && (
          <CashFlowResults 
            report={report} 
            onScenarioChange={handleScenarioChange}
            activeScenario={activeScenario}
          />
        )}
      </div>
    </>
  );
};

export default CashFlowSimulator;
