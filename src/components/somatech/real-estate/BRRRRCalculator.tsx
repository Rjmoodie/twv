import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Home, RefreshCw, DollarSign, TrendingUp, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BRRRRInputs, BRRRRResults, calculateBRRRR, validateBRRRRInputs } from "./brrrrCalculations";
import { formatCurrency, formatPercentage } from "./realEstateUtils";
import { BRRRRExplainer } from "./BRRRRExplainer";
import { FinancialTooltip } from "./FinancialTooltip";
import { PerformanceOptimizations } from "./PerformanceOptimizations";
import { cn } from "@/lib/utils";

interface BRRRRCalculatorProps {
  inputs: BRRRRInputs;
  onInputChange: (field: keyof BRRRRInputs, value: number) => void;
  results: BRRRRResults | null;
  onResults: (results: BRRRRResults) => void;
  onSaveClick: () => void;
  isMobile: boolean;
  dealName: string;
  dealNotes: string;
  currentDealId: string | null;
  onAutoSave: () => Promise<boolean>;
}

// Phase color tokens — maps to the design system
const PHASE = {
  buy:      { icon: 'text-primary',     bg: 'bg-primary/10',     border: 'border-primary/20'     },
  rehab:    { icon: 'text-warning',     bg: 'bg-warning/10',     border: 'border-warning/20'     },
  rent:     { icon: 'text-accent',      bg: 'bg-accent/10',      border: 'border-accent/20'      },
  refi:     { icon: 'text-coach',       bg: 'bg-coach/10',       border: 'border-coach/20'       },
  summary:  { icon: 'text-primary',     bg: 'bg-primary/8',      border: 'border-primary/25'     },
};

function NumInput({
  label, field, inputs, onInputChange, step = 1,
}: {
  label: string;
  field: keyof BRRRRInputs;
  inputs: BRRRRInputs;
  onInputChange: (f: keyof BRRRRInputs, v: number) => void;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        step={step}
        value={inputs[field]}
        onChange={e => onInputChange(field, Number(e.target.value))}
        min={0}
        className="h-9 text-sm font-mono"
      />
    </div>
  );
}

function PhaseCard({
  title, icon: Icon, phase, children,
}: {
  title: string;
  icon: React.ElementType;
  phase: keyof typeof PHASE;
  children: React.ReactNode;
}) {
  const p = PHASE[phase];
  return (
    <div className={cn('rounded-2xl border bg-card/60 p-4 space-y-4', p.border)}>
      <div className="flex items-center gap-2.5">
        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', p.bg)}>
          <Icon className={cn('h-3.5 w-3.5', p.icon)} />
        </div>
        <p className="text-sm font-semibold">{title}</p>
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  label, value, valueClass, tooltip,
}: {
  label: string;
  value: string;
  valueClass?: string;
  tooltip?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {tooltip}
      </span>
      <span className={cn("text-sm font-semibold tabular-nums font-mono", valueClass)}>
        {value}
      </span>
    </div>
  );
}

