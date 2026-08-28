import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, FolderOpen } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import RetirementInputForm from "./retirement/RetirementInputForm";
import RetirementResults from "./retirement/RetirementResults";
import RetirementVisualization from "./retirement/RetirementVisualization";
import { SavePlanDialog } from "./retirement/SavePlanDialog";
import { LoadPlanDialog } from "./retirement/LoadPlanDialog";
import { SavedPlanCard } from "./retirement/SavedPlanCard";
import { useRetirementOperations, useSavePlan, useDeletePlan } from "./retirement/retirementOperations";
import { calculateRetirement } from "./retirement/retirementUtils";
import { RetirementInputs, RetirementResults as IRetirementResults, SavedPlan } from "./retirement/retirementOperations";
import { modules } from "./constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "./AuthProvider";
import { useRetirementPrefill } from "@/hooks/usePFPrefill";
import DiscussWithCoach from "./DiscussWithCoach";
import type { ToolSession } from "@/lib/toolSessionTypes";


const module = modules.find(m => m.id === "retirement-planning");

const RetirementPlanning = () => {
  // Form state
  const [currentAge, setCurrentAge] = useState("");
  const [retirementAge, setRetirementAge] = useState("");
  const [lifeExpectancy, setLifeExpectancy] = useState("90");
  const [currentSavings, setCurrentSavings] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [expectedReturn, setExpectedReturn] = useState([7]);
  const [retirementSpending, setRetirementSpending] = useState("");
  const [inflationRate, setInflationRate] = useState([2.5]);
  const [otherIncome, setOtherIncome] = useState("");
  const [retirementResult, setRetirementResult] = useState<IRetirementResults | null>(null);

  // Dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [planName, setPlanName] = useState("");
  const [planNotes, setPlanNotes] = useState("");
  const [currentNotes, setCurrentNotes] = useState("");

  const { user } = useAuth();
  const userId = user?.id;

  // PF pre-fill: seed form from Personal Finance data on first load (once, only if fields are empty)
  const pfPrefill = useRetirementPrefill();
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current) return;
    if (!pfPrefill.currentSavings && !pfPrefill.monthlyContribution && !pfPrefill.retirementSpending) return;
    prefillApplied.current = true;
    if (pfPrefill.currentSavings    && !currentSavings)      setCurrentSavings(String(pfPrefill.currentSavings));
    if (pfPrefill.monthlyContribution && !monthlyContribution) setMonthlyContribution(String(pfPrefill.monthlyContribution));
    if (pfPrefill.retirementSpending && !retirementSpending)  setRetirementSpending(String(pfPrefill.retirementSpending));
  }, [pfPrefill]); // eslint-disable-line react-hooks/exhaustive-deps

  // readinessScore must be declared before coachSession uses it
  const readinessScore = useMemo(() => {
    if (!retirementResult) return null;
    if (!retirementResult.yearsInRetirement) return null;
    const ratio = retirementResult.yearsWillLast / retirementResult.yearsInRetirement;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }, [retirementResult]);

  // Coach session: built from latest result so DiscussWithCoach has something to save + send
  const coachSession = useMemo((): ToolSession | null => {
    if (!retirementResult) return null;
    const { totalSavingsAtRetirement: savings, yearsWillLast: years, surplusOrShortfall: surplus } = retirementResult;
    const sign = surplus >= 0 ? 'surplus' : 'shortfall';
    return {
      tool: 'retirement-planning',
      summary: `I ran a retirement projection: $${savings.toLocaleString()} projected at retirement, plan lasts ${years} years, ${sign} of $${Math.abs(surplus).toLocaleString()}. Inputs: $${Number(currentSavings).toLocaleString()} current savings, $${Number(monthlyContribution).toLocaleString()}/year contribution, ${expectedReturn[0]}% return, $${Number(retirementSpending).toLocaleString()}/year spending in retirement.`,
      key_outputs: {
        projectedSavings:  savings,
        yearsLastsFor:     years,
        surplusOrShortfall: surplus,
        readinessScore:    readinessScore ?? 0,
      },
    };
  }, [retirementResult, currentSavings, monthlyContribution, expectedReturn, retirementSpending, readinessScore]);

  // Query and mutations
  const { data: savedPlans = [], isLoading, error } = useRetirementOperations(userId);
  const savePlanMutation = useSavePlan(userId);
  const deletePlanMutation = useDeletePlan(userId);

  const handleSavePlan = async () => {
    if (!retirementResult) return;
    const inputs: RetirementInputs = {
      currentAge: parseInt(currentAge),
      retirementAge: parseInt(retirementAge),
      lifeExpectancy: parseInt(lifeExpectancy),
      currentSavings: parseFloat(currentSavings),
      monthlyContribution: parseFloat(monthlyContribution),
      expectedReturn: expectedReturn[0],
      retirementSpending: parseFloat(retirementSpending),
      inflationRate: inflationRate[0],
      otherIncome: parseFloat(otherIncome) || 0,
    };
    savePlanMutation.mutate({ planName, inputs, results: retirementResult, notes: planNotes || currentNotes }, {
      onSuccess: () => {
        setShowSaveDialog(false);
        setPlanName("");
        setPlanNotes("");
      }
    });
  };

  const handleLoadPlan = (plan: SavedPlan) => {
    setCurrentAge(plan.inputs.currentAge.toString());
    setRetirementAge(plan.inputs.retirementAge.toString());
    setLifeExpectancy(plan.inputs.lifeExpectancy.toString());
    setCurrentSavings(plan.inputs.currentSavings.toString());
    setMonthlyContribution(plan.inputs.monthlyContribution.toString());
    setExpectedReturn([plan.inputs.expectedReturn]);
    setRetirementSpending(plan.inputs.retirementSpending.toString());
    setInflationRate([plan.inputs.inflationRate]);
    setOtherIncome(plan.inputs.otherIncome.toString());
    setRetirementResult(plan.results);
    setPlanNotes(plan.notes || "");
    setCurrentNotes(plan.notes || "");
    setShowLoadDialog(false);
    toast({
      title: "Plan Loaded",
      description: `"${plan.plan_name}" has been loaded successfully.`,
    });
  };

  const handleDeletePlan = (planId: string, planName: string) => {
    if (!window.confirm(`Delete "${planName}"? This cannot be undone.`)) return;
    deletePlanMutation.mutate(planId);
  };

  const handleCalculateRetirement = () => {
    if (!currentAge || !retirementAge || !currentSavings || !monthlyContribution || !retirementSpending) return;
    const inputs: RetirementInputs = {
      currentAge: parseInt(currentAge),
      retirementAge: parseInt(retirementAge),
      lifeExpectancy: parseInt(lifeExpectancy),
      currentSavings: parseFloat(currentSavings),
      monthlyContribution: parseFloat(monthlyContribution),
      expectedReturn: expectedReturn[0],
      retirementSpending: parseFloat(retirementSpending),
      inflationRate: inflationRate[0],
      otherIncome: parseFloat(otherIncome) || 0,
    };
    try {
      setRetirementResult(calculateRetirement(inputs));
    } catch (error) {
      toast({
        title: "Check your retirement inputs",
        description: error instanceof Error ? error.message : "Some values are not valid.",
        variant: "destructive",
      });
    }
  };

  // JSON-LD structured data for the retirement planning module
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": module?.name,
    "description": module?.seo?.description,
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "All",
    "publisher": {
      "@type": "Organization",
      "name": "SomaTech"
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-semibold">
              Retirement readiness overview
              {readinessScore !== null && (
                <Badge variant={readinessScore >= 80 ? "default" : readinessScore >= 50 ? "secondary" : "destructive"}>
                  {readinessScore}% ready
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Projected retirement savings</p>
                <p className="text-2xl font-semibold">
                  {retirementResult ? `$${retirementResult.totalSavingsAtRetirement.toLocaleString()}` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Plan longevity</p>
                <p className="text-2xl font-semibold">
                  {retirementResult ? `${retirementResult.yearsWillLast} years` : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4">
                <p className="text-xs text-muted-foreground">Surplus / shortfall</p>
                <p className={`text-2xl font-semibold ${retirementResult && retirementResult.surplusOrShortfall >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {retirementResult ? `$${Math.abs(retirementResult.surplusOrShortfall).toLocaleString()}` : "—"}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Readiness score</span>
                <span>{readinessScore !== null ? `${readinessScore}%` : 'Awaiting calculation'}</span>
              </div>
              <Progress value={readinessScore ?? 0} className="mt-2 h-2" />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="calculator" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calculator" className="gap-2">
              <Calculator className="h-4 w-4" />
              Retirement Calculator
            </TabsTrigger>
            <TabsTrigger value="saved-plans" className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Saved Plans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-6">
                <RetirementInputForm
                  currentAge={currentAge}
                  setCurrentAge={setCurrentAge}
                  retirementAge={retirementAge}
                  setRetirementAge={setRetirementAge}
                  lifeExpectancy={lifeExpectancy}
                  setLifeExpectancy={setLifeExpectancy}
                  currentSavings={currentSavings}
                  setCurrentSavings={setCurrentSavings}
                  monthlyContribution={monthlyContribution}
                  setMonthlyContribution={setMonthlyContribution}
                  expectedReturn={expectedReturn}
                  setExpectedReturn={setExpectedReturn}
                  retirementSpending={retirementSpending}
                  setRetirementSpending={setRetirementSpending}
                  inflationRate={inflationRate}
                  setInflationRate={setInflationRate}
                  otherIncome={otherIncome}
                  setOtherIncome={setOtherIncome}
                  onCalculate={handleCalculateRetirement}
                />

                {/* Action Buttons */}
                {retirementResult && (
                  <div className="flex flex-wrap gap-2">
                    <SavePlanDialog
                      open={showSaveDialog}
                      onOpenChange={setShowSaveDialog}
                      planName={planName}
                      setPlanName={setPlanName}
                      planNotes={planNotes}
                      setPlanNotes={setPlanNotes}
                      currentNotes={currentNotes}
                      onSave={handleSavePlan}
                    />

                    <LoadPlanDialog
                      open={showLoadDialog}
                      onOpenChange={setShowLoadDialog}
                      savedPlans={savedPlans}
                      onLoadPlan={handleLoadPlan}
                      onDeletePlan={handleDeletePlan}
                    />

                    {coachSession && (
                      <DiscussWithCoach session={coachSession} size="sm" />
                    )}
                  </div>
                )}
              </div>

              {retirementResult && <RetirementResults result={retirementResult} />}
            </div>

            {retirementResult && (
              <RetirementVisualization
                currentAge={currentAge}
                retirementAge={retirementAge}
                lifeExpectancy={lifeExpectancy}
                currentSavings={currentSavings}
                monthlyContribution={monthlyContribution}
                expectedReturn={expectedReturn}
                retirementSpending={retirementSpending}
                inflationRate={inflationRate}
              />
            )}
          </TabsContent>

          <TabsContent value="saved-plans" className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading saved plans...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                <p>Error loading saved plans: {error.message}</p>
              </div>
            ) : Array.isArray(savedPlans) && savedPlans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No saved plans found.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.isArray(savedPlans) && savedPlans.map((plan) => (
                  <SavedPlanCard
                    key={plan.id}
                    plan={plan}
                    onLoad={() => handleLoadPlan(plan)}
                    onDelete={() => handleDeletePlan(plan.id, plan.plan_name)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default RetirementPlanning;
