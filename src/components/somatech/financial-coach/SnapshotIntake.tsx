import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, AlertCircle, Loader2, Link2, TrendingDown, TrendingUp } from "lucide-react";
import { useConnectedFinancials } from "@/hooks/useConnectedFinancials";
import type { FinancialProfile } from "@/services/coachService";

interface SnapshotIntakeProps {
  profile: FinancialProfile;
  onSave: (snapshot: Partial<FinancialProfile>) => Promise<void>;
}

interface SnapshotForm {
  monthly_take_home: string;
  monthly_expenses: string;
  high_interest_debt: string;
  low_interest_debt: string;
  liquid_savings: string;
  employer_match_pct: string;
  has_hsa_access: boolean;
}

const DEFAULT_FORM: SnapshotForm = {
  monthly_take_home: "",
  monthly_expenses: "",
  high_interest_debt: "",
  low_interest_debt: "",
  liquid_savings: "",
  employer_match_pct: "",
  has_hsa_access: false,
};

function parseAmount(raw: string): number {
  return Math.round(parseFloat(raw.replace(/[^0-9.]/g, "")) || 0);
}

/**
 * For the fields the form does not require. Blank must persist as null, not 0:
 * the roadmap reads `high_interest_debt === 0` as "this debt is paid off", so a
 * blank box would silently complete milestones the user never claimed.
 */
