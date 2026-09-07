import type { ReactNode } from "react";
import RatesSnapshot from "./dashboard/RatesSnapshot";
import ErrorBoundary from "./ErrorBoundary";
import { NavigationWrapper } from "./navigation/NavigationWrapper";
import { useNavigation } from "@/contexts/NavigationContext";
import { useAuth } from "./AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Building2, Calculator, Headphones, Users } from "lucide-react";

/**
 * One widget throwing used to take the whole home screen with it — the nearest
 * boundary was ModuleWrapper's, so a null dereference in one section replaced
 * every other one with a single "Failed to load module" panel. Each section now
 * fails on its own.
 */
const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <ErrorBoundary inline label={label}>{children}</ErrorBoundary>
);

/**
 * Phase 0 home screen.
 *
 * The inherited dashboard was a personal-finance overview — net worth hero,
 * coach next-step, portfolio summary, market quotes. All of it was removed with
 * the non-real-estate cut. Rates are the one panel that survived on merit: the
 * policy rate, the Treasury curve and consumer borrowing costs feed the BRRRR
 * refinance assumption directly.
 *
 * The dashboard stays deliberately small: it supplies rate context and short
 * task paths, while project work remains in the Portfolio module.
 */
const Dashboard = () => {
  const { navigateToModule } = useNavigation();
  const { hasPersona } = useAuth();
  const isInternal = hasPersona('admin') || hasPersona('project_manager');
  const actions = [
    { id: 'portfolio', label: 'Open portfolio', detail: 'Projects, health, and next actions', icon: Building2 },
    ...(isInternal
      ? [
          { id: 'real-estate', label: 'Underwrite a deal', detail: 'Model a property and compare scenarios', icon: Calculator },
          { id: 'crm', label: 'Review relationships', detail: 'Follow-ups, contacts, and communication', icon: Users },
        ]
      : [{ id: 'support', label: 'Get support', detail: 'Help, FAQs, and contact information', icon: Headphones }]),
  ];

  return (
    <NavigationWrapper
      title="Operations overview"
      subtitle="Move into the work that needs attention, with current rate context alongside it."
      showBackButton={false}
      showBreadcrumbs={false}
    >
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Section label="interest rates"><RatesSnapshot /></Section>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Go straight to</CardTitle>
            <p className="text-xs leading-5 text-muted-foreground">Your most useful workspace paths.</p>
          </CardHeader>
          <CardContent className="space-y-1 px-3 pb-3">
            {actions.map(({ id, label, detail, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigateToModule(id)}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-background text-primary"><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <span className="mt-0.5 block text-xs leading-4 text-muted-foreground">{detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </NavigationWrapper>
  );
};

export default Dashboard;
