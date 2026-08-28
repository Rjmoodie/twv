import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, ChevronRight, ChevronLeft, Calculator, Check, Building2 } from "lucide-react";
import { useHaptics } from "@/hooks/useHaptics";
import { BusinessValuationInputs, ValuationMethods } from "../types";
import { industryOptions, businessTypeOptions } from "../constants";

interface BusinessValuationInputFormProps {
  inputs: BusinessValuationInputs;
  methods: ValuationMethods;
  onInputChange: (field: keyof BusinessValuationInputs, value: any) => void;
  onMethodChange: (method: keyof ValuationMethods, checked: boolean) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

const STEPS   = ["Basic Info", "Financials", "DCF & Methods"] as const;
const SHORT   = ["Basic", "Financials", "DCF"] as const;

const tooltips: Partial<Record<keyof BusinessValuationInputs, string>> = {
  grossMargin:        "Revenue minus cost of goods sold, divided by revenue. Higher margins signal pricing power and efficiency.",
  ebitdaMargin:       "Earnings Before Interest, Taxes, Depreciation & Amortisation as a % of revenue. A proxy for operating cash profitability.",
  netMargin:          "Bottom-line profit after all expenses as a % of revenue.",
  discountRate:       "The rate used to discount future cash flows to present value. Reflects the risk of the business — typically 8–15% for private companies.",
  terminalGrowthRate: "The assumed long-run growth rate after the forecast period. Should not exceed GDP growth (typically 2–4%).",
  revenueGrowth:      "Expected annual increase in revenue over the projection period.",
};

const ranges: Partial<Record<keyof BusinessValuationInputs, string>> = {
  grossMargin:        "Typical: 40–80% for software, 20–50% for services",
  ebitdaMargin:       "Typical: 15–35% for profitable businesses",
  netMargin:          "Typical: 5–25% depending on industry",
  discountRate:       "Typical: 8–15% for private companies",
  terminalGrowthRate: "Typical: 2–4% (should be ≤ GDP growth)",
  revenueGrowth:      "Typical: 10–30% for growth-stage companies",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldLabel({ htmlFor, label, tooltip }: { htmlFor: string; label: string; tooltip?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground leading-none">
        {label}
      </Label>
      {tooltip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label={`Info: ${label}`}>
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function PercentField({
  id, label, value, onChange, min = 0, max = 100,
}: {
  id: keyof BusinessValuationInputs;
  label: string;
  value: number;
  onChange: (field: keyof BusinessValuationInputs, value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={String(id)} label={label} tooltip={tooltips[id]} />
        <span className="text-sm font-semibold text-foreground tabular-nums mb-2">{value}%</span>
      </div>
      <Slider
        min={min} max={max} step={0.5}
        value={[value]}
        onValueChange={([v]) => onChange(id, v)}
        className="touch-manipulation"
      />
      {ranges[id] && (
        <p className="text-[11px] text-muted-foreground pt-0.5">{ranges[id]}</p>
      )}
    </div>
  );
}

// ── Main form ──────────────────────────────────────────────────────────────────

const BusinessValuationInputForm = ({
  inputs, methods, onInputChange, onMethodChange, onCalculate, isCalculating,
}: BusinessValuationInputFormProps) => {
  const [step, setStep] = useState(0);
  const [revenueDisplay, setRevenueDisplay] = useState(
    inputs.currentRevenue ? inputs.currentRevenue.toLocaleString() : ""
  );
  const haptics = useHaptics();

  const isFormValid     = !!(inputs.industry && inputs.businessType && inputs.currentRevenue);
  const hasValidMethods = Object.values(methods).some(Boolean);
  const step1Valid      = !!(inputs.industry && inputs.businessType);
  const step2Valid      = inputs.currentRevenue > 0;

  const canJump = (i: number) =>
    i < step || (i === 1 && step1Valid) || (i === 2 && step1Valid && step2Valid);

  const handleMethodChange = (method: keyof ValuationMethods, checked: boolean) => {
    if (!checked && Object.values(methods).filter(Boolean).length <= 1) return;
    onMethodChange(method, checked);
  };

  const handleRevenueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    const num = raw === "" ? 0 : parseInt(raw, 10);
    setRevenueDisplay(raw === "" ? "" : num.toLocaleString());
    onInputChange("currentRevenue", num);
  };

  const goNext = () => { haptics.tap(); setStep(s => s + 1); };
  const goBack = () => { haptics.tick(); setStep(s => s - 1); };
  const goStep = (i: number) => { if (canJump(i)) { haptics.tick(); setStep(i); } };

  // ── Steps ────────────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor="industry" label="Industry" />
        <Select value={inputs.industry} onValueChange={v => onInputChange("industry", v)}>
          <SelectTrigger id="industry" className="h-12 text-base rounded-xl border-border/70 bg-background">
            <SelectValue placeholder="Select your industry" />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            {industryOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <FieldLabel htmlFor="businessType" label="Business Type" />
        <Select value={inputs.businessType} onValueChange={v => onInputChange("businessType", v)}>
          <SelectTrigger id="businessType" className="h-12 text-base rounded-xl border-border/70 bg-background">
            <SelectValue placeholder="Select business model" />
          </SelectTrigger>
          <SelectContent className="bg-background border z-50">
            {businessTypeOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <FieldLabel htmlFor="revenue" label="Current Annual Revenue" />
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none select-none">$</span>
          <Input
            id="revenue"
            inputMode="numeric"
            placeholder="0"
            value={revenueDisplay}
            onChange={handleRevenueChange}
            className="pl-8 h-12 text-base rounded-xl border-border/70"
          />
        </div>
        {inputs.currentRevenue > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1">
            = ${inputs.currentRevenue.toLocaleString()} per year
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <FieldLabel htmlFor="exitTimeframe" label="Exit Timeframe" />
          <span className="text-sm font-semibold text-foreground tabular-nums mb-2">{inputs.exitTimeframe} yrs</span>
        </div>
        <Slider
          min={1} max={10} step={1}
          value={[inputs.exitTimeframe]}
          onValueChange={([v]) => onInputChange("exitTimeframe", v)}
          className="touch-manipulation"
        />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>1 yr</span><span>10 yrs</span>
        </div>
      </div>

      <PercentField id="revenueGrowth" label="Annual Revenue Growth" value={inputs.revenueGrowth} onChange={onInputChange} min={0}   max={100} />
      <PercentField id="grossMargin"   label="Gross Margin"           value={inputs.grossMargin}   onChange={onInputChange} min={0}   max={100} />
      <PercentField id="ebitdaMargin"  label="EBITDA Margin"          value={inputs.ebitdaMargin}  onChange={onInputChange} min={-20} max={80}  />
      <PercentField id="netMargin"     label="Net Profit Margin"      value={inputs.netMargin}     onChange={onInputChange} min={-20} max={60}  />
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="space-y-5">
        <PercentField id="discountRate"       label="Discount Rate"        value={inputs.discountRate}       onChange={onInputChange} min={5}  max={30} />
        <PercentField id="terminalGrowthRate" label="Terminal Growth Rate" value={inputs.terminalGrowthRate} onChange={onInputChange} min={0}  max={10} />
      </div>

      <div className="space-y-3 pt-1 border-t border-border/50">
        <div>
          <p className="text-sm font-semibold text-foreground">Valuation Methods</p>
          <p className="text-xs text-muted-foreground mt-0.5">Select at least one method</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {([
            ["revenueMultiple", "Revenue Multiple"],
            ["ebitdaMultiple",  "EBITDA Multiple"],
            ["peMultiple",      "P/E Multiple"],
            ["dcf",             "Discounted Cash Flow"],
          ] as [keyof ValuationMethods, string][]).map(([key, label]) => (
            <label
              key={key}
              className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                methods[key]
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-border/60 bg-muted/20 hover:bg-muted/40"
              }`}
            >
              <Checkbox
                id={key}
                checked={methods[key]}
                onCheckedChange={c => handleMethodChange(key, !!c)}
                className="shrink-0"
              />
              <span className="text-xs font-medium leading-snug">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <Card className="overflow-hidden border-border/60">
        {/* Header */}
        <CardHeader className="pb-5 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground leading-tight">Business Valuation</p>
              <p className="text-xs text-muted-foreground mt-0.5">Multi-method valuation report</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="relative">
            {/* Track background */}
            <div className="absolute top-4 left-4 right-4 h-0.5 rounded-full bg-border" />
            {/* Track fill */}
            <div
              className="absolute top-4 left-4 h-0.5 rounded-full bg-primary transition-all duration-300"
              style={{
                width: step === 0
                  ? 0
                  : `calc(${(step / (STEPS.length - 1)) * 100}% - ${(step / (STEPS.length - 1)) * 32}px)`,
              }}
            />
            {/* Nodes */}
            <div className="relative flex justify-between">
              {STEPS.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => goStep(i)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                      i < step
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : i === step
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-background border-2 border-border text-muted-foreground"
                    } ${canJump(i) && i !== step ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                    aria-current={i === step ? "step" : undefined}
                  >
                    {i < step ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
                  </button>
                  <span className={`text-[10px] font-medium text-center leading-tight transition-colors ${
                    i === step ? "text-foreground" : "text-muted-foreground"
                  }`}>
                    {SHORT[i]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}

          {/* Navigation */}
          <div className="flex gap-3 pt-1">
            {step > 0 && (
              <Button
                variant="outline"
                onClick={goBack}
                className="flex items-center gap-1.5 rounded-xl border-border/70 h-12 px-4"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button
                className="flex-1 h-12 text-base rounded-xl flex items-center justify-center gap-2 font-semibold"
                disabled={step === 0 ? !step1Valid : !step2Valid}
                onClick={goNext}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 h-12 text-base rounded-xl flex items-center justify-center gap-2 font-semibold"
                disabled={!isFormValid || !hasValidMethods || isCalculating}
                onClick={() => { haptics.success(); onCalculate(); }}
              >
                <Calculator className="h-4 w-4" />
                {isCalculating ? "Calculating…" : "Generate Report"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default BusinessValuationInputForm;