function parseOptionalAmount(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

const usd = (value: number) =>
  value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** One known figure, with the account kind that supplied it. */
function KnownRow({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-muted-foreground">
        {label}
        {note && <span className="ml-1 text-[10px] opacity-70">{note}</span>}
      </span>
      <span className="font-mono tabular-nums font-medium">{usd(value)}</span>
    </div>
  );
}

export default function SnapshotIntake({ profile, onSave }: SnapshotIntakeProps) {
  const [form, setForm] = useState<SnapshotForm>(() => ({
    monthly_take_home: profile.monthly_take_home ? String(profile.monthly_take_home) : "",
    monthly_expenses: profile.monthly_expenses ? String(profile.monthly_expenses) : "",
    high_interest_debt: profile.high_interest_debt ? String(profile.high_interest_debt) : "",
    low_interest_debt: profile.low_interest_debt ? String(profile.low_interest_debt) : "",
    liquid_savings: profile.liquid_savings ? String(profile.liquid_savings) : "",
    employer_match_pct: profile.employer_match_pct ? String(profile.employer_match_pct) : "",
    has_hsa_access: profile.has_hsa_access ?? false,
  }));

  const connected = useConnectedFinancials();
  // Connected data resolves after the first render, so the initialiser above
  // cannot use it. Fill only blanks, only once, and never over something the
  // user or an earlier journey already put there.
  const autofilled = useRef(false);
  useEffect(() => {
    if (autofilled.current || connected.loading || !connected.hasAny) return;
    autofilled.current = true;
    setForm((prev) => {
      const next = { ...prev };
      const fill = (key: keyof SnapshotForm, value: number | null) => {
        if (value == null) return;
        if (prev[key] !== "") return;
        (next[key] as string) = String(Math.round(value));
      };
      fill("monthly_take_home", connected.monthlyIncomeUsd);
      fill("monthly_expenses", connected.monthlyExpensesUsd);
      fill("high_interest_debt", connected.creditCardsUsd);
      fill("low_interest_debt", connected.studentLoansUsd);
      fill("liquid_savings", connected.liquidSavingsUsd);
      return next;
    });
  }, [connected]);

  /** Overwrite every knowable field with what the accounts report. */
  const useConnectedValues = () => {
    setForm((prev) => ({
      ...prev,
      monthly_take_home: connected.monthlyIncomeUsd != null ? String(Math.round(connected.monthlyIncomeUsd)) : prev.monthly_take_home,
      monthly_expenses: connected.monthlyExpensesUsd != null ? String(Math.round(connected.monthlyExpensesUsd)) : prev.monthly_expenses,
      high_interest_debt: connected.creditCardsUsd != null ? String(Math.round(connected.creditCardsUsd)) : prev.high_interest_debt,
      low_interest_debt: connected.studentLoansUsd != null ? String(Math.round(connected.studentLoansUsd)) : prev.low_interest_debt,
      liquid_savings: connected.liquidSavingsUsd != null ? String(Math.round(connected.liquidSavingsUsd)) : prev.liquid_savings,
    }));
  };

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field: keyof SnapshotForm, value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const validate = (): boolean => {
    const takeHome = parseAmount(form.monthly_take_home);
    const expenses = parseAmount(form.monthly_expenses);
    if (!takeHome) { setError("Monthly take-home is required."); return false; }
    if (!expenses) { setError("Monthly expenses are required."); return false; }
    // A deficit is not an input error. Spending more than you earn is a real
    // financial state — and the one the early roadmap phases exist to address.
    // Rejecting it here left anyone in that position unable to save the form at
    // all, and therefore unable to reach the roadmap.
    setError("");
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        monthly_take_home: parseAmount(form.monthly_take_home),
        monthly_expenses: parseAmount(form.monthly_expenses),
        high_interest_debt: parseOptionalAmount(form.high_interest_debt),
        low_interest_debt: parseOptionalAmount(form.low_interest_debt),
        liquid_savings: parseOptionalAmount(form.liquid_savings),
        employer_match_pct: (() => {
          const pct = parseOptionalAmount(form.employer_match_pct);
          return pct == null ? null : Math.min(100, pct);
        })(),
        has_hsa_access: form.has_hsa_access,
        snapshot_completed: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const takeHome = parseAmount(form.monthly_take_home);
  const expenses = parseAmount(form.monthly_expenses);
  // Signed, not clamped. A deficit is the more important number to show, and
  // hiding it left the form silent for exactly the users who most need telling.
  const monthlySurplus = takeHome > 0 && expenses > 0 ? takeHome - expenses : null;

  return (
    <div className="max-w-lg mx-auto space-y-4 px-1">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Financial Snapshot</h2>
        <p className="text-sm text-muted-foreground">
          {connected.hasAny
            ? "Filled in from your connected accounts where we could. Correct anything that looks wrong — what you type wins."
            : "These 7 numbers let us personalise your roadmap timeline and prioritise the right next steps."}
        </p>
      </div>

      {connected.hasAny && (
        <Card className="border-primary/25 bg-primary/[0.03]">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4 text-primary" />
                From your connected accounts
              </CardTitle>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                onClick={useConnectedValues}>
                Use these values
              </Button>
            </div>
            {connected.asOf && (
              <CardDescription className="text-[11px]">
                As of {new Date(`${connected.asOf.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-1.5 pb-3">
            {connected.monthlyIncomeUsd != null && <KnownRow label="Income this month" value={connected.monthlyIncomeUsd} />}
            {connected.monthlyExpensesUsd != null && <KnownRow label="Spending this month" value={connected.monthlyExpensesUsd} />}
            {connected.liquidSavingsUsd != null && <KnownRow label="Cash (checking + savings)" value={connected.liquidSavingsUsd} />}
            {connected.investmentsUsd != null && (
              <KnownRow
                label="Invested"
                value={connected.investmentsUsd}
                note={connected.brokerageUsd != null ? `incl. ${usd(connected.brokerageUsd)} at your brokerage` : undefined}
              />
            )}
            {connected.creditCardsUsd != null && <KnownRow label="Credit card balances" value={connected.creditCardsUsd} />}
            {connected.studentLoansUsd != null && <KnownRow label="Student loans" value={connected.studentLoansUsd} />}
            <p className="pt-1 text-[11px] text-muted-foreground">
              Invested balances are shown for context — the roadmap asks for cash separately,
              since an emergency fund you have to sell shares to reach is not an emergency fund.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Income & Spending */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Income &amp; Spending
          </CardTitle>
          <CardDescription className="text-xs">Monthly after-tax figures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field
            id="take_home"
            label="Monthly take-home (after tax)"
            placeholder="e.g. 4500"
            prefix="$"
            value={form.monthly_take_home}
            onChange={(v) => set("monthly_take_home", v)}
          />
          <Field
            id="expenses"
            label="Monthly essential expenses"
            placeholder="e.g. 3200"
            prefix="$"
            hint="Rent, groceries, utilities, transport — not discretionary"
            value={form.monthly_expenses}
            onChange={(v) => set("monthly_expenses", v)}
          />
          {monthlySurplus != null && monthlySurplus >= 0 && (
            <div className="flex items-center gap-2 text-xs text-accent dark:text-accent bg-emerald-50 dark:bg-emerald-950/30 rounded-md px-3 py-2">
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              Monthly surplus: <span className="font-semibold">${monthlySurplus.toLocaleString()}</span>
              &nbsp;(~${Math.round(monthlySurplus / 4.33).toLocaleString()}/wk)
            </div>
          )}
          {monthlySurplus != null && monthlySurplus < 0 && (
            <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded-md px-3 py-2">
              <TrendingDown className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Monthly shortfall: <span className="font-semibold">${Math.abs(monthlySurplus).toLocaleString()}</span>.
                You can still save this — closing a gap like this is what the first
                roadmap phase is for. Double-check the numbers if it looks wrong.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Debt Balances</CardTitle>
          <CardDescription className="text-xs">Leave at 0 if none</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field
            id="high_debt"
            label="High-interest debt (credit cards, payday)"
            placeholder="0"
            prefix="$"
            hint="Anything above ~8% APR"
            value={form.high_interest_debt}
            onChange={(v) => set("high_interest_debt", v)}
          />
          <Field
            id="low_debt"
            label="Low-interest debt (student loans, car)"
            placeholder="0"
            prefix="$"
            hint="Below ~8% APR"
            value={form.low_interest_debt}
            onChange={(v) => set("low_interest_debt", v)}
          />
        </CardContent>
      </Card>

      {/* Savings & Benefits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Savings &amp; Benefits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            id="savings"
            label="Liquid savings (checking + HYSA)"
            placeholder="0"
            prefix="$"
            hint="Excludes retirement accounts and brokerage"
            value={form.liquid_savings}
            onChange={(v) => set("liquid_savings", v)}
          />
          <Field
            id="match"
            label="Employer 401(k) match"
            placeholder="0"
            suffix="%"
            hint="e.g. 4 means they match up to 4% of salary"
            value={form.employer_match_pct}
            onChange={(v) => set("employer_match_pct", v)}
          />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm">HSA access</Label>
              <p className="text-xs text-muted-foreground">
                Do you have a high-deductible health plan with HSA?
              </p>
            </div>
            <Switch
              checked={form.has_hsa_access}
              onCheckedChange={(v) => set("has_hsa_access", v)}
            />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
        {saving ? "Saving…" : "Save & Build My Roadmap"}
      </Button>
    </div>
  );
}

// ── Field sub-component ────────────────────────────────────────────────────────

interface FieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
}

function Field({ id, label, placeholder, value, onChange, prefix, suffix, hint }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{prefix}</span>
        )}
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={prefix ? "pl-7" : suffix ? "pr-7" : ""}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{suffix}</span>
        )}
      </div>
    </div>
  );
}
