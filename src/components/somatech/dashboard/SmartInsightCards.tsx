import { useCoachProfile } from "@/hooks/useCoachProfile";
import type { FinancialProfile } from "@/services/coachService";
import { useNavigation } from "@/contexts/NavigationContext";
import { useHaptics } from "@/hooks/useHaptics";
import { TrendingUp, AlertTriangle, Shield, Gift, ChevronRight, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersonalFinance } from "@/hooks/usePersonalFinance";
import { useTransactions } from "@/hooks/useTransactions";
import { computeInsights } from "@/lib/financialInsights";

interface Insight {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  message: string;
  moduleId?: string;
  urgent?: boolean;
}

function buildInsights(p: FinancialProfile): Insight[] {
  const insights: Insight[] = [];

  const surplus = p.monthly_take_home != null && p.monthly_expenses != null
    ? p.monthly_take_home - p.monthly_expenses
    : null;
  // `liquid_savings ?? 0` would render "unknown savings" as "0.0 months covered"
  // and fire the urgent card at someone who simply left the field blank.
  const emergencyMonths =
    p.monthly_expenses && p.liquid_savings != null
      ? p.liquid_savings / p.monthly_expenses
      : null;
  const highDebt = p.high_interest_debt ?? 0;

  if (highDebt > 0) {
    insights.push({
      id: "high-interest-debt",
      icon: AlertTriangle,
      iconColor: "text-destructive",
      iconBg: "bg-destructive/10",
      label: "High-interest debt detected",
      message: `$${highDebt.toLocaleString()} in high-interest debt costs you more than investing returns. Pay this first.`,
      moduleId: "financial-coach",
      urgent: true,
    });
  }

  if (emergencyMonths !== null && emergencyMonths < 3) {
    insights.push({
      id: "emergency-fund",
      icon: Shield,
      iconColor: "text-warning-foreground",
      iconBg: "bg-warning/10",
      label: "Emergency fund below target",
      message: `Your fund covers ${emergencyMonths.toFixed(1)} months — aim for 3–6 months of expenses ($${((p.monthly_expenses ?? 0) * 3).toLocaleString()}).`,
      moduleId: "financial-coach",
      urgent: true,
    });
  }

  if ((p.employer_match_pct ?? 0) > 0) {
    insights.push({
      id: "employer-match",
      icon: Gift,
      iconColor: "text-success",
      iconBg: "bg-success/10",
      label: "Employer match available",
      message: `Your employer matches up to ${p.employer_match_pct}% — contribute at least that amount to claim free money.`,
      moduleId: "financial-coach",
    });
  }

  if (surplus != null && surplus > 200) {
    insights.push({
      id: "surplus",
      icon: TrendingUp,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
      label: `$${surplus.toLocaleString()}/mo surplus`,
      message: `You have $${surplus.toLocaleString()} left each month — your roadmap will show exactly where to deploy it.`,
      moduleId: "financial-coach",
    });
  }

  return insights;
}

export default function SmartInsightCards() {
  const { navigateToModule } = useNavigation();
  const haptics = useHaptics();
  const { profile, isLoading, error: profileError } = useCoachProfile();
  const finance = usePersonalFinance();
  const txns    = useTransactions();

  const profileInsights = profile?.snapshot_completed ? buildInsights(profile) : [];

  // Merge profile insights with transaction-level insights from the PF engine
  const txInsights = !finance.isDemo && txns.allTransactions.length > 0
    ? computeInsights(finance.snapshots, finance.cashFlows, txns.allTransactions)
        .filter(i => i.severity === 'warning')
        .slice(0, 2)
        .map(i => ({
          id:        i.id,
          icon:      AlertTriangle,
          iconColor: 'text-warning',
          iconBg:    'bg-warning/10',
          label:     i.title,
          message:   i.detail,
          moduleId:  'personal-finance' as const,
          urgent:    false,
        }))
    : [];

  const dataError = profileError || finance.loadError || txns.error;
  const availabilityInsight: Insight[] = dataError ? [{
    id: 'insight-data-unavailable',
    icon: AlertTriangle,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    label: 'Some insights are unavailable',
    message: 'Account data could not be fully loaded, so SomaTech is not claiming your finances are clear.',
    moduleId: 'personal-finance',
  }] : [];
  const insights = [
    ...profileInsights,
    ...txInsights.filter(ti => !profileInsights.some(pi => pi.id === ti.id)),
    ...availabilityInsight,
  ].slice(0, 4);

  if (insights.length === 0) {
    // Still loading or user hasn't completed snapshot — return null to avoid flicker
    if (isLoading || finance.isLoading || txns.isLoading || !profile?.snapshot_completed) return null;

    // Snapshot complete and every contributing source loaded without error.
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3.5 animate-fade-in">
        <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="h-4 w-4 text-accent" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground heading-tight">No rule-based alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">No issues were identified from the financial fields currently available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="label-wide text-muted-foreground px-0.5">Insights</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {insights.map((insight) => {
          const Icon = insight.icon;
          return (
            <button
              key={insight.id}
              onClick={() => { if (insight.moduleId) { haptics.tap(); navigateToModule(insight.moduleId); } }}
              className={cn(
                "group flex items-start gap-3 rounded-xl border p-4 text-left hover-lift",
                insight.urgent
                  ? "border-l-2 border-l-destructive border-border/40 bg-destructive/5"
                  : "border-border/60 bg-card/80 backdrop-blur-sm"
              )}
            >
              <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", insight.iconBg)}>
                <Icon className={cn("h-4 w-4", insight.iconColor)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground heading-tight">{insight.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.message}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
