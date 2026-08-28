# SomaTech Architecture Overview

## Application Structure

### Main Pages
| Page | Route | Description | Main Component | Status |
|------|-------|-------------|----------------|---------|
| Home/Dashboard | `/` | Main application entry point | `SomaTech.tsx` | ✅ Active |
| 404 Not Found | `/404` | Error page for invalid routes | `NotFound.tsx` | ✅ Active |
| Everything Money | N/A | Additional page component | `EverythingMoney.tsx` | ⚠️ Unused |

### Core Application Architecture

#### 1. **Main Application (`App.tsx`)**
- **Entry Point**: `main.tsx` → `App.tsx`
- **Providers**: 
  - `ErrorBoundary` - Global error handling
  - `QueryClientProvider` - React Query for data fetching
  - `PerformanceProvider` - Performance monitoring
  - `ErrorProvider` - Error state management
  - `AuthProvider` - Authentication state
  - `TooltipProvider` - UI tooltips
- **Routing**: React Router with lazy loading
- **UI Components**: `Toaster`, `Sonner` for notifications

#### 2. **Main Page (`SomaTech.tsx`)**
- **Purpose**: Single-page application with module-based navigation
- **State Management**: Local state for active module, sidebar, auth dialogs
- **Navigation**: Dynamic module switching based on `activeModule` state
- **Layout Components**: 
  - `ResponsiveNavigation` - Main navigation
  - `GroupedNavigation` - Sidebar navigation
  - `BottomNavigation` - Mobile navigation
  - `FloatingActionMenu` - Quick actions
  - `ModuleWrapper` - Module container

## Module System

### Module Categories

#### **Financial Modules** (`navGroup: "financial"`)
| Module ID | Name | Component | Status | Description |
|-----------|------|-----------|--------|-------------|
| `dashboard` | Dashboard | `Dashboard.tsx` | ✅ Active | Portfolio overview and market insights |
| `investor-guide` | Investor Guide | `InvestorGuide.tsx` | ✅ Active | Guided investing research and education |
| `stock-analysis` | Stock Analysis | `StockAnalysis.tsx` | ⚠️ Disabled* | Comprehensive stock research and analysis |
| `trades` | Trade Analysis | `Trades.tsx` | ✅ Active | Brokerage connection and trade analysis |
| `watchlist` | Watchlist | `WatchlistModule.tsx` | ⚠️ Disabled* | Stock tracking and market movements |
| `business-valuation` | Business Valuation | `BusinessValuation.tsx` | ⚠️ Disabled* | Professional business valuation tools |
| `cash-flow` | Cash Flow Simulator | `CashFlowSimulator.tsx` | ⚠️ Disabled* | Business cash flow modeling |
| `retirement-planning` | Retirement Planning | `RetirementPlanning.tsx` | ⚠️ Disabled* | Financial future planning tools |
| `marketplace` | Marketplace | `Marketplace.tsx` | ✅ Active | Business buying/selling platform |
| `funding-campaigns` | Funding Campaigns | `FundingCampaigns.tsx` | ✅ Active | Campaign creation and management |

*Disabled modules are temporarily showing placeholder content due to chart component import issues.

#### **Real Estate Modules** (`navGroup: "realEstate"`)
| Module ID | Name | Component | Status | Description |
|-----------|------|-----------|--------|-------------|
| `real-estate` | Real Estate Calculator | `RealEstateCalculatorContainer.tsx` | ✅ Active | Investment analysis and calculations |
| `real-estate-deal-sourcing` | Deal Sourcing | `RealEstateDealSourcing.tsx` | ✅ Active | Access leads from all 50 U.S. states |
| `lead-gen` | Lead Generation | `LeadGenSearchPage.tsx` | ✅ Active | Property lead generation with map |
| `deal-sourcing-data-manager` | Data Manager | `DealSourcingDataManager.tsx` | ✅ Active | Data source management |
| `data-ingestion-pipeline` | Data Pipeline | `DataIngestionPipeline.tsx` | ✅ Active | Automated data collection monitoring |
| `data-scraping-engine` | Scraping Engine | `DataScrapingEngine.tsx` | ✅ Active | Automated public data collection |
| `tax-delinquent-scraper` | Tax Delinquent Scraper | `TaxDelinquentScraper.tsx` | ✅ Active | Tax delinquent property data |
| `code-violation-scraper` | Code Violation Scraper | `CodeViolationScraper.tsx` | ✅ Active | Code violation property data |
| `pre-foreclosure-scraper` | Pre-Foreclosure Scraper | `PreForeclosureScraper.tsx` | ✅ Active | Pre-foreclosure property data |

#### **Account Modules** (`navGroup: "account"`)
| Module ID | Name | Component | Status | Description |
|-----------|------|-----------|--------|-------------|
| `account-settings` | Account Settings | `AccountSettings.tsx` | ✅ Active | Account and preference management |
| `user-dashboard` | User Dashboard | `UserDashboard.tsx` | ✅ Active | Personal analytics and insights |
| `notifications` | Notifications | `NotificationCenter.tsx` | ✅ Active | Notification and alert management |
| `feedback` | Feedback Hub | `FeedbackHub.tsx` | ✅ Active | Feedback submission and responses |

#### **Settings Modules** (`navGroup: "settings"`)
| Module ID | Name | Component | Status | Description |
|-----------|------|-----------|--------|-------------|
| `subscription` | Subscription | `SubscriptionStatus.tsx` | ✅ Active | Subscription and billing management |
| `enterprise-analytics` | Usage Analytics | `UsageAnalytics.tsx` | ✅ Active | Advanced analytics and insights |
| `enterprise-admin` | Admin Panel | `AdminPanel.tsx` | ✅ Active | Administrative tools and user management |
| `enterprise-whitelabel` | White Label | `WhiteLabelCustomizer.tsx` | ✅ Active | Branding and white label options |
| `enterprise-reporting` | Advanced Reporting | `AdvancedReporting.tsx` | ✅ Active | Comprehensive reporting and analytics |
| `enterprise-performance` | Performance Monitoring | `PerformanceMonitoring.tsx` | ✅ Active | System performance monitoring |
| `enterprise-success` | Customer Success | `CustomerSuccessDashboard.tsx` | ✅ Active | Customer success and support tools |
| `enterprise-security` | Security Audit | `SecurityAuditDashboard.tsx` | ✅ Active | Security monitoring and audit tools |
| `enterprise-tenant` | Multi-Tenant | `MultiTenantArchitecture.tsx` | ✅ Active | Multi-tenant architecture management |

## Component Architecture

### **Core Components** (`/src/components/somatech/`)

#### **Layout & Navigation**
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `ResponsiveNavigation.tsx` | Main navigation bar | UI components, auth context | ✅ Active |
| `GroupedNavigation.tsx` | Sidebar navigation | Module constants, UI components | ✅ Active |
| `BottomNavigation.tsx` | Mobile navigation | UI components | ✅ Active |
| `FloatingActionMenu.tsx` | Quick action menu | UI components | ✅ Active |
| `ModuleWrapper.tsx` | Module container | Error boundary | ✅ Active |
| `SomaTechLayout.tsx` | Main layout wrapper | Layout components | ✅ Active |
| `SomaTechHeader.tsx` | Header component | Navigation, profile | ✅ Active |
| `SomaTechSidebar.tsx` | Sidebar component | Navigation, modules | ✅ Active |
| `SomaTechContent.tsx` | Content area | Module rendering | ✅ Active |

#### **Authentication & User Management**
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `AuthProvider.tsx` | Authentication context | Supabase client | ✅ Active |
| `AuthDialog.tsx` | Authentication modal | UI components, auth provider | ✅ Active |
| `ProfileDropdown.tsx` | User profile menu | UI components, auth context | ✅ Active |
| `SocialLogin.tsx` | Social authentication | UI components | ✅ Active |
| `PasswordStrengthIndicator.tsx` | Password validation | UI components | ✅ Active |

