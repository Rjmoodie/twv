import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { RealEstateResult } from "../types";

interface TraditionalCalculatorProps {
  onResultCalculated?: (result: RealEstateResult) => void;
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtCurrency = (n: number) => fmt.format(n);

function calcMonthlyPayment(loanAmount: number, annualRate: number, termYears: number): number {
  if (loanAmount <= 0) return 0;
  if (annualRate === 0) return loanAmount / (termYears * 12);
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  return loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export const TraditionalCalculator = ({ onResultCalculated }: TraditionalCalculatorProps) => {
  const [propertyPrice, setPropertyPrice]       = useState("300000");
  const [downPayment, setDownPayment]           = useState("60000");
  const [interestRate, setInterestRate]         = useState("7.0");
  const [loanTerm, setLoanTerm]                 = useState("30");
  const [monthlyRent, setMonthlyRent]           = useState("2500");
  const [operatingExpenses, setOperatingExpenses] = useState("500");
  const [result, setResult] = useState<RealEstateResult | null>(null);

  const v = useMemo(() => {
    const price    = parseFloat(propertyPrice) || 0;
    const down     = parseFloat(downPayment)   || 0;
    const rate     = parseFloat(interestRate)  || 0;
    const term     = parseInt(loanTerm)        || 0;
    const rent     = parseFloat(monthlyRent)   || 0;
    const expenses = parseFloat(operatingExpenses) || 0;
    return {
      price, down, rate, term, rent, expenses,
      valid: price > 0 && down >= 0 && down < price && rate >= 0 && term > 0 && rent > 0 && expenses >= 0,
    };
  }, [propertyPrice, downPayment, interestRate, loanTerm, monthlyRent, operatingExpenses]);

  const handleCalculate = () => {
    if (!v.valid) return;
    const loanAmount      = v.price - v.down;
    const monthlyPayment  = calcMonthlyPayment(loanAmount, v.rate, v.term);
    const netCashFlow     = v.rent - monthlyPayment - v.expenses;
    const cashOnCashReturn = (netCashFlow * 12) / v.down * 100;
    const capRate         = ((v.rent - v.expenses) * 12) / v.price * 100;

    const r = {
      monthlyPayment:   Math.round(monthlyPayment),
      netCashFlow:      Math.round(netCashFlow),
      cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
      capRate:          Math.round(capRate * 100) / 100,
      profitable:       netCashFlow > 0,
    };
    setResult(r);
    onResultCalculated?.(r);
  };

  const Field = ({
    label, value, onChange, placeholder, type = "number", step,
  }: {
    label: string; value: string; onChange: (v: string) => void;
    placeholder?: string; type?: string; step?: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        aria-label={label}
        type={type}
        step={step}
        value={value}
        onChange={e => { onChange(e.target.value); setResult(null); }}
        min="0"
        placeholder={placeholder}
        className="h-9 text-sm font-mono"
      />
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Inputs */}
      <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Property Analysis</p>
            <p className="text-xs text-muted-foreground">Analyse buy-and-hold rental investment</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="label-wide text-muted-foreground text-[0.65rem]">Acquisition</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property price ($)" value={propertyPrice} onChange={setPropertyPrice} placeholder="300000" />
            <Field label="Down payment ($)"   value={downPayment}   onChange={setDownPayment}   placeholder="60000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Interest rate (%)" value={interestRate} onChange={setInterestRate} placeholder="7.0" step="0.1" />
            <Field label="Loan term (years)"  value={loanTerm}    onChange={setLoanTerm}    placeholder="30" />
          </div>
        </div>

        <div className="space-y-4 pt-1 border-t border-border/40">
          <p className="label-wide text-muted-foreground text-[0.65rem]">Income & expenses</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly rent ($)"              value={monthlyRent}      onChange={setMonthlyRent}      placeholder="2500" />
            <Field label="Monthly expenses ($)"          value={operatingExpenses} onChange={setOperatingExpenses} placeholder="500" />
          </div>
        </div>

        <Button onClick={handleCalculate} disabled={!v.valid} className="w-full gap-2">
          <Calculator className="h-4 w-4" />
          Analyse investment
        </Button>
      </div>

      {/* Results */}
      {result ? (
        <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-5">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-xl flex items-center justify-center",
              result.profitable ? "bg-accent/10" : "bg-destructive/10"
            )}>
              {result.profitable
                ? <TrendingUp className="h-4 w-4 text-accent" />
                : <AlertTriangle className="h-4 w-4 text-destructive" />}
            </div>
            <div>
              <p className="text-sm font-semibold">Investment Analysis</p>
              <p className={cn("text-xs font-medium", result.profitable ? "text-accent" : "text-destructive")}>
                {result.profitable ? "Cash flow positive" : "Cash flow negative"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 space-y-0.5">
              <p className="label-wide text-muted-foreground" style={{ fontSize: '0.6rem' }}>Monthly payment</p>
              <p className="text-lg font-bold font-mono tabular-nums">{fmtCurrency(result.monthlyPayment)}</p>
            </div>
            <div className={cn("rounded-xl p-3 space-y-0.5", result.netCashFlow >= 0 ? "bg-accent/8" : "bg-destructive/8")}>
              <p className="label-wide text-muted-foreground" style={{ fontSize: '0.6rem' }}>Net cash flow</p>
              <p className={cn("text-lg font-bold font-mono tabular-nums", result.netCashFlow >= 0 ? "text-accent" : "text-destructive")}>
                {result.netCashFlow >= 0 ? "+" : ""}{fmtCurrency(result.netCashFlow)}/mo
              </p>
            </div>
          </div>

          <div className="pt-1 border-t border-border/40 space-y-3">
            {[
              { label: "Cash-on-cash return", value: `${result.cashOnCashReturn}%`, good: result.cashOnCashReturn >= 8 },
              { label: "Cap rate",            value: `${result.capRate}%`,          good: result.capRate >= 5 },
            ].map(({ label, value, good }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className={cn("text-sm font-semibold tabular-nums", good ? "text-accent" : "text-foreground")}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          <div className={cn(
            "rounded-xl p-3 text-xs text-muted-foreground",
            result.profitable ? "bg-accent/5 border border-accent/15" : "bg-destructive/5 border border-destructive/15"
          )}>
            {result.cashOnCashReturn >= 8
              ? "Strong return — meets the 8% cash-on-cash benchmark."
              : result.profitable
                ? "Positive cash flow but below the 8% target. Review rent assumptions."
                : "Negative cash flow. Consider a higher down payment or lower purchase price."}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/50 bg-card/30 p-5 flex flex-col items-center justify-center gap-2 text-center min-h-[280px]">
          <DollarSign className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">Results appear here</p>
          <p className="text-xs text-muted-foreground/60">Fill in the inputs and click Analyse.</p>
        </div>
      )}
    </div>
  );
};
