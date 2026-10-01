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
    id: "crm",
    name: "CRM",
    description: "Project relationships, follow-ups, and communication history",
    icon: "Users",
    category: "operations",
    navGroup: "real-estate",
    featured: false,
    seo: {
      title: "Real Estate CRM | TW Ventures",
      description: "Manage project relationships, contacts, follow-ups, and communication activity.",
      keywords: "real estate CRM, investor relations, client management, project contacts, TW Ventures"
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
