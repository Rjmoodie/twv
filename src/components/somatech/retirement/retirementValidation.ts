export interface RetirementFormValues {
  currentAge: string;
  retirementAge: string;
  lifeExpectancy: string;
  currentSavings: string;
  monthlyContribution: string;
  retirementSpending: string;
  otherIncome: string;
  expectedReturn: number | undefined;
}

export function isRetirementFormValid(values: RetirementFormValues): boolean {
  const required = [values.currentAge, values.retirementAge, values.lifeExpectancy,
    values.currentSavings, values.monthlyContribution, values.retirementSpending];
  if (required.some((value) => value.trim() === '')) return false;

  const age = Number(values.currentAge);
  const targetAge = Number(values.retirementAge);
  const lifespan = Number(values.lifeExpectancy);
  const amounts = [values.currentSavings, values.monthlyContribution, values.retirementSpending].map(Number);
  const other = values.otherIncome.trim() === '' ? 0 : Number(values.otherIncome);
  return Number.isInteger(age) && age >= 18 && age < targetAge &&
    Number.isInteger(targetAge) && targetAge < lifespan &&
    Number.isInteger(lifespan) && lifespan <= 120 &&
    amounts.every((amount) => Number.isFinite(amount) && amount >= 0) &&
    Number.isFinite(other) && other >= 0 &&
    Number.isFinite(values.expectedReturn) && values.expectedReturn! >= 0 && values.expectedReturn! <= 20;
}
