import { Brain, Search, PieChart, Eye, Activity, PiggyBank, DollarSign, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/somatech/AuthProvider";
import { useNavigation } from "@/contexts/NavigationContext";
import { useCoachProfile } from "@/hooks/useCoachProfile";
import type { FinancialProfile } from "@/services/coachService";

type QuickAction = { label: string; icon: React.ElementType; id: string };

const DEFAULT_ACTIONS: QuickAction[] = [
  { label: "Stock Analysis", icon: Search,   id: "stock-analysis" },
  { label: "Portfolio",      icon: PieChart, id: "portfolio" },
  { label: "Watchlist",      icon: Eye,      id: "watchlist" },
  { label: "Options",        icon: Activity, id: "options-dashboard" },
];

function getActionsForProfile(profile: FinancialProfile): QuickAction[] {
  const concern = profile.primary_concern;
  if (concern === "buying-home") return [
    { label: "Financial Coach", icon: Brain,     id: "financial-coach" },
    { label: "Retirement",      icon: PiggyBank, id: "retirement-planning" },
    { label: "Portfolio",       icon: PieChart,  id: "portfolio" },
    { label: "Watchlist",       icon: Eye,       id: "watchlist" },
  ];
  if (concern === "retirement") return [
    { label: "Financial Coach", icon: Brain,     id: "financial-coach" },
    { label: "Retirement",      icon: PiggyBank, id: "retirement-planning" },
    { label: "Portfolio",       icon: PieChart,  id: "portfolio" },
    { label: "Watchlist",       icon: Eye,       id: "watchlist" },
  ];
  if (concern === "debt") return [
    { label: "Financial Coach", icon: Brain,      id: "financial-coach" },
    { label: "Cash Flow",       icon: DollarSign, id: "cash-flow" },
    { label: "Portfolio",       icon: PieChart,   id: "portfolio" },
    { label: "Watchlist",       icon: Eye,        id: "watchlist" },
  ];
  if (concern === "investing" || concern === "saving-more") return [
    { label: "Stock Analysis",  icon: Search,    id: "stock-analysis" },
    { label: "Portfolio",       icon: PieChart,  id: "portfolio" },
    { label: "Watchlist",       icon: Eye,       id: "watchlist" },
    { label: "Financial Coach", icon: Brain,     id: "financial-coach" },
  ];
  if (concern === "tax") return [
    { label: "Financial Coach", icon: Brain,      id: "financial-coach" },
    { label: "Portfolio",       icon: PieChart,   id: "portfolio" },
    { label: "Cash Flow",       icon: DollarSign, id: "cash-flow" },
    { label: "Watchlist",       icon: Eye,        id: "watchlist" },
  ];
  return DEFAULT_ACTIONS;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function WelcomeSection() {
  const { user, profile: authProfile } = useAuth();
  const { navigateToModule } = useNavigation();
  const { profile } = useCoachProfile();

  // Anonymous users get a journey CTA instead of the personalised greeting
  if (!user) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 to-coach/5 px-5 py-5 shadow-elev-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-snug">What's your financial goal?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick a path and get a personalised plan in 2 minutes — no account needed.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          className="gap-1.5 shrink-0 rounded-xl"
          onClick={() => window.dispatchEvent(new CustomEvent('somatech:open-journey'))}
        >
          Start my journey
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const name = profile?.display_name
    || authProfile?.username
    || user?.user_metadata?.full_name?.split(" ")[0]
    || null;

  const actions = profile?.primary_concern ? getActionsForProfile(profile) : DEFAULT_ACTIONS;
  const primaryAction = actions[0];
  const PrimaryIcon = primaryAction.icon;

  const concernLabel = profile?.primary_concern
    ? profile.primary_concern.replace(/-/g, " ")
    : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      {/* Hero greeting */}
      <div>
        <p className="label-wide text-primary mb-1.5">{getGreeting()}</p>
        <h1 className="heading-tight text-3xl sm:text-4xl font-bold text-foreground leading-none">
          {name ?? "Welcome back"}
        </h1>
        {concernLabel && (
          <p className="text-sm text-muted-foreground mt-2">
            Focused on <span className="text-foreground font-medium">{concernLabel}</span>
          </p>
        )}
      </div>

      {/* Keep one clear next step, with secondary destinations close at hand. */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => navigateToModule(primaryAction.id)}
          className="gap-1.5 rounded-xl px-4 h-9 text-xs shadow-glow-primary/40 hover:-translate-y-px transition-transform"
        >
          <PrimaryIcon className="h-3.5 w-3.5" />
          Next: {primaryAction.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        {actions.slice(1, 3).map(({ label, icon: Icon, id }) => (
          <Button
            key={id}
            variant="outline"
            size="sm"
            onClick={() => navigateToModule(id)}
            className="gap-1.5 rounded-xl px-3 h-9 text-xs hover:-translate-y-px transition-transform"
          >
            <Icon className="h-3 w-3" />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
