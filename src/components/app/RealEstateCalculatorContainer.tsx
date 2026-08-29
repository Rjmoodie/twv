import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, RefreshCw, FolderOpen, TrendingDown, MapPin } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { BRRRRInputs, BRRRRResults, SavedDeal } from "./real-estate/brrrrCalculations";
import { useBRRRROperations } from "./real-estate/useBRRRROperations";
import { useAuth } from "./AuthProvider";
import { TraditionalCalculator } from "./real-estate/TraditionalCalculator";
import { BRRRRCalculator } from "./real-estate/BRRRRCalculator";
import { SavedDealsManager } from "./real-estate/SavedDealsManager";
import { AmortizationVisualizer } from "./real-estate/AmortizationVisualizer";
import { EnhancedSaveDialog } from "./real-estate/EnhancedSaveDialog";
import RealEstateDealSourcing from "./real-estate/RealEstateDealSourcing";
import { NavigationWrapper } from "./navigation/NavigationWrapper";
import { useIsMobile } from "@/hooks/useBreakpoint";
import { ProcessedProperty } from "@/services/free-data-sources-implementation";

const TABS = ["deal-sourcing", "traditional", "brrrr", "amortization", "saved-deals"] as const;
type TabId = typeof TABS[number];
const TAB_LABELS: Record<TabId, string> = {
  "deal-sourcing": "Find deals",
  traditional: "Rental analysis",
  brrrr: "BRRRR analysis",
  amortization: "Mortgage amortization",
  "saved-deals": "Saved deals",
};

const DEFAULT_INPUTS: BRRRRInputs = {
  purchasePrice: 100000,
  downPaymentPercent: 25,
  closingCosts: 3000,
  acquisitionFees: 1000,
  holdingCosts: 500,
  renovationBudget: 25000,
  contingencyPercent: 10,
  rehabDuration: 3,
  rehabFinancingRate: 7,
  monthlyRent: 1200,
  vacancyRate: 5,
  propertyManagement: 100,
  insurance: 75,
  propertyTax: 150,
  maintenance: 100,
  arv: 150000,
  refinanceLTV: 75,
  newLoanRate: 6.5,
  newLoanTerm: 30,
  refinanceCosts: 3500,
};

