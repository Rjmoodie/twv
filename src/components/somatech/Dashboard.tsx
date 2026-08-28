import type { ReactNode } from "react";
import WelcomeSection from "./dashboard/WelcomeSection";
import FinancialPictureHero from "./dashboard/FinancialPictureHero";
import PortfolioWidget from "./dashboard/PortfolioWidget";
import MarketSnapshot from "./dashboard/MarketSnapshot";
import RatesSnapshot from "./dashboard/RatesSnapshot";
import BusinessPulse from "./dashboard/BusinessPulse";
import NextStepBanner from "./dashboard/NextStepBanner";
import SmartInsightCards from "./dashboard/SmartInsightCards";
import OnboardingChecklist from "./dashboard/OnboardingChecklist";
import ErrorBoundary from "./ErrorBoundary";
import { NavigationWrapper } from "./navigation/NavigationWrapper";
import { useDashboardData } from "./dashboard/useDashboardData";
import ActiveJourneyPlanCard from "./journey/ActiveJourneyPlanCard";

/**
 * One widget throwing used to take the whole home screen with it — the nearest
 * boundary was ModuleWrapper's, so a null dereference in, say, the portfolio
 * summary replaced the greeting, the net-worth hero and the onboarding
 * checklist with a single "Failed to load module" panel. Each section now fails
 * on its own.
 */
const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <ErrorBoundary inline label={label}>{children}</ErrorBoundary>
);

const Dashboard = () => {
  const { marketData, loading, error, warning, refresh } = useDashboardData();

  return (
    <NavigationWrapper
      title=""
      subtitle=""
      showBackButton={false}
      showBreadcrumbs={false}
    >
      <div className="space-y-5">

        {/* ── ABOVE THE FOLD — staggered rise-in, capped at 4 sections ───── */}

        <div className="animate-rise-in [animation-fill-mode:backwards]" style={{ animationDelay: '0ms' }}>
          <Section label="your dashboard greeting"><WelcomeSection /></Section>
        </div>

        <div className="animate-rise-in [animation-fill-mode:backwards]" style={{ animationDelay: '60ms' }}>
          <Section label="your financial picture"><FinancialPictureHero /></Section>
        </div>

        <div className="animate-rise-in [animation-fill-mode:backwards]" style={{ animationDelay: '120ms' }}>
          <Section label="your setup checklist"><OnboardingChecklist /></Section>
        </div>

        <div className="animate-rise-in [animation-fill-mode:backwards] space-y-5" style={{ animationDelay: '180ms' }}>
          <Section label="your insights"><SmartInsightCards /></Section>
          <Section label="your next step"><NextStepBanner /></Section>
          <Section label="your active journey"><ActiveJourneyPlanCard /></Section>
        </div>

        {/* ── PORTFOLIO / INVESTING ──────────────────────────────────────── */}

        {/* Portfolio summary — only shown when portfolio is set up */}
        <Section label="your portfolio summary"><PortfolioWidget /></Section>

        {/* ── RATES ──────────────────────────────────────────────────────── */}

        {/* Full width: policy, the Treasury curve and consumer borrowing costs
            all read across, and every one of them feeds a decision made
            elsewhere in the product — the BRRRR refinance rate, the DCF
            discount rate, whether to hold cash. */}
        <Section label="interest rates"><RatesSnapshot /></Section>

        {/* ── MARKET CONTEXT ─────────────────────────────────────────────── */}

        {/* Market overview grid — secondary information, below fold on mobile.
            Market quotes are third-party and the slowest thing on this screen,
            so they load in place. Gating the whole dashboard on them meant a
            stalled Alpha Vantage call hid the user's own numbers behind a
            skeleton — the very data that does not depend on the market. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {error ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border bg-card p-5 text-center">
              <p className="text-sm font-medium">Live market data is unavailable</p>
              <p className="mt-1 text-xs text-muted-foreground">Your personal dashboard remains available.</p>
              <button className="mt-3 text-xs font-medium text-primary hover:underline" onClick={() => void refresh()}>Try market data again</button>
            </div>
          ) : (
            <Section label="market data">
              <MarketSnapshot marketData={loading && !marketData ? null : marketData} warning={warning} />
            </Section>
          )}
          <Section label="the business pulse"><BusinessPulse /></Section>
        </div>

      </div>
    </NavigationWrapper>
  );
};

export default Dashboard;
