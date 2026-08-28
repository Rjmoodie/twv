import { Module } from "./types";
export const modules: Module[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Overview of your financial portfolio and market insights",
    icon: "LayoutDashboard",
    category: "overview",
    navGroup: "overview",
    featured: true,
    seo: {
      title: "Dashboard | SomaTech",
      description: "Overview of your financial portfolio and market insights. Track investments, monitor performance, and stay updated with the latest market trends on SomaTech.",
      keywords: "dashboard, financial overview, portfolio, market insights, investment tracking, SomaTech"
    }
  },
  {
    id: "financial-calendar",
    name: "Calendar",
    description: "Earnings, FDA actions, milestones, bills, and reminders in one calendar",
    icon: "Calendar",
    category: "overview",
    navGroup: "overview",
    featured: true,
    seo: {
      title: "Financial Calendar | SomaTech",
      description: "See earnings, FDA actions, journey milestones, savings targets, bills, and reminders in one calendar.",
      keywords: "financial calendar, earnings calendar, FDA actions, journey milestones, savings targets, reminders, SomaTech"
    }
  },
  {
    id: "stock-analysis",
    name: "Stock Analysis",
    description: "Comprehensive stock research and technical analysis",
    icon: "TrendingUp",
    category: "investing",
    navGroup: "investor",
    featured: true,
    seo: {
      title: "Stock Analysis | SomaTech",
      description: "Comprehensive stock research and technical analysis. Analyze stocks, trends, and market data to make informed investment decisions.",
      keywords: "stock analysis, technical analysis, stock research, market data, investment, SomaTech"
    }
  },
  {
    id: "options-dashboard",
    name: "Options Dashboard",
    description: "Professional-grade options analytics, flow, and strategy management",
    icon: "Activity",
    category: "investing",
    navGroup: "investor",
    featured: true,
    seo: {
      title: "Options Dashboard | SomaTech",
      description: "Visualize open option positions, monitor unusual flow, and generate premium-selling playbooks aligned to your risk profile.",
      keywords: "options trading, options dashboard, greeks, unusual options flow, options strategies, SomaTech"
    }
  },
  // {
  //   id: "trades-dashboard",
  //   name: "Trades Dashboard",
  //   description: "Monitor your current trades with entry/exit analysis and performance metrics",
  //   icon: "BarChart3",
  //   category: "investing",
  //   navGroup: "financial",
  //   featured: true,
  //   seo: {
  //     title: "Trades Dashboard | SomaTech",
  //     description: "Monitor your current trades with real-time analysis, entry/exit tracking, and performance metrics.",
  //     keywords: "trades dashboard, trading analysis, entry exit tracking, performance metrics, SomaTech"
  //   }
  // },
  {
    id: "pdufa",
    name: "PDUFA",
    description: "FDA Prescription Drug User Fee Act decision dates and alerts",
    icon: "Calendar",
    category: "investing",
    navGroup: "investor",
    featured: true,
    seo: {
      title: "PDUFA Calendar | SomaTech",
      description: "Track FDA Prescription Drug User Fee Act decision dates with automated alerts and real-time updates. Monitor biotech and pharmaceutical company regulatory milestones.",
      keywords: "PDUFA, FDA calendar, drug approval dates, biotech, pharmaceutical, regulatory milestones, FDA decisions, SomaTech"
    }
  },
  {
    id: "earnings",
    name: "Earnings",
    description: "Track quarterly earnings announcements and financial results",
    icon: "DollarSign",
    category: "investing",
    navGroup: "investor",
    featured: true,
    seo: {
      title: "Earnings Calendar | SomaTech",
      description: "Track quarterly earnings announcements and financial results with real-time updates. Monitor earnings dates, estimates, and actual results for informed investment decisions.",
      keywords: "earnings calendar, quarterly earnings, earnings announcements, financial results, earnings dates, stock earnings, SomaTech"
    }
  },
  {
    id: "watchlist",
    name: "Watchlist",
    description: "Track your favorite stocks and market movements",
    icon: "Eye",
    category: "investing",
    navGroup: "investor",
    featured: false,
    seo: {
      title: "Watchlist | SomaTech",
      description: "Track your favorite stocks and market movements. Create and manage your personalized watchlist for timely investment decisions.",
      keywords: "watchlist, stock tracking, market movements, investment, personalized watchlist, SomaTech"
    }
  },
  {
    id: "business-valuation",
    name: "Valuation",
    description: "Professional business valuation and analysis tools",
    icon: "Building2",
    category: "business",
    navGroup: "real-estate",
    featured: true,
    seo: {
      title: "Business Valuation | SomaTech",
      description: "Professional business valuation and analysis tools. Get accurate, real-time valuations for startups, SaaS, and more.",
      keywords: "business valuation, valuation tools, startup valuation, SaaS valuation, financial analysis, SomaTech"
    }
  },
  {
    id: "personal-finance",
    name: "Insights",
    description: "Net worth tracker, monthly cash flow, category breakdown, and scenario modeler",
    icon: "BarChart3",
    category: "planning",
    navGroup: "planner",
    featured: true,
    seo: {
      title: "Personal Finance | SomaTech",
      description: "Track your net worth, cash flow, and spending. Model future scenarios — job loss, big purchases, aggressive saving. Powered by your real financial data.",
      keywords: "personal finance dashboard, net worth tracker, cash flow, budget, scenario modeling, FP&A, SomaTech"
    }
  },
  {
    id: "cash-flow",
    name: "Cash Flow",
    description: "Model and analyze business cash flows",
    icon: "DollarSign",
    category: "business",
    navGroup: "planner",
    featured: false,
    seo: {
      title: "Cash Flow Simulator | SomaTech",
      description: "Model and analyze business cash flows. Simulate scenarios and optimize your company's financial health with SomaTech.",
      keywords: "cash flow, cash flow simulator, business analysis, financial modeling, scenario simulation, SomaTech"
    }
  },
  {
    id: "retirement-planning",
    name: "Retirement",
    description: "Plan your financial future with retirement tools",
    icon: "Calendar",
    category: "planning",
    navGroup: "planner",
    featured: false,
    seo: {
      title: "Retirement Planning | SomaTech",
      description: "Plan your financial future with retirement tools. Calculate retirement needs, analyze savings strategies, and optimize your retirement plan.",
      keywords: "retirement planning, retirement calculator, financial planning, retirement savings, investment planning, SomaTech"
    }
  },
  {
    id: "account",
    name: "Account",
    description: "Manage your account settings and preferences",
    icon: "User",
    category: "account",
    navGroup: "account",
    featured: false,
    seo: {
      title: "Account | SomaTech",
      description: "Manage your account settings and preferences. Update your profile, security settings, and account information.",
      keywords: "account, settings, profile, security, preferences, SomaTech"
    }
  },
  {
    id: "support",
    name: "Support",
    description: "Help, FAQ, and legal information",
    icon: "HelpCircle",
    category: "account",
    navGroup: "account",
    featured: false,
    seo: {
      title: "Support | SomaTech",
      description: "Get help, read the FAQ, and access legal information.",
      keywords: "support, help, FAQ, SomaTech"
    }
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Goal-based portfolio management with EDGAR-backed research scoring",
    icon: "PieChart",
    category: "investing",
    navGroup: "investor",
    featured: true,
    seo: {
      title: "Portfolio | SomaTech",
      description: "Design goal-based portfolios and score investment candidates using Piotroski F-Score, Greenblatt ROIC, and SEC EDGAR financial data.",
      keywords: "portfolio management, investment research, Piotroski, EDGAR, quality investing, SomaTech"
    }
  },
  {
    id: "journey",
    name: "Journey",
    description: "Pick your financial goal and get a personalised step-by-step plan",
    icon: "Map",
    category: "planning",
    navGroup: "overview",
    featured: true,
    seo: {
      title: "Financial Journey | SomaTech",
      description: "Choose your financial goal and get a personalised roadmap. Debt freedom, investing, home buying, business growth — start your journey.",
      keywords: "financial journey, financial goals, personal finance plan, debt freedom, home buying, SomaTech"
    }
  },
  {
    id: "community",
    name: "Community",
    description: "Real progress from people on the same path — no balances, no advice",
    icon: "Users",
    category: "social",
    navGroup: "overview",
    featured: false,
    seo: {
      title: "Journey Moments | SomaTech Community",
      description: "See how people like you are making financial progress. Share milestones anonymously — privacy-safe, no balances, no advice.",
      keywords: "financial progress, journey moments, financial community, SomaTech"
    }
  },
  {
    id: "financial-coach",
    name: "Coach",
    description: "AI-powered coaching built on academic research — personalised to your profile",
    icon: "Brain",
    category: "planning",
    navGroup: "planner",
    featured: true,
    seo: {
      title: "Financial Coach | SomaTech",
      description: "Personalised AI financial coaching based on academic research. Get guidance on investing, homeownership, retirement, and tax planning tailored to your specific situation.",
      keywords: "financial coach, AI financial advisor, investing guidance, retirement planning, financial goals, SomaTech"
    }
  },
  {
    id: "ai-tools",
    name: "AI Tools",
    description: "Claude-powered investment thesis builder, portfolio risk scan, and natural-language stock screener",
    icon: "Sparkles",
    category: "investing",
    navGroup: "investor",
    featured: true,
    seo: {
      title: "AI Tools | SomaTech",
      description: "AI-powered investment analysis tools — generate investment theses, scan portfolio risk, and screen stocks with natural language.",
      keywords: "AI stock analysis, investment thesis generator, portfolio risk analyzer, AI stock screener, SomaTech"
    }
  },
  {
    id: "real-estate",
    name: "Real Estate",
    description: "BRRRR calculator, traditional rental analysis, and amortization visualizer",
    icon: "Home",
    category: "planning",
    navGroup: "real-estate",
    featured: false,
    seo: {
      title: "Real Estate Calculator | SomaTech",
      description: "Analyse rental property investments with BRRRR, traditional cash flow, and amortization tools. Save and compare deals.",
      keywords: "BRRRR calculator, real estate investment, rental property analysis, amortization, cap rate, cash on cash return, SomaTech"
    }
  },
];