#### **Performance & Error Handling**
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `ErrorBoundary.tsx` | Error boundary wrapper | React error boundary | ✅ Active |
| `ErrorProvider.tsx` | Error state management | Context API | ✅ Active |
| `ErrorFallback.tsx` | Error display component | UI components | ✅ Active |
| `ErrorMessage.tsx` | Error message display | UI components | ✅ Active |
| `PerformanceProvider.tsx` | Performance monitoring | Performance API | ✅ Active |
| `OptimizedComponent.tsx` | Performance wrapper | Intersection Observer | ✅ Active |
| `GlobalLoadingState.tsx` | Loading state management | Context API | ✅ Active |
| `LoadingSpinner.tsx` | Loading indicator | UI components | ✅ Active |

#### **UI & UX Components**
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `DarkModeToggle.tsx` | Theme switching | UI components, theme context | ✅ Active |
| `NotificationBell.tsx` | Notification indicator | UI components, notification context | ✅ Active |
| `OfflineIndicator.tsx` | Offline status | Network API | ✅ Active |
| `NetworkStatus.tsx` | Network monitoring | Network API | ✅ Active |
| `ProgressiveOnboarding.tsx` | User onboarding | UI components, local storage | ✅ Active |
| `OnboardingModal.tsx` | Onboarding modal | UI components | ✅ Active |
| `OnboardingWelcome.tsx` | Welcome screen | UI components | ✅ Active |
| `PWAManager.tsx` | PWA functionality | Service worker API | ✅ Active |
| `UserFeedbackSystem.tsx` | Feedback collection | UI components | ✅ Active |
| `KeyboardShortcutsHelp.tsx` | Keyboard shortcuts | UI components | ✅ Active |
| `HelpTooltip.tsx` | Help tooltips | UI components | ✅ Active |

### **Module-Specific Components**

#### **Dashboard Components** (`/dashboard/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `Dashboard.tsx` | Main dashboard | Dashboard sub-components | ✅ Active |
| `WelcomeSection.tsx` | Welcome message | UI components | ✅ Active |
| `MarketSnapshot.tsx` | Market overview | UI components, market data | ✅ Active |
| `TodaysAlerts.tsx` | Daily alerts | UI components, alert data | ✅ Active |
| `MacroIndicators.tsx` | Economic indicators | UI components, indicator data | ✅ Active |
| `LatestNews.tsx` | News feed | UI components, news API | ✅ Active |
| `FeaturedVideo.tsx` | Featured content | UI components, video data | ✅ Active |
| `BusinessPulse.tsx` | Business insights | UI components, business data | ✅ Active |
| `AnnouncementsSection.tsx` | Announcements | UI components, announcement data | ✅ Active |
| `LearningResources.tsx` | Educational content | UI components, resource data | ✅ Active |
| `HistoricalChart.tsx` | Historical data | UI components, chart library | ✅ Active |

#### **Real Estate Components** (`/real-estate/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `RealEstateCalculatorContainer.tsx` | Calculator wrapper | Calculator sub-components | ✅ Active |
| `BRRRRCalculator.tsx` | BRRRR calculations | UI components, calculation logic | ✅ Active |
| `TraditionalCalculator.tsx` | Traditional calculations | UI components, calculation logic | ✅ Active |
| `RealEstateDealSourcing.tsx` | Deal sourcing interface | UI components, deal data | ✅ Active |
| `DealSourcingDataManager.tsx` | Data management | UI components, data operations | ✅ Active |
| `DataIngestionPipeline.tsx` | Pipeline monitoring | UI components, pipeline data | ✅ Active |
| `EnhancedPropertyMap.tsx` | Property map | Mapbox GL, UI components | ✅ Active |
| `PropertyMap.tsx` | Basic property map | Mapbox GL | ✅ Active |
| `DealComparison.tsx` | Deal comparison | UI components, comparison logic | ✅ Active |
| `SavedDealsManager.tsx` | Saved deals | UI components, local storage | ✅ Active |
| `BRRRRExplainer.tsx` | BRRRR education | UI components | ✅ Active |
| `EnhancedSaveDialog.tsx` | Save dialog | UI components | ✅ Active |
| `FinancialTooltip.tsx` | Financial explanations | UI components | ✅ Active |
| `MobileOptimizedForm.tsx` | Mobile form | UI components, form logic | ✅ Active |
| `FormField.tsx` | Form field component | UI components | ✅ Active |

