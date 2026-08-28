import type { ReactNode } from "react";
import RatesSnapshot from "./dashboard/RatesSnapshot";
import ErrorBoundary from "./ErrorBoundary";
import { NavigationWrapper } from "./navigation/NavigationWrapper";

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
 * The somatech dashboard was a personal-finance overview — net worth hero,
 * coach next-step, portfolio summary, market quotes. All of it was removed with
 * the non-real-estate cut. Rates are the one panel that survived on merit: the
 * policy rate, the Treasury curve and consumer borrowing costs feed the BRRRR
 * refinance assumption directly.
 *
 * This becomes the deal pipeline in Phase 1 and the portfolio view in Phase 2.
 */
const Dashboard = () => (
  <NavigationWrapper
    title=""
    subtitle=""
    showBackButton={false}
    showBreadcrumbs={false}
  >
    <div className="space-y-5">
      <Section label="interest rates"><RatesSnapshot /></Section>
    </div>
  </NavigationWrapper>
);

export default Dashboard;