export const industryMultipliers: Record<string, number> = {
  "technology": 8,
  "healthcare": 6,
  "finance": 4,
  "retail": 3,
  "manufacturing": 2.5,
  "other": 3
};

export const industryOptions = [
  { value: "saas", label: "SaaS/Software" },
  { value: "technology", label: "Technology Hardware" },
  { value: "healthcare", label: "Healthcare/Biotech" },
  { value: "finance", label: "Financial Services" },
  { value: "retail", label: "Retail/E-commerce" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "services", label: "Professional Services" },
  { value: "realestate", label: "Real Estate" },
  { value: "energy", label: "Energy/Utilities" },
  { value: "automotive", label: "Automotive" },
  { value: "food", label: "Food & Beverage" },
  { value: "media", label: "Media/Entertainment" },
  { value: "other", label: "Other" }
];

export const businessTypeOptions = [
  { value: "subscription", label: "Subscription-based" },
  { value: "product", label: "Product-based" },
  { value: "service", label: "Service-based" },
  { value: "marketplace", label: "Marketplace/Platform" },
  { value: "saas", label: "Software as a Service" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "retail", label: "Physical Retail" },
  { value: "manufacturing", label: "Manufacturing/Production" },
  { value: "consulting", label: "Consulting/Advisory" },
  { value: "franchise", label: "Franchise" }
];