#### **Lead Generation Components** (`/lead-gen/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `SearchPage.tsx` | Search interface | Search sub-components | ✅ Active |
| `LeadMap.tsx` | Interactive map | Mapbox GL, UI components | ✅ Active |
| `MapEngine.tsx` | Map functionality | Mapbox GL, map operations | ✅ Active |
| `SearchBar.tsx` | Search functionality | UI components, search logic | ✅ Active |
| `FilterSidebar.tsx` | Filter interface | UI components, filter logic | ✅ Active |
| `PropertyCard.tsx` | Property display | UI components, property data | ✅ Active |
| `PropertyDetailView.tsx` | Property details | UI components, property data | ✅ Active |
| `PropertyResultsList.tsx` | Results list | UI components, results data | ✅ Active |
| `MyPropertiesWorkspace.tsx` | Workspace interface | UI components, workspace data | ✅ Active |
| `CampaignTrackingDashboard.tsx` | Campaign tracking | UI components, campaign data | ✅ Active |
| `Microinteractions.tsx` | UI interactions | UI components, interaction logic | ✅ Active |
| `EnhancedTooltip.tsx` | Enhanced tooltips | UI components | ✅ Active |
| `ExportCSVButton.tsx` | Data export | UI components, export logic | ✅ Active |

#### **Business Valuation Components** (`/business-valuation/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `BusinessValuation.tsx` | Main valuation interface | Valuation sub-components | ✅ Active |
| `BusinessValuationInputForm.tsx` | Input form | UI components, form validation | ✅ Active |
| `BusinessValuationResults.tsx` | Results display | UI components, results data | ✅ Active |
| `BusinessValuationChart.tsx` | Valuation charts | Chart library, UI components | ✅ Active |
| `BusinessValuationExport.tsx` | Export functionality | UI components, export logic | ✅ Active |

#### **Cash Flow Components** (`/cash-flow/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `CashFlowSimulator.tsx` | Main simulator interface | Cash flow sub-components | ✅ Active |
| `CashFlowInputForm.tsx` | Input form | UI components, form validation | ✅ Active |
| `CashFlowResults.tsx` | Results display | UI components, results data | ✅ Active |
| `CashFlowChart.tsx` | Cash flow charts | Chart library, UI components | ✅ Active |
| `CashFlowExport.tsx` | Export functionality | UI components, export logic | ✅ Active |

#### **Retirement Planning Components** (`/retirement/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `RetirementPlanning.tsx` | Main planning interface | Retirement sub-components | ✅ Active |
| `RetirementInputForm.tsx` | Input form | UI components, form validation | ✅ Active |
| `RetirementResults.tsx` | Results display | UI components, results data | ✅ Active |
| `RetirementVisualization.tsx` | Planning visualizations | Chart library, UI components | ✅ Active |
| `SavedPlanCard.tsx` | Saved plan display | UI components, plan data | ✅ Active |
| `SavePlanDialog.tsx` | Save dialog | UI components | ✅ Active |
| `LoadPlanDialog.tsx` | Load dialog | UI components | ✅ Active |

#### **Funding Components** (`/funding/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `FundingCampaigns.tsx` | Main campaigns interface | Funding sub-components | ✅ Active |
| `CreateCampaignDialog.tsx` | Campaign creation | UI components, form validation | ✅ Active |
| `CampaignDetails.tsx` | Campaign details | UI components, campaign data | ✅ Active |
| `CampaignCard.tsx` | Campaign display | UI components, campaign data | ✅ Active |
| `DonationForm.tsx` | Donation interface | UI components, payment processing | ✅ Active |
| `DonationSuccess.tsx` | Success page | UI components | ✅ Active |
| `CampaignProgress.tsx` | Progress tracking | UI components, progress data | ✅ Active |
| `CampaignActions.tsx` | Campaign actions | UI components, action logic | ✅ Active |
| `CampaignHeader.tsx` | Campaign header | UI components | ✅ Active |
| `CampaignMetadata.tsx` | Campaign metadata | UI components | ✅ Active |

