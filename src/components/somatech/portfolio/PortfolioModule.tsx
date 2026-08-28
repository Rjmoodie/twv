import { usePortfolio } from '@/contexts/PortfolioContext'
import { NavigationWrapper } from '@/components/somatech/navigation/NavigationWrapper'
import { modules } from '@/components/somatech/constants'
import PortfolioSetupWizard from './PortfolioSetupWizard'
import PortfolioDashboard from './PortfolioDashboard'
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/somatech/AuthProvider'
import { getActiveInvestmentGoal } from '@/services/investmentGoalService'

const module = modules.find((m) => m.id === 'portfolio')

export default function PortfolioModule() {
  const { user } = useAuth()
  const { portfolios, loading, error, refresh } = usePortfolio()
  const [creating, setCreating] = useState(false)
  const investmentGoalQuery = useQuery({
    queryKey: ['investment-goal', user?.id],
    queryFn: () => getActiveInvestmentGoal(user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  })

  const hasPortfolios = portfolios.length > 0

  // Only block on the first load. Gating on `loading` alone meant every
  // background refresh swapped the dashboard for a spinner, unmounting it --
  // which reset its tab state, so opening Brokerage bounced back to Deploy.
  if (!hasPortfolios && (loading || investmentGoalQuery.isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (error && portfolios.length === 0) {
    const offline = typeof navigator !== 'undefined' && !navigator.onLine
    return (
      <NavigationWrapper
        title={module?.name ?? 'Portfolio'}
        subtitle={module?.description ?? 'Goal-based portfolio management with EDGAR-backed research'}
        showBackButton={false}
        showBreadcrumbs={false}
      >
        <div className="mx-auto flex min-h-[360px] max-w-lg flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            {offline ? <WifiOff className="h-6 w-6 text-destructive" /> : <AlertTriangle className="h-6 w-6 text-destructive" />}
          </div>
          <h2 className="text-lg font-semibold">{offline ? 'Portfolio is unavailable offline' : 'Portfolio data could not be loaded'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {offline
              ? 'Reconnect and SomaTech will retry automatically. Your saved portfolio has not been changed.'
              : 'Your saved portfolio has not been changed. Check your connection and try loading it again.'}
          </p>
          <Button className="mt-5 gap-2" variant="outline" onClick={() => void refresh()} disabled={offline}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      </NavigationWrapper>
    )
  }

  return (
    <NavigationWrapper
      title={module?.name ?? 'Portfolio'}
      subtitle={module?.description ?? 'Goal-based portfolio management with EDGAR-backed research'}
      showBackButton={false}
      showBreadcrumbs={false}
    >
      <div className="space-y-6 animate-fade-in">
        {investmentGoalQuery.isError && (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium">Your investment goal could not be connected</p>
                <p className="text-xs text-muted-foreground">Portfolio data is still available, but goal projections may use the portfolio’s last saved settings.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void investmentGoalQuery.refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry goal sync
            </Button>
          </div>
        )}
        {error && (
          <div className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium">Showing the last loaded portfolio</p>
                <p className="text-xs text-muted-foreground">Refresh failed, so displayed values may be out of date.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry refresh
            </Button>
          </div>
        )}
        {!hasPortfolios || creating ? (
          <div className="max-w-2xl mx-auto">
            {hasPortfolios && (
              <div className="flex justify-end mb-4">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            )}
            <PortfolioSetupWizard investmentGoal={investmentGoalQuery.data ?? null} onComplete={() => setCreating(false)} />
          </div>
        ) : (
          <PortfolioDashboard
            investmentGoal={investmentGoalQuery.data ?? null}
            onNewPortfolio={() => setCreating(true)}
          />
        )}
      </div>
    </NavigationWrapper>
  )
}