export const BRRRRCalculator = ({
  inputs, onInputChange, results, onResults,
  onSaveClick, isMobile, dealName, dealNotes, currentDealId, onAutoSave,
}: BRRRRCalculatorProps) => {
  const [isCalculating, setIsCalculating] = useState(false);
  const validationErrors = validateBRRRRInputs(inputs);

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      await new Promise(r => setTimeout(r, 300));
      onResults(calculateBRRRR(inputs));
      toast({ title: "BRRRR analysis complete" });
    } catch (error) {
      toast({ title: "Calculation error", description: error instanceof Error ? error.message : "Check your inputs and try again.", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const inputGrid = (
    <div className="space-y-4">
      {/* Buy */}
      <PhaseCard title="Buy phase" icon={Home} phase="buy">
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Purchase price ($)" field="purchasePrice" inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Down payment (%)"   field="downPaymentPercent" inputs={inputs} onInputChange={onInputChange} step={0.5} />
          <NumInput label="Closing costs ($)"  field="closingCosts"  inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Acquisition fees ($)" field="acquisitionFees" inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Monthly holding costs ($)" field="holdingCosts" inputs={inputs} onInputChange={onInputChange} />
        </div>
      </PhaseCard>

      {/* Rehab */}
      <PhaseCard title="Rehab phase" icon={RefreshCw} phase="rehab">
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Renovation budget ($)" field="renovationBudget"  inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Contingency (%)"        field="contingencyPercent" inputs={inputs} onInputChange={onInputChange} step={0.5} />
          <NumInput label="Rehab duration (mo)"    field="rehabDuration"     inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Financing rate (%)"     field="rehabFinancingRate" inputs={inputs} onInputChange={onInputChange} step={0.1} />
        </div>
      </PhaseCard>

      {/* Rent */}
      <PhaseCard title="Rent phase" icon={DollarSign} phase="rent">
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="Monthly rent ($)"          field="monthlyRent"        inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Vacancy rate (%)"          field="vacancyRate"        inputs={inputs} onInputChange={onInputChange} step={0.5} />
          <NumInput label="Property management ($)"   field="propertyManagement" inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Insurance ($)"             field="insurance"          inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Property tax ($)"          field="propertyTax"        inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Maintenance ($)"           field="maintenance"        inputs={inputs} onInputChange={onInputChange} />
        </div>
      </PhaseCard>

      {/* Refinance */}
      <PhaseCard title="Refinance phase" icon={TrendingUp} phase="refi">
        <div className="grid grid-cols-2 gap-3">
          <NumInput label="After repair value ($)" field="arv"            inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Refinance LTV (%)"      field="refinanceLTV"   inputs={inputs} onInputChange={onInputChange} step={0.5} />
          <NumInput label="New loan rate (%)"      field="newLoanRate"    inputs={inputs} onInputChange={onInputChange} step={0.1} />
          <NumInput label="New loan term (yr)"     field="newLoanTerm"    inputs={inputs} onInputChange={onInputChange} />
          <NumInput label="Refinance costs ($)"    field="refinanceCosts" inputs={inputs} onInputChange={onInputChange} />
        </div>
      </PhaseCard>

      {validationErrors.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{validationErrors[0]}</span>
        </div>
      )}
      <Button onClick={handleCalculate} size="lg" className="w-full gap-2" disabled={isCalculating || validationErrors.length > 0}>
        <TrendingUp className="h-4 w-4" />
        {isCalculating ? "Calculating…" : "Calculate BRRRR analysis"}
      </Button>
    </div>
  );

  const resultsPanel = results && (
    <div className="space-y-4">
      {/* Top summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-0.5">
          <p className="label-wide text-primary" style={{ fontSize: '0.6rem' }}>Total investment</p>
          <p className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(results.totalInvestment)}</p>
        </div>
        <div className="rounded-2xl bg-accent/10 border border-accent/20 p-4 space-y-0.5">
          <p className="label-wide text-accent" style={{ fontSize: '0.6rem' }}>Post-refi ROI</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-accent">{formatPercentage(results.postRefinanceROI)}</p>
        </div>
      </div>

      {/* Buy phase */}
      <PhaseCard title="Buy phase results" icon={Home} phase="buy">
        <div className="space-y-2.5">
          <ResultRow label="Total acquisition cost" value={formatCurrency(results.totalAcquisitionCost)}
            tooltip={<FinancialTooltip term="Total Acquisition Cost" definition="Purchase price + closing costs + acquisition fees." formula="Purchase Price + Closing Costs + Acquisition Fees" />} />
          <ResultRow label="Initial cash needed" value={formatCurrency(results.initialCashNeeded)}
            tooltip={<FinancialTooltip term="Initial Cash Needed" definition="Upfront cash required to close on the property." formula="Down Payment + Closing Costs + Acquisition Fees" />} />
        </div>
      </PhaseCard>

      {/* Rehab phase */}
      <PhaseCard title="Rehab phase results" icon={RefreshCw} phase="rehab">
        <div className="space-y-2.5">
          <ResultRow label="Total rehab cost"          value={formatCurrency(results.totalRehabCost)} />
          <ResultRow label="Total holding cost"        value={formatCurrency(results.totalHoldingCost)} />
          <ResultRow label="Pre-stabilisation investment" value={formatCurrency(results.preStabilizationInvestment)} valueClass="text-base" />
        </div>
      </PhaseCard>

      {/* Rent phase */}
      <PhaseCard title="Rent phase results" icon={DollarSign} phase="rent">
        <div className="space-y-2.5">
          <ResultRow label="Effective monthly rent"    value={formatCurrency(results.effectiveMonthlyRent)} />
          <ResultRow label="Monthly operating expenses" value={formatCurrency(results.monthlyOperatingExpenses)} />
          <ResultRow label="Net operating income"      value={formatCurrency(results.netOperatingIncome)} />
          <ResultRow label="Pre-refi cash flow"
            value={formatCurrency(results.preRefinanceCashFlow)}
            valueClass={results.preRefinanceCashFlow >= 0 ? "text-accent" : "text-destructive"} />
          <ResultRow label="Pre-refi ROI"              value={formatPercentage(results.preRefinanceROI)} />
        </div>
      </PhaseCard>

      {/* Refinance phase */}
      <PhaseCard title="Refinance phase results" icon={TrendingUp} phase="refi">
        <div className="space-y-2.5">
          <ResultRow label="Max refinance loan"  value={formatCurrency(results.maxRefinanceLoan)} />
          <ResultRow label="Cash out amount"     value={formatCurrency(results.cashOutAmount)}    valueClass="text-accent" />
          <ResultRow label="New monthly payment" value={formatCurrency(results.newMonthlyPayment)} />
          <ResultRow label="Post-refi cash flow"
            value={formatCurrency(results.postRefinanceCashFlow)}
            valueClass={results.postRefinanceCashFlow >= 0 ? "text-accent" : "text-destructive"} />
          <ResultRow label="Remaining equity"    value={formatCurrency(results.remainingEquity)} />
        </div>
      </PhaseCard>

      {/* Final summary */}
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 space-y-4">
        <p className="text-sm font-semibold">Final BRRRR summary</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Final investment",   value: formatCurrency(results.totalInvestment) },
            { label: "Equity created",     value: formatCurrency(results.equityCreated),      cls: "text-accent" },
            { label: "Capital recycled",   value: formatPercentage(results.capitalRecycled) },
            { label: "Rent-to-value ratio", value: formatPercentage(results.rentToValueRatio) },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-xl bg-card/80 p-3 space-y-0.5">
              <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
              <p className={cn("text-base font-bold font-mono tabular-nums", cls)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/40 bg-card/60 p-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Post-refi ROI</p>
          <p className={cn(
            "text-2xl font-bold font-mono tabular-nums",
            results.postRefinanceROI >= 10 ? "text-accent"
              : results.postRefinanceROI >= 5 ? "text-warning"
              : "text-destructive"
          )}>
            {formatPercentage(results.postRefinanceROI)}
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          {results.postRefinanceROI >= 15 ? "Excellent — strong return on invested capital." :
           results.postRefinanceROI >= 10 ? "Good — meets the standard 10% investment threshold." :
           results.postRefinanceROI >= 5  ? "Fair — marginal. Review acquisition price or rehab budget." :
           "Below target — revise assumptions or negotiate a lower purchase price."}
        </p>

        <Button onClick={onSaveClick} variant="outline" className="w-full gap-2">
          <Save className="h-4 w-4" />
          Save this deal
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">BRRRR Calculator</h2>
          <BRRRRExplainer />
        </div>
        {currentDealId && (
          <PerformanceOptimizations
            inputs={inputs}
            results={results}
            dealName={dealName}
            dealNotes={dealNotes}
            currentDealId={currentDealId}
            onAutoSave={onAutoSave}
          />
        )}
      </div>

      {isMobile ? (
        <div className="space-y-4">
          {inputGrid}
          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
                  <p className="label-wide text-primary" style={{ fontSize: '0.6rem' }}>Total investment</p>
                  <p className="text-xl font-bold font-mono">{formatCurrency(results.totalInvestment)}</p>
                </div>
                <div className="rounded-2xl bg-accent/10 border border-accent/20 p-4">
                  <p className="label-wide text-accent" style={{ fontSize: '0.6rem' }}>Post-refi ROI</p>
                  <p className="text-xl font-bold font-mono text-accent">{formatPercentage(results.postRefinanceROI)}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="label-wide text-muted-foreground" style={{ fontSize: '0.6rem' }}>Cash out</p>
                  <p className="text-xl font-bold font-mono">{formatCurrency(results.cashOutAmount)}</p>
                </div>
                <div className="rounded-2xl bg-muted/50 p-4">
                  <p className="label-wide text-muted-foreground" style={{ fontSize: '0.6rem' }}>Equity created</p>
                  <p className="text-xl font-bold font-mono text-accent">{formatCurrency(results.equityCreated)}</p>
                </div>
              </div>
              <Button onClick={onSaveClick} className="w-full gap-2">
                <Save className="h-4 w-4" />
                Save deal
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {inputGrid}
          {resultsPanel ?? (
            <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 flex flex-col items-center justify-center gap-2 text-center min-h-[400px]">
              <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Results appear here</p>
              <p className="text-xs text-muted-foreground/60">Fill in the phases and click Calculate.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