#### **Account Components** (`/account/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `AccountSettings.tsx` | Main settings interface | Account sub-components | ✅ Active |
| `ProfileSettings.tsx` | Profile management | UI components, profile data | ✅ Active |
| `SecuritySettings.tsx` | Security settings | UI components, security logic | ✅ Active |
| `EnhancedSecuritySettings.tsx` | Advanced security | UI components, security features | ✅ Active |
| `NotificationSettings.tsx` | Notification preferences | UI components, notification logic | ✅ Active |
| `ThemeSettings.tsx` | Theme preferences | UI components, theme context | ✅ Active |

#### **Enterprise Components** (`/enterprise/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `AdminPanel.tsx` | Administrative interface | Enterprise sub-components | ✅ Active |
| `WhiteLabelCustomizer.tsx` | White label customization | UI components, branding logic | ✅ Active |
| `AdvancedReporting.tsx` | Advanced reporting | UI components, reporting logic | ✅ Active |
| `PerformanceMonitoring.tsx` | Performance monitoring | UI components, monitoring data | ✅ Active |
| `CustomerSuccessDashboard.tsx` | Customer success | UI components, success metrics | ✅ Active |
| `SecurityAuditDashboard.tsx` | Security auditing | UI components, audit data | ✅ Active |
| `MultiTenantArchitecture.tsx` | Multi-tenant management | UI components, tenant logic | ✅ Active |
| `UsageAnalytics.tsx` | Usage analytics | UI components, analytics data | ✅ Active |
| `SubscriptionStatus.tsx` | Subscription management | UI components, subscription data | ✅ Active |
| `PricingDialog.tsx` | Pricing information | UI components, pricing data | ✅ Active |
| `OnboardingFlow.tsx` | Enterprise onboarding | UI components, onboarding logic | ✅ Active |
| `GlobalSearch.tsx` | Global search | UI components, search logic | ✅ Active |

#### **Marketplace Components** (`/marketplace/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `Marketplace.tsx` | Main marketplace interface | Marketplace sub-components | ✅ Active |
| `MarketplaceListings.tsx` | Listings display | UI components, listing data | ✅ Active |
| `CreateListingForm.tsx` | Listing creation | UI components, form validation | ✅ Active |
| `CreateListingDialog.tsx` | Creation dialog | UI components | ✅ Active |
| `MarketplaceFiltersPanel.tsx` | Filtering interface | UI components, filter logic | ✅ Active |
| `BookOfRecordUpload.tsx` | Document upload | UI components, upload logic | ✅ Active |

#### **Stock Analysis Components** (`/stock-analysis/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `StockAnalysis.tsx` | Main analysis interface | Analysis sub-components | ⚠️ Disabled* |
| `StockAnalysisContent.tsx` | Analysis content | UI components, analysis data | ✅ Active |
| `StockInputSection.tsx` | Stock input | UI components, input validation | ✅ Active |
| `StockDataProvider.tsx` | Data provider | Data fetching, state management | ✅ Active |

#### **Watchlist Components** (`/watchlist/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `WatchlistModule.tsx` | Main watchlist interface | Watchlist sub-components | ⚠️ Disabled* |
| `WatchlistCard.tsx` | Watchlist item display | UI components, stock data | ✅ Active |
| `WatchlistHeader.tsx` | Watchlist header | UI components | ✅ Active |
| `WatchlistEmptyState.tsx` | Empty state | UI components | ✅ Active |
| `WatchlistLoading.tsx` | Loading state | UI components | ✅ Active |
| `WatchlistDialog.tsx` | Watchlist dialog | UI components | ✅ Active |

