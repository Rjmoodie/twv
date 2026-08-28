/**
 * EDGAR concept map — which us-gaap tags carry each financial line item.
 *
 * Shared rather than local because it is not only the edge function that needs
 * it: `scripts/audit-edgar-coverage.ts` measures how much of a filer universe
 * each list actually resolves, and a copy that drifts from the deployed one
 * would report coverage for a system nobody is running.
 *
 * Lists are ordered by preference. A later entry only fills a year an earlier
 * one left empty; it never overrides a value from a more specific concept.
 * Every entry that is not the first should say, in a comment, what it costs in
 * precision — a fallback that quietly changes what a number means is worse than
 * a gap, because a gap is visible.
 */

export const TAGS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
  researchAndDevelopment: [
    "ResearchAndDevelopmentExpense",
    // Pharma splits acquired in-process R&D out; the excluding-IPR&D line is the
    // recurring operating figure and the better comparison.
    "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
    "ResearchAndDevelopmentExpenseSoftwareExcludingAcquiredInProcessCost",
  ],
  sellingGeneralAdministrative: ["SellingGeneralAndAdministrativeExpense"],
  pretaxIncome: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
  incomeTaxExpense: ["IncomeTaxExpenseBenefit"],
  // `InterestExpenseNonOperating` is a typo — us-gaap spells it "Nonoperating",
  // lowercase o — so it matched nothing, and the plain `InterestExpense` concept
  // that 35 of 44 audited filers actually use was never listed. Coverage was 7%.
  interestExpense: [
    "InterestExpense",
    "InterestExpenseNonoperating",
    "InterestAndDebtExpense",
  ],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  // A single concept here is why NVDA had no free cash flow and so no DCF at all:
  // it tags capital spend as `PaymentsToAcquireProductiveAssets` ($6.0B in FY2026),
  // never as the property-plant-and-equipment concept. Capex feeds free cash flow,
  // which gates the entire valuation, so a miss here blanks the whole screen.
  capex: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PaymentsToAcquirePremisesAndEquipment",
    // A component rather than the total, so it understates capex — which
    // overstates free cash flow. Last resort, and provenance names the concept.
    "PaymentsToAcquireOtherPropertyPlantAndEquipment",
  ],
  totalAssets: ["Assets"],
  totalLiabilities: ["Liabilities"],
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
  // All four are the same current trade receivable under different filer habits.
  receivables: [
    "AccountsReceivableNetCurrent",
    "AccountsNotesAndLoansReceivableNetCurrent",
    "ReceivablesNetCurrent",
    "AccountsReceivableNet",
  ],
  inventory: ["InventoryNet"],
  goodwill: ["Goodwill"],
  retainedEarnings: ["RetainedEarningsAccumulatedDeficit"],
  // Only use explicitly non-current concepts here. Inclusive `LongTermDebt`
  // can contain the current portion and would be double-counted below.
  longTermDebt: [
    "LongTermDebtNoncurrent",
    "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    "LongTermNotesPayable",
    // Non-current by definition in us-gaap; the current portion has its own concept.
    "LongTermDebtAndCapitalLeaseObligations",
  ],
  shortTermDebt: ["DebtCurrent", "LongTermDebtAndFinanceLeaseObligationsCurrent", "ShortTermBorrowings", "LongTermDebtCurrent"],
  // The last entry INCLUDES non-controlling interests, so for a filer with
  // material minorities it overstates the parent's equity. Ordered last, and only
  // reached when a filer tags no parent-only figure at all.
  shareholderEquity: [
    "StockholdersEquity",
    "StockholdersEquityAttributableToParent",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  // Do not mix short-term investments into a field presented as cash.
  // Filers migrated to the restricted-cash-inclusive concept after ASU 2016-18 and
  // some have since migrated back, so a single tag leaves multi-year holes: Intel
  // reports the plain concept for 2014-2018 and 2024-2025, and the inclusive one
  // for 2019-2023. Ordered by preference, so the narrower concept always wins and
  // the broader one only fills gaps; provenance records which was used.
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  sharesOutstanding: ["EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding"],
  // Filers that report depreciation and amortisation on separate lines never emit
  // the combined concept, so a list containing only combined tags returns nothing
  // at all: Intel tags `Depreciation` and `AmortizationOfIntangibleAssets`, and
  // D&A came back null for every year, which in turn made EBITDA uncomputable for
  // exactly the capital-intensive companies that need it most. The standalone
  // depreciation line is the fallback; it understates D&A by any separately-tagged
  // amortisation, which is conservative for EBITDA, and provenance records which
  // concept was used.
  depreciationAmortization: [
    "DepreciationDepletionAndAmortization",
    "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment",
    "DepreciationAmortizationAndAccretionNet",
    "Depreciation",
    "AmortizationOfIntangibleAssets",
    "DepreciationAndAmortization",
  ],
  stockCompensation: ["ShareBasedCompensation"],
  acquisitions: ["PaymentsToAcquireBusinessesNetOfCashAcquired", "PaymentsToAcquireBusinessesGross"],
  shareRepurchases: ["PaymentsForRepurchaseOfCommonStock"],
  dividendsPaid: ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"],
  debtIssuance: [
    "ProceedsFromIssuanceOfLongTermDebt",
    "ProceedsFromIssuanceOfDebt",
    "ProceedsFromIssuanceOfLongTermDebtAndCapitalSecuritiesNet",
    "ProceedsFromIssuanceOfSeniorLongTermDebt",
    "ProceedsFromIssuanceOfUnsecuredDebt",
  ],
  debtRepayment: [
    "RepaymentsOfLongTermDebt",
    "RepaymentsOfDebt",
    "RepaymentsOfLongTermDebtAndCapitalSecurities",
  ],
} as const;

/**
 * Inputs used only to derive a field a filer did not tag directly.
 *
 * Kept apart from TAGS because these are never presented as figures in their own
 * right, and because a concept here must not be able to bring a fiscal year into
 * existence — only substantive reported facts should do that.
 */
export const DERIVATION_INPUTS = {
  costOfRevenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfServices", "CostOfSales"],
  costsAndExpenses: ["CostsAndExpenses", "BenefitsLossesAndExpenses"],
  generalAndAdministrative: ["GeneralAndAdministrativeExpense"],
  sellingAndMarketing: ["SellingAndMarketingExpense"],
  /** Assets = liabilities + equity, so this less TOTAL equity gives total liabilities. */
  balanceSheetTotal: ["LiabilitiesAndStockholdersEquity"],
  /**
   * Equity for the liabilities identity — deliberately NOT the `shareholderEquity`
   * presentation field, which prefers the parent-only figure because that is what
   * a reader wants to see.
   *
   * The identity needs the whole equity block. Subtracting parent-only equity
   * leaves non-controlling interests inside "liabilities" and overstates them:
   * across the audited universe that put every REIT out by 11-13% (Prologis
   * 2023, filed $35.2B against $39.8B derived). Preferring the including-NCI
   * concept takes 105 tested filer-years to 104 within 0.5% and none beyond 5%.
   */
  equityForLiabilities: [
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    "StockholdersEquity",
    "StockholdersEquityAttributableToParent",
  ],
} as const;

export type DerivationInput = keyof typeof DERIVATION_INPUTS;

export type TagField = keyof typeof TAGS;

/** Fields measured as a duration (income statement, cash flow). */
export const DURATION_FIELDS = [
  "revenue", "grossProfit", "operatingIncome", "netIncome", "researchAndDevelopment",
  "sellingGeneralAdministrative", "pretaxIncome", "incomeTaxExpense", "interestExpense",
  "operatingCashFlow", "capex", "depreciationAmortization", "stockCompensation",
  "acquisitions", "shareRepurchases", "dividendsPaid", "debtIssuance", "debtRepayment",
] as const satisfies readonly TagField[];

/** Fields measured at an instant (balance sheet, cover page). */
export const INSTANT_FIELDS = [
  "totalAssets", "totalLiabilities", "currentAssets", "currentLiabilities", "receivables",
  "inventory", "goodwill", "retainedEarnings", "longTermDebt", "shortTermDebt",
  "shareholderEquity", "cash", "sharesOutstanding",
] as const satisfies readonly TagField[];