const RealEstateCalculatorContainer = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state — synced to ?re-tab= URL param ──────────────────────────────
  const initialTab = (TABS.includes(searchParams.get("re-tab") as TabId)
    ? searchParams.get("re-tab")
    : "deal-sourcing") as TabId;

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  // Tracks which tabs have ever been visited so we only mount content on demand
  const [visited, setVisited] = useState<Set<TabId>>(new Set([initialTab]));

  useEffect(() => {
    const requested = searchParams.get("re-tab") as TabId;
    if (!TABS.includes(requested) || requested === activeTab) return;
    setActiveTab(requested);
    setVisited(prev => new Set(prev).add(requested));
  }, [activeTab, searchParams]);

  const goToTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
    setVisited(prev => { const next = new Set(prev); next.add(tab); return next; });
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set("re-tab", tab);
      return p;
    }, { replace: true });
  }, [setSearchParams]);

  // ── Calculator state ──────────────────────────────────────────────────────
  const [brrrrInputs, setBrrrrInputs] = useState<BRRRRInputs>(DEFAULT_INPUTS);
  const [brrrrResults, setBrrrrResults] = useState<BRRRRResults | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [dealName, setDealName] = useState("");
  const [dealNotes, setDealNotes] = useState("");
  const [currentDealId, setCurrentDealId] = useState<string | null>(null);

  const { query, saveDeal } = useBRRRROperations(user?.id);
  const savedDeals: SavedDeal[] = (query.data as SavedDeal[]) ?? [];

  // ── "Analyze lead" — pre-fills BRRRR and switches tab ────────────────────
  const handleAnalyzeLead = useCallback((lead: ProcessedProperty) => {
    setBrrrrInputs(prev => ({
      ...prev,
      purchasePrice: lead.property_value ?? prev.purchasePrice,
      // A source value is not an after-repair appraisal. Preserve the user's
      // ARV assumption instead of manufacturing appreciation.
    }));
    setBrrrrResults(null);
    setCurrentDealId(null);
    setDealName(lead.property_address ?? "");
    goToTab("brrrr");
    toast({
      title: "Lead loaded",
      description: `${lead.property_address ?? "Property"} pre-filled. Add your own after-repair value, then calculate.`,
    });
  }, [goToTab]);

  // ── Deal ops ──────────────────────────────────────────────────────────────
  const handleSaveDeal = async () => {
    if (!brrrrResults) return;
    const ok = await saveDeal(dealName, brrrrInputs, brrrrResults, dealNotes, currentDealId);
    if (ok) { setShowSaveDialog(false); setDealName(""); setDealNotes(""); query.refetch(); }
  };

  const handleLoadDeal = (deal: SavedDeal) => {
    setBrrrrInputs(deal.inputs);
    setBrrrrResults(deal.results);
    setCurrentDealId(deal.id);
    setDealName(deal.deal_name);
    setDealNotes(deal.notes || "");
    goToTab("brrrr");
    toast({ title: "Deal loaded", description: `"${deal.deal_name}" is ready.` });
  };

  const handleAutoSave = async (): Promise<boolean> => {
    if (!dealName.trim() || !brrrrResults || !currentDealId) return false;
    const ok = await saveDeal(dealName, brrrrInputs, brrrrResults, dealNotes, currentDealId);
    if (ok) query.refetch();
    return ok;
  };

  return (
    <NavigationWrapper showBackButton={false} showBreadcrumbs={false}>
      <Tabs value={activeTab} onValueChange={v => goToTab(v as TabId)} className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold">Real Estate</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find opportunities, test financing assumptions, and compare saved deals.</p>
        </div>

        <div className="sm:hidden">
          <Select value={activeTab} onValueChange={value => goToTab(value as TabId)}>
            <SelectTrigger aria-label="Choose a real estate workspace" className="h-11 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map(tab => <SelectItem key={tab} value={tab}>{TAB_LABELS[tab]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <TabsList className="hidden w-full justify-start overflow-x-auto whitespace-nowrap rounded-2xl border border-border/60 bg-card/60 p-1 scrollbar-hide sm:flex" style={{ WebkitOverflowScrolling: 'touch' }}>
          <TabsTrigger value="deal-sourcing" className="gap-1.5 rounded-xl shrink-0 min-h-[40px] touch-manipulation">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Deal Sourcing</span>
            <span className="sm:hidden">Leads</span>
          </TabsTrigger>
          <TabsTrigger value="traditional" className="gap-1.5 rounded-xl shrink-0 min-h-[40px] touch-manipulation">
            <Calculator className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Traditional</span>
            <span className="sm:hidden">Trad.</span>
          </TabsTrigger>
          <TabsTrigger value="brrrr" className="gap-1.5 rounded-xl shrink-0 min-h-[40px] touch-manipulation">
            <RefreshCw className="h-4 w-4 shrink-0" />
            BRRRR
          </TabsTrigger>
          <TabsTrigger value="amortization" className="gap-1.5 rounded-xl shrink-0 min-h-[40px] touch-manipulation">
            <TrendingDown className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Amortization</span>
            <span className="sm:hidden">Amort.</span>
          </TabsTrigger>
          <TabsTrigger value="saved-deals" className="gap-1.5 rounded-xl shrink-0 min-h-[40px] touch-manipulation">
            <FolderOpen className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Saved Deals</span>
            <span className="sm:hidden">Saved</span>
          </TabsTrigger>
        </TabsList>

        {/* Deal Sourcing — always mounted so query results are cached */}
        <TabsContent value="deal-sourcing" className="mt-0">
          <RealEstateDealSourcing onAnalyzeLead={handleAnalyzeLead} />
        </TabsContent>

        {/* Remaining tabs mount on first visit, then stay mounted */}
        <TabsContent value="traditional" className="space-y-5 mt-0">
          {visited.has("traditional") && <TraditionalCalculator />}
        </TabsContent>

        <TabsContent value="brrrr" className="space-y-5 mt-0">
          {visited.has("brrrr") && (
            <BRRRRCalculator
              inputs={brrrrInputs}
              onInputChange={(field, value) => {
                setBrrrrInputs(p => ({ ...p, [field]: value }));
                setBrrrrResults(null);
              }}
              results={brrrrResults}
              onResults={setBrrrrResults}
              onSaveClick={() => setShowSaveDialog(true)}
              isMobile={isMobile}
              dealName={dealName}
              dealNotes={dealNotes}
              currentDealId={currentDealId}
              onAutoSave={handleAutoSave}
            />
          )}
        </TabsContent>

        <TabsContent value="amortization" className="mt-0">
          {visited.has("amortization") && <AmortizationVisualizer />}
        </TabsContent>

        <TabsContent value="saved-deals" className="mt-0">
          {visited.has("saved-deals") && (
            <SavedDealsManager
              savedDeals={savedDeals}
              isLoading={query.isLoading}
              error={query.error instanceof Error ? query.error.message : null}
              onRetry={() => query.refetch()}
              onLoadDeal={handleLoadDeal}
              onSwitchToCalculator={() => goToTab("brrrr")}
            />
          )}
        </TabsContent>
      </Tabs>

      <EnhancedSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        dealName={dealName}
        setDealName={setDealName}
        dealNotes={dealNotes}
        setDealNotes={setDealNotes}
        onSave={handleSaveDeal}
        results={brrrrResults}
        inputs={brrrrInputs}
        isUpdate={!!currentDealId}
      />
    </NavigationWrapper>
  );
};

export default RealEstateCalculatorContainer;