export const valuationMultiples = {
  saas: { revenue: 6, ebitda: 15, pe: 25 },
  technology: { revenue: 4, ebitda: 12, pe: 20 },
  healthcare: { revenue: 3, ebitda: 10, pe: 18 },
  finance: { revenue: 2.5, ebitda: 8, pe: 12 },
  retail: { revenue: 1.5, ebitda: 6, pe: 15 },
  manufacturing: { revenue: 1.2, ebitda: 5, pe: 12 },
  services: { revenue: 2, ebitda: 7, pe: 16 },
  realestate: { revenue: 1.8, ebitda: 8, pe: 14 },
  energy: { revenue: 1.5, ebitda: 6, pe: 10 },
  automotive: { revenue: 1, ebitda: 5, pe: 12 },
  food: { revenue: 1.5, ebitda: 6, pe: 14 },
  media: { revenue: 2.5, ebitda: 8, pe: 18 },
  other: { revenue: 2, ebitda: 7, pe: 15 }
};

export const campaignCategories = [
  { value: "car", label: "Car/Vehicle" },
  { value: "education", label: "Education/Tuition" },
  { value: "business", label: "Business/Startup" },
  { value: "medical", label: "Medical/Health" },
  { value: "emergency", label: "Emergency Fund" },
  { value: "housing", label: "Housing/Rent" },
  { value: "other", label: "Other" }
];

export const donationAmounts = [10, 25, 50, 100, 250, 500];
