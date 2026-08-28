import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DCFScenarios, StockData } from "./types";
import { calculateDCF, clampDcfInput, DCF_INPUT_BOUNDS, type EditableDcfInput } from "./utils";
import ValuationLadderPanel from "./ValuationLadderPanel";
import { permittedMethods, sectorNoteFor } from "./valuationLadder";
import { classifySic } from "../../../supabase/functions/_shared/sicClassification";
import { track } from "@/lib/analytics";
import { AlertTriangle, Calculator, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";

interface DCFAnalysisProps {
  ticker: string;
  dcfScenarios: DCFScenarios;
  setDcfScenarios: (scenarios: DCFScenarios) => void;
  stockData: StockData | null;
}

const DCFAnalysis = ({ ticker, dcfScenarios, setDcfScenarios, stockData }: DCFAnalysisProps) => {
  // Trust signal (S1): a valuation we cannot compute is a moment the user
  // stops believing the product. Count them rather than silently showing N/A.
  const baseResult = calculateDCF(dcfScenarios.base, stockData);

  // A discounted cash flow is not merely imprecise for a bank or an insurer, it
  // is the wrong instrument: enterprise cash flow assumes debt is financing
  // layered over an operating business, and for a lender borrowing is the
  // business. Suppress the scenarios rather than let a plausible-looking number
  // stand, and hand the reader the instrument that does apply.
  const businessClass = classifySic(stockData?.sic);
  const dcfApplies = permittedMethods(businessClass).includes('dcf-fcf');
  const sectorNote = sectorNoteFor(businessClass);
  useEffect(() => {
    if (!stockData) return;
    if (!dcfApplies) {
      track('valuation_unavailable', { ticker, reason: 'method_inappropriate_for_sector' });
    } else if (baseResult.intrinsicValue == null) {
      track('valuation_unavailable', { ticker, reason: 'insufficient_data' });
    }
  }, [ticker, stockData, baseResult.intrinsicValue, dcfApplies]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center space-x-2 text-xl font-bold">
          <Calculator className="h-6 w-6 text-blue-600" />
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {ticker} DCF Scenario Analysis
          </span>
        </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
          Three-scenario valuation model for {ticker} with customizable inputs and instant calculations from the displayed assumptions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {!dcfApplies ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                A discounted cash flow is not the right instrument for {ticker}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {stockData?.sicDescription
                  ? `${ticker} is classified in its SEC filings as ${stockData.sicDescription.toLowerCase()}${stockData?.sic ? ` (SIC ${stockData.sic})` : ''}. `
                  : ''}
                {sectorNote}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The scenario inputs are hidden rather than left editable, because any number they produced would look precise and be wrong. An appropriate valuation is shown below.
              </p>
            </div>
          ) : (
          <>
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            This model projects reported free cash flow for five years, discounts each annual cash flow, and applies a terminal P/FCF multiple. Revenue growth and net margin are retained as research notes but are not valuation inputs.
          </p>
          {/* Input Table */}
          <div className="overflow-x-auto">
            <div className="grid grid-cols-4 gap-2 sm:gap-4 min-w-[400px]">
              <div className="font-medium text-xs sm:text-sm">Variable</div>
              <div className="font-medium text-center text-xs sm:text-sm">Low Case</div>
              <div className="font-medium text-center text-xs sm:text-sm">Base Case</div>
              <div className="font-medium text-center text-xs sm:text-sm">High Case</div>
              
              {(Object.keys(DCF_INPUT_BOUNDS) as EditableDcfInput[]).map((key) => (
                <div key={key} className="contents">
                  <div className="text-xs sm:text-sm py-2">{{ fcfGrowth: "FCF growth (%)", exitMultiple: "Terminal P/FCF (x)", discountRate: "Discount rate (%)" }[key]}</div>
                  {(['low', 'base', 'high'] as const).map(scenario => (
                    <Input
                      key={`${key}-${scenario}`}
                      type="number"
                      value={dcfScenarios[scenario][key]}
                      min={DCF_INPUT_BOUNDS[key].min}
                      max={DCF_INPUT_BOUNDS[key].max}
                      step={DCF_INPUT_BOUNDS[key].step}
                      aria-label={`${scenario} case ${{ fcfGrowth: "FCF growth percentage", exitMultiple: "terminal price to free cash flow multiple", discountRate: "discount rate percentage" }[key]}`}
                      onChange={(e) => {
                        if (e.target.value.trim() === '') return;
                        const next = clampDcfInput(key, Number(e.target.value));
                        if (next == null) return;
                        setDcfScenarios({
                          ...dcfScenarios,
                          [scenario]: { ...dcfScenarios[scenario], [key]: next },
                        });
                      }}
                      className="text-center text-xs sm:text-sm"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* DCF Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['low', 'base', 'high'] as const).map(scenario => {
              const result = calculateDCF(dcfScenarios[scenario], stockData);
              const isBase = scenario === 'base';
              // A DCF that cannot be computed must read as unavailable, never as $0 / 0%.
              const hasValue = result.intrinsicValue != null;
              // Unknown is a third state, not a loss. `(result.upside ?? 0) > 0`
              // made a missing valuation false, which painted the panel red and
              // pointed the arrow down — telling the user the company had fallen
              // when in truth nothing had been computed at all.
              const isPositive = result.upside != null && result.upside > 0;
              const isUnknown = result.upside == null;
              
              return (
                <Card 
                  key={scenario} 
                  className={`border-2 transition-all duration-200 hover:shadow-lg ${
                    isBase 
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900' 
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-center text-sm sm:text-base flex items-center justify-center space-x-2">
                      {scenario === 'low' && <Minus className="h-4 w-4 text-destructive" />}
                      {scenario === 'base' && <Calculator className="h-4 w-4 text-blue-500" />}
                      {scenario === 'high' && <Plus className="h-4 w-4 text-accent" />}
                      <span className={`font-bold ${
                        scenario === 'low' ? 'text-destructive' :
                        scenario === 'base' ? 'text-blue-600' :
                        'text-accent'
                      }`}>
                        {scenario.toUpperCase()} CASE
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center space-y-3 pt-0">
                    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border">
                      <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{hasValue ? `$${result.intrinsicValue!.toFixed(2)}` : 'N/A'}</div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Intrinsic Value</div>
                    </div>
                    
                    <div className={`p-3 rounded-lg border ${
                      isUnknown
                        ? 'bg-muted/40 border-border'
                        : isPositive
                          ? 'bg-accent/10 border-accent/20 dark:bg-accent/10 dark:border-accent/30'
                          : 'bg-destructive/10 border-destructive/20 dark:bg-destructive/10 dark:border-destructive/20'
                    }`}>
                      <div className={`text-lg sm:text-xl font-semibold flex items-center justify-center space-x-1 ${
                        isUnknown ? 'text-muted-foreground' : isPositive ? 'text-accent' : 'text-destructive'
                      }`}>
                        {isUnknown ? null : isPositive ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        <span>{result.upside != null ? `${isPositive ? '+' : ''}${result.upside}%` : 'N/A'}</span>
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Upside/Downside</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          </>
          )}

          {(baseResult.intrinsicValue == null || !dcfApplies) && (
            <ValuationLadderPanel ticker={ticker} stockData={stockData} />
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DCFAnalysis;
