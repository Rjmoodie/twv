import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { isRetirementFormValid } from "./retirementValidation";

interface RetirementInputFormProps {
  currentAge: string;
  setCurrentAge: (value: string) => void;
  retirementAge: string;
  setRetirementAge: (value: string) => void;
  lifeExpectancy: string;
  setLifeExpectancy: (value: string) => void;
  currentSavings: string;
  setCurrentSavings: (value: string) => void;
  monthlyContribution: string;
  setMonthlyContribution: (value: string) => void;
  expectedReturn: number[];
  setExpectedReturn: (value: number[]) => void;
  retirementSpending: string;
  setRetirementSpending: (value: string) => void;
  inflationRate: number[];
  setInflationRate: (value: number[]) => void;
  otherIncome: string;
  setOtherIncome: (value: string) => void;
  onCalculate: () => void;
}

const RetirementInputForm = ({
  currentAge,
  setCurrentAge,
  retirementAge,
  setRetirementAge,
  lifeExpectancy,
  setLifeExpectancy,
  currentSavings,
  setCurrentSavings,
  monthlyContribution,
  setMonthlyContribution,
  expectedReturn,
  setExpectedReturn,
  retirementSpending,
  setRetirementSpending,
  inflationRate,
  setInflationRate,
  otherIncome,
  setOtherIncome,
  onCalculate
}: RetirementInputFormProps) => {
  const isFormValid = () => isRetirementFormValid({
    currentAge, retirementAge, lifeExpectancy, currentSavings, monthlyContribution,
    retirementSpending, otherIncome, expectedReturn: expectedReturn[0],
  });

  const handleCalculate = () => {
    if (isFormValid()) {
      onCalculate();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement Planning</CardTitle>
        <CardDescription>Plan your financial future with comprehensive analysis</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Current Age</Label>
          <Input
            type="number"
            placeholder="Enter your current age"
            value={currentAge}
            onChange={(e) => setCurrentAge(e.target.value)}
            min={18}
            max={119}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Target Retirement Age</Label>
            <Input
              type="number"
              placeholder="Enter retirement age"
              value={retirementAge}
              onChange={(e) => setRetirementAge(e.target.value)}
              min={19}
              max={119}
            />
          </div>
          
          <div className="space-y-2">
            <Label>Life Expectancy</Label>
            <Input
              type="number"
              placeholder="Enter life expectancy"
              value={lifeExpectancy}
              onChange={(e) => setLifeExpectancy(e.target.value)}
              min={20}
              max={120}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Current Savings ($)</Label>
          <Input
            type="number"
            placeholder="Enter current savings"
            value={currentSavings}
            onChange={(e) => setCurrentSavings(e.target.value)}
            min={0}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Annual Contributions ($)</Label>
          <Input
            type="number"
            placeholder="Enter annual contributions"
            value={monthlyContribution}
            onChange={(e) => setMonthlyContribution(e.target.value)}
            min={0}
          />
          <p className="text-xs text-muted-foreground">
            Total amount you contribute to retirement savings each year
          </p>
        </div>
        
        <div className="space-y-2">
          <Label>Expected Retirement Spending (Annual $)</Label>
          <Input
            type="number"
            placeholder="Enter retirement spending"
            value={retirementSpending}
            onChange={(e) => setRetirementSpending(e.target.value)}
            min={0}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Other Income Sources (Annual $)</Label>
          <Input
            type="number"
            placeholder="Enter other income sources"
            value={otherIncome}
            onChange={(e) => setOtherIncome(e.target.value)}
            min={0}
          />
        </div>
        
        <div className="space-y-2">
          <Label>Expected Annual Return: {expectedReturn[0]}%</Label>
          <Slider
            value={expectedReturn}
            onValueChange={setExpectedReturn}
            max={20}
            min={0}
            step={0.5}
            className="w-full"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Inflation Rate: {inflationRate[0]}%</Label>
          <Slider
            value={inflationRate}
            onValueChange={setInflationRate}
            max={20}
            min={0}
            step={0.25}
            className="w-full"
          />
        </div>
        
        <Button onClick={handleCalculate} className="w-full" disabled={!isFormValid()}>
          Calculate Retirement Plan
        </Button>
        {!isFormValid() && (
          <p className="text-xs text-muted-foreground" role="status">
            Enter non-negative amounts and ages in order: current age, retirement age, then life expectancy.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default RetirementInputForm;
