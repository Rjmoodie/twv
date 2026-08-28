import type { LucideIcon } from "lucide-react";
import { TrendingUp, Calculator, Building, PiggyBank, Home, Star, FileText, BarChart3, Zap, PieChart, Building2 } from "lucide-react";

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  module: string;
  floating?: boolean;
}

export const quickActions: QuickAction[] = [
  {
    id: 'analyze-stock',
    title: 'Analyze Stock',
    description: 'Get DCF valuation for any stock',
    icon: TrendingUp,
    color: 'from-blue-500 to-blue-600',
    module: 'stock-analysis'
  },
  {
    id: 'add-watchlist',
    title: 'Add to Watchlist',
    description: 'Save stocks for tracking',
    icon: Star,
    color: 'from-yellow-500 to-yellow-600',
    module: 'watchlist'
  },
  {
    id: 'business-valuation',
    title: 'Value Business',
    description: 'Comprehensive business analysis',
    icon: Building,
    color: 'from-purple-500 to-purple-600',
    module: 'business-valuation'
  },
  {
    id: 'cash-flow',
    title: 'Cash Flow Model',
    description: 'Project future cash flows',
    icon: BarChart3,
    color: 'from-green-500 to-green-600',
    module: 'cash-flow'
  },
  {
    id: 'retirement-plan',
    title: 'Retirement Planning',
    description: 'Plan your financial future',
    icon: PiggyBank,
    color: 'from-emerald-500 to-emerald-600',
    module: 'retirement-planning'
  },
  {
    id: 'lead-gen',
    title: 'Lead Generation & Analysis',
    description: 'Find properties and analyze investments',
    icon: Home,
    color: 'from-orange-500 to-orange-600',
    module: 'lead-gen'
  },
  // For FloatingActionMenu (shorter set)
  {
    id: 'floating-stock-analysis',
    title: 'Stock Analysis',
    description: '',
    icon: TrendingUp,
    color: 'from-green-500 to-emerald-600',
    module: 'stock-analysis',
    floating: true
  },
  {
    id: 'floating-cash-flow',
    title: 'Cash Flow',
    description: '',
    icon: Calculator,
    color: 'from-blue-500 to-cyan-600',
    module: 'cash-flow',
    floating: true
  },
  {
    id: 'floating-business-valuation',
    title: 'Business Valuation',
    description: '',
    icon: PieChart,
    color: 'from-purple-500 to-violet-600',
    module: 'business-valuation',
    floating: true
  },
  {
    id: 'floating-lead-gen',
    title: 'Lead Generation',
    description: '',
    icon: Building2,
    color: 'from-orange-500 to-red-600',
    module: 'lead-gen',
    floating: true
  }
]; 