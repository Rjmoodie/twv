import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { industryOptions } from "../constants";
import { CashFlowInputs } from "../types";
import { Calculator, Plus, Trash2 } from "lucide-react";

interface CashFlowInputFormProps {
  inputs: CashFlowInputs;
  onInputChange: (field: keyof CashFlowInputs, value: any) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

const CashFlowInputForm = ({ inputs, onInputChange, onCalculate, isCalculating }: CashFlowInputFormProps) => {
  const [activeTab, setActiveTab] = useState("business");

  // Simplified validation - only check if basic fields are filled
  const isFormValid = inputs.businessName.trim() !== "" && 
    inputs.industry && 
    inputs.startingCash !== undefined && 
    inputs.monthlyRevenue !== undefined;

  const handleInputChange = (field: keyof CashFlowInputs, value: any) => {
    // Allow any input value - no validation
    onInputChange(field, value);
  };

  const addExpenseItem = (category: 'fixed' | 'variable') => {
    const newItem = { name: "", amount: 0, isPercentage: false };
    if (category === 'fixed') {
      onInputChange('fixedExpenses', [...inputs.fixedExpenses, newItem]);
    } else {
      onInputChange('variableExpenses', [...inputs.variableExpenses, newItem]);
    }
  };

  const removeExpenseItem = (category: 'fixed' | 'variable', index: number) => {
    if (category === 'fixed') {
      const updated = inputs.fixedExpenses.filter((_, i) => i !== index);
      onInputChange('fixedExpenses', updated);
    } else {
      const updated = inputs.variableExpenses.filter((_, i) => i !== index);
      onInputChange('variableExpenses', updated);
    }
  };

  const updateExpenseItem = (category: 'fixed' | 'variable', index: number, field: string, value: any) => {
    if (category === 'fixed') {
      const updated = [...inputs.fixedExpenses];
      updated[index] = { ...updated[index], [field]: value };
      onInputChange('fixedExpenses', updated);
    } else {
      const updated = [...inputs.variableExpenses];
      updated[index] = { ...updated[index], [field]: value };
      onInputChange('variableExpenses', updated);
    }
  };

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Calculator className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="truncate">Cash Flow Simulator</span>
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Model your business cash flow across multiple scenarios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 text-xs sm:text-sm">
            <TabsTrigger value="business" className="px-1 sm:px-3">Business</TabsTrigger>
            <TabsTrigger value="revenue" className="px-1 sm:px-3">Revenue</TabsTrigger>
            <TabsTrigger value="expenses" className="px-1 sm:px-3">Expenses</TabsTrigger>
            <TabsTrigger value="financing" className="px-1 sm:px-3">Financing</TabsTrigger>
          </TabsList>

          <TabsContent value="business" className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name (Optional)</Label>
              <Input
                placeholder="Enter business name"
                value={inputs.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={inputs.industry}
                onValueChange={(value) => handleInputChange('industry', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Starting Cash Balance ($)</Label>
              <Input
                type="number"
                placeholder="100000"
                value={inputs.startingCash || ''}
                onChange={(e) => handleInputChange('startingCash', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Simulation Timeframe</Label>
              <Select
                value={inputs.timeframe.toString()}
                onValueChange={(value) => handleInputChange('timeframe', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                  <SelectItem value="36">36 months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <div className="space-y-2">
              <Label>Monthly Revenue ($)</Label>
              <Input
                type="number"
                placeholder="50000"
                value={inputs.monthlyRevenue || ''}
                onChange={(e) => handleInputChange('monthlyRevenue', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Revenue Growth Rate (% per month)</Label>
              <Input
                type="number"
                placeholder="5"
                value={inputs.revenueGrowthRate || ''}
                onChange={(e) => handleInputChange('revenueGrowthRate', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={inputs.hasSeasonality}
                onCheckedChange={(checked) => handleInputChange('hasSeasonality', checked)}
              />
              <Label>Revenue has seasonality</Label>
            </div>

            {inputs.hasSeasonality && (
              <div className="space-y-2">
                <Label>Peak Season Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  value={inputs.seasonalityMultiplier || ''}
                  onChange={(e) => handleInputChange('seasonalityMultiplier', parseFloat(e.target.value) || 1)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Accounts Receivable (Days)</Label>
              <Input
                type="number"
                placeholder="30"
                value={inputs.accountsReceivableDays || ''}
                onChange={(e) => handleInputChange('accountsReceivableDays', parseFloat(e.target.value) || 0)}
              />
            </div>
          </TabsContent>

          <TabsContent value="expenses" className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm sm:text-base font-medium">Fixed Expenses (Monthly)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addExpenseItem('fixed')}
                  className="px-2 sm:px-3"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Add</span>
                </Button>
              </div>
              <div className="space-y-2">
                {inputs.fixedExpenses.map((expense, index) => (
                  <div key={index} className="flex gap-1 sm:gap-2">
                    <Input
                      placeholder="Expense name"
                      value={expense.name}
                      onChange={(e) => updateExpenseItem('fixed', index, 'name', e.target.value)}
                      className="flex-1 text-xs sm:text-sm"
                    />
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={expense.amount || ''}
                      onChange={(e) => updateExpenseItem('fixed', index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-20 sm:w-32 text-xs sm:text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExpenseItem('fixed', index)}
                      className="px-2"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm sm:text-base font-medium">Variable Expenses</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addExpenseItem('variable')}
                  className="px-2 sm:px-3"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1">Add</span>
                </Button>
              </div>
              <div className="space-y-2">
                {inputs.variableExpenses.map((expense, index) => (
                  <div key={index} className="flex gap-1 sm:gap-2 items-center">
                    <Input
                      placeholder="e.g. Marketing"
                      value={expense.name}
                      onChange={(e) => updateExpenseItem('variable', index, 'name', e.target.value)}
                      className="flex-1 text-xs sm:text-sm"
                    />
                    <Input
                      type="number"
                      placeholder={expense.isPercentage ? "%" : "$"}
                      value={expense.amount || ''}
                      onChange={(e) => updateExpenseItem('variable', index, 'amount', parseFloat(e.target.value) || 0)}
                      className="w-16 sm:w-24 text-xs sm:text-sm"
                    />
                    <div className="flex items-center px-1">
                      <Switch
                        checked={expense.isPercentage}
                        onCheckedChange={(checked) => updateExpenseItem('variable', index, 'isPercentage', checked)}
                        className="scale-75 sm:scale-100"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeExpenseItem('variable', index)}
                      className="px-2"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                placeholder="25"
                value={inputs.taxRate || ''}
                onChange={(e) => handleInputChange('taxRate', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label>Accounts Payable (Days)</Label>
              <Input
                type="number"
                placeholder="30"
                value={inputs.accountsPayableDays || ''}
                onChange={(e) => handleInputChange('accountsPayableDays', parseFloat(e.target.value) || 0)}
              />
            </div>
          </TabsContent>

          <TabsContent value="financing" className="space-y-4">
            <div className="space-y-2">
              <Label>Loan Amount ($)</Label>
              <Input
                type="number"
                placeholder="0"
                value={inputs.loanAmount || ''}
                onChange={(e) => handleInputChange('loanAmount', parseFloat(e.target.value) || 0)}
              />
            </div>

            {inputs.loanAmount > 0 && (
              <>
                <div className="space-y-2">
                  <Label>Interest Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="5.5"
                    value={inputs.interestRate || ''}
                    onChange={(e) => handleInputChange('interestRate', parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Loan Term (Months)</Label>
                  <Input
                    type="number"
                    placeholder="60"
                    value={inputs.loanTermMonths || ''}
                    onChange={(e) => handleInputChange('loanTermMonths', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Equity Raised ($)</Label>
              <Input
                type="number"
                placeholder="0"
                value={inputs.equityRaised || ''}
                onChange={(e) => handleInputChange('equityRaised', parseFloat(e.target.value) || 0)}
              />
            </div>

            {inputs.equityRaised > 0 && (
              <div className="space-y-2">
                <Label>Equity Raise Month</Label>
                <Input
                  type="number"
                  placeholder="6"
                  min="1"
                  max={inputs.timeframe}
                  value={inputs.equityRaiseMonth || ''}
                  onChange={(e) => handleInputChange('equityRaiseMonth', parseFloat(e.target.value) || 1)}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="mt-6 pt-4 border-t">
          <Button 
            onClick={onCalculate} 
            className="w-full" 
            disabled={isCalculating || !isFormValid}
          >
            {isCalculating ? "Calculating..." : "Run Cash Flow Simulation"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowInputForm;