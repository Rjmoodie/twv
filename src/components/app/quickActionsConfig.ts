import type { LucideIcon } from "lucide-react";
import { Home, Building2, Calculator } from "lucide-react";

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  module: string;
  floating?: boolean;
}

/**
 * Shortcuts surfaced on the dashboard and in the floating action menu.
 *
 * The somatech set (analyse stock, watchlist, business valuation, cash flow
 * model, retirement) went with the non-real-estate cut. These `module` values
 * are navigated to directly and are NOT validated against the registry, so an
 * id for a deleted module produces a dead shortcut rather than a build error —
 * keep this list in step with `constants.ts` by hand.
 */
export const quickActions: QuickAction[] = [
  {
    id: 'underwrite-deal',
    title: 'Underwrite a Deal',
    description: 'BRRRR and traditional rental analysis',
    icon: Calculator,
    color: 'from-blue-500 to-blue-600',
    module: 'real-estate'
  },
  {
    id: 'portfolio',
    title: 'Operate the Portfolio',
    description: 'Act on project health, updates, and milestones',
    icon: Home,
    color: 'from-orange-500 to-orange-600',
    module: 'portfolio'
  },
  // For FloatingActionMenu (shorter set)
  {
    id: 'floating-real-estate',
    title: 'Underwriting',
    description: '',
    icon: Calculator,
    color: 'from-blue-500 to-cyan-600',
    module: 'real-estate',
    floating: true
  },
  {
    id: 'floating-portfolio',
    title: 'Portfolio',
    description: '',
    icon: Building2,
    color: 'from-orange-500 to-red-600',
    module: 'portfolio',
    floating: true
  }
];