### **UI Components** (`/src/components/ui/`)
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `button.tsx` | Button component | Radix UI, styling | ✅ Active |
| `card.tsx` | Card component | Radix UI, styling | ✅ Active |
| `dialog.tsx` | Dialog component | Radix UI, styling | ✅ Active |
| `input.tsx` | Input component | Radix UI, styling | ✅ Active |
| `form.tsx` | Form component | React Hook Form, validation | ✅ Active |
| `chart.tsx` | Chart wrapper | Recharts, lazy loading | ✅ Active |
| `table.tsx` | Table component | Radix UI, styling | ✅ Active |
| `toast.tsx` | Toast notifications | Radix UI, styling | ✅ Active |
| `toaster.tsx` | Toast container | Toast component | ✅ Active |
| `sonner.tsx` | Sonner notifications | Sonner library | ✅ Active |
| `tooltip.tsx` | Tooltip component | Radix UI, styling | ✅ Active |
| `dropdown-menu.tsx` | Dropdown menu | Radix UI, styling | ✅ Active |
| `select.tsx` | Select component | Radix UI, styling | ✅ Active |
| `tabs.tsx` | Tabs component | Radix UI, styling | ✅ Active |
| `accordion.tsx` | Accordion component | Radix UI, styling | ✅ Active |
| `alert.tsx` | Alert component | Radix UI, styling | ✅ Active |
| `badge.tsx` | Badge component | Radix UI, styling | ✅ Active |
| `avatar.tsx` | Avatar component | Radix UI, styling | ✅ Active |
| `progress.tsx` | Progress component | Radix UI, styling | ✅ Active |
| `slider.tsx` | Slider component | Radix UI, styling | ✅ Active |
| `switch.tsx` | Switch component | Radix UI, styling | ✅ Active |
| `checkbox.tsx` | Checkbox component | Radix UI, styling | ✅ Active |
| `radio-group.tsx` | Radio group | Radix UI, styling | ✅ Active |
| `textarea.tsx` | Textarea component | Radix UI, styling | ✅ Active |
| `label.tsx` | Label component | Radix UI, styling | ✅ Active |
| `separator.tsx` | Separator component | Radix UI, styling | ✅ Active |
| `skeleton.tsx` | Loading skeleton | Styling | ✅ Active |
| `scroll-area.tsx` | Scroll area | Radix UI, styling | ✅ Active |
| `popover.tsx` | Popover component | Radix UI, styling | ✅ Active |
| `hover-card.tsx` | Hover card | Radix UI, styling | ✅ Active |
| `context-menu.tsx` | Context menu | Radix UI, styling | ✅ Active |
| `navigation-menu.tsx` | Navigation menu | Radix UI, styling | ✅ Active |
| `menubar.tsx` | Menu bar | Radix UI, styling | ✅ Active |
| `breadcrumb.tsx` | Breadcrumb navigation | Radix UI, styling | ✅ Active |
| `calendar.tsx` | Calendar component | Radix UI, styling | ✅ Active |
| `carousel.tsx` | Carousel component | Embla Carousel | ✅ Active |
| `command.tsx` | Command palette | CMDK library | ✅ Active |
| `drawer.tsx` | Drawer component | Radix UI, styling | ✅ Active |
| `sheet.tsx` | Sheet component | Radix UI, styling | ✅ Active |
| `resizable.tsx` | Resizable panels | React Resizable Panels | ✅ Active |
| `responsive-table.tsx` | Responsive table | Table component | ✅ Active |
| `pagination.tsx` | Pagination component | Radix UI, styling | ✅ Active |
| `toggle.tsx` | Toggle component | Radix UI, styling | ✅ Active |
| `toggle-group.tsx` | Toggle group | Radix UI, styling | ✅ Active |
| `input-otp.tsx` | OTP input | Input OTP library | ✅ Active |
| `alert-dialog.tsx` | Alert dialog | Radix UI, styling | ✅ Active |
| `collapsible.tsx` | Collapsible component | Radix UI, styling | ✅ Active |
| `aspect-ratio.tsx` | Aspect ratio | Radix UI, styling | ✅ Active |

