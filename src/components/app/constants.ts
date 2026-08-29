import { Module } from "./types";
export const modules: Module[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Overview of rates and real estate operations",
    icon: "LayoutDashboard",
    category: "overview",
    navGroup: "overview",
    featured: true,
    seo: {
      title: "Dashboard | TW Ventures",
      description: "Review the rate environment and operational context for real estate decisions.",
      keywords: "dashboard, real estate, interest rates, development, TW Ventures"
    }
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Actionable property and project operations across list and map views",
    icon: "Building2",
    category: "overview",
    navGroup: "overview",
    featured: true,
    seo: {
      title: "Real Estate Portfolio | TW Ventures",
      description: "Track property projects, milestones, budgets, investor capital, and project updates in one actionable portfolio.",
      keywords: "real estate portfolio, project management, investor portal, property map, TW Ventures"
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
      title: "Account | TW Ventures",
      description: "Manage your account settings and preferences. Update your profile, security settings, and account information.",
      keywords: "account, settings, profile, security, preferences, TW Ventures"
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
      title: "Support | TW Ventures",
      description: "Get help, read the FAQ, and access legal information.",
      keywords: "support, help, FAQ, TW Ventures"
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
      title: "Real Estate Calculator | TW Ventures",
      description: "Analyse rental property investments with BRRRR, traditional cash flow, and amortization tools. Save and compare deals.",
      keywords: "BRRRR calculator, real estate investment, rental property analysis, amortization, cap rate, cash on cash return, TW Ventures"
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