### **Utility Components**
| Component | Purpose | Dependencies | Status |
|-----------|---------|--------------|---------|
| `LazyMapbox.tsx` | Mapbox lazy loading | Mapbox GL, lazy loading | ✅ Active |
| `LazyMotion.tsx` | Framer Motion lazy loading | Framer Motion, lazy loading | ✅ Active |
| `TradingViewChart.tsx` | TradingView integration | TradingView widget | ✅ Active |
| `StockTickerInput.tsx` | Stock ticker input | UI components, validation | ✅ Active |
| `FinancialStatements.tsx` | Financial statements | UI components, statement data | ✅ Active |
| `DCFAnalysis.tsx` | DCF analysis | UI components, analysis logic | ✅ Active |
| `CompanySnapshot.tsx` | Company overview | UI components, company data | ✅ Active |
| `BusinessBenchmarks.tsx` | Business benchmarks | UI components, benchmark data | ✅ Active |
| `EnhancedPillarScorecard.tsx` | Scorecard component | UI components, scorecard data | ✅ Active |
| `InvestmentThesisGenerator.tsx` | Thesis generation | UI components, generation logic | ✅ Active |
| `ExportActions.tsx` | Export functionality | UI components, export logic | ✅ Active |
| `ValuedMetricsSection.tsx` | Metrics display | UI components, metrics data | ✅ Active |
| `QuickActions.tsx` | Quick actions | UI components, action logic | ✅ Active |
| `AuthRequiredMessage.tsx` | Auth requirement | UI components | ✅ Active |
| `Footer.tsx` | Application footer | UI components | ✅ Active |
| `PrivacyPolicy.tsx` | Privacy policy | UI components | ✅ Active |
| `TermsOfService.tsx` | Terms of service | UI components | ✅ Active |

## Data Flow Architecture

### **State Management**
1. **Global State**: React Context (Auth, Error, Performance)
2. **Server State**: React Query (TanStack Query)
3. **Local State**: React useState/useReducer
4. **Form State**: React Hook Form

### **Data Sources**
1. **Supabase**: Primary database and authentication
2. **External APIs**: Market data, property data, news
3. **Local Storage**: User preferences, cached data
4. **Session Storage**: Temporary session data

### **Performance Optimizations**
1. **Lazy Loading**: All major components and modules
2. **Code Splitting**: Vite manual chunks configuration
3. **Memoization**: React.memo, useMemo, useCallback
4. **Virtual Scrolling**: For large data sets
5. **Intersection Observer**: For lazy loading
6. **Debouncing**: For search and input operations

## Security & Authentication

### **Authentication Flow**
1. **Supabase Auth**: Email/password, social login
2. **Role-Based Access**: User roles and permissions
3. **Protected Routes**: Authentication guards
4. **Session Management**: Automatic token refresh

### **Security Features**
1. **Input Validation**: Zod schema validation
2. **XSS Protection**: Sanitized inputs
3. **CSRF Protection**: Token-based protection
4. **Rate Limiting**: API rate limiting
5. **Audit Logging**: Security event logging

## Deployment & Build

### **Build Configuration**
- **Bundler**: Vite
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **UI Library**: Radix UI + ShadCN
- **Charts**: Recharts (with lazy loading)
- **Maps**: Mapbox GL
- **Animations**: Framer Motion

### **Performance Targets**
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms
- **Time to Interactive**: < 3.5s

## Current Issues & Status

### **Known Issues**
1. **Chart Components**: Temporarily disabled due to `recharts`/`lodash` import conflicts
2. **Module Loading**: Some modules showing placeholder content
3. **Performance**: Bundle size optimization in progress

### **Next Steps**
1. **Fix Chart Components**: Resolve import conflicts and re-enable chart modules
2. **Performance Audit**: Complete bundle analysis and optimization
3. **Testing**: Implement comprehensive testing suite
4. **Documentation**: Complete API and component documentation

---

*This architecture overview provides a comprehensive view of the SomaTech application structure, component relationships, and current status. The modular design allows for easy maintenance, scalability, and feature additions.* 