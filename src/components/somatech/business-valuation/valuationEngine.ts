import { BusinessValuationInputs, ValuationMethods, BusinessValuationReport, ValuationScenarios } from "../types";
import { valuationMultiples } from "../constants";

export const calculateBusinessValuation = (
  inputs: BusinessValuationInputs,
  methods: ValuationMethods
): BusinessValuationReport => {
  const industryMultiples = valuationMultiples[inputs.industry as keyof typeof valuationMultiples] || valuationMultiples.other;
  
  // Calculate EBITDA and Net Income
  const currentEBITDA = inputs.currentRevenue * (inputs.ebitdaMargin / 100);
  const currentNetIncome = inputs.currentRevenue * (inputs.netMargin / 100);
  
  // Generate scenarios with different assumptions
  const scenarios: ValuationScenarios = {
    conservative: calculateScenario(inputs, methods, industryMultiples, 'conservative'),
    base: calculateScenario(inputs, methods, industryMultiples, 'base'),
    optimistic: calculateScenario(inputs, methods, industryMultiples, 'optimistic')
  };
  
  // Generate projections
  const projections = generateProjections(inputs, 'base');
  
  // Generate sensitivity analysis
  const sensitivityAnalysis = generateSensitivityAnalysis(inputs, methods, industryMultiples);
  
  return {
    inputs,
    scenarios,
    projections,
    sensitivityAnalysis
  };
};

const calculateScenario = (
  inputs: BusinessValuationInputs,
  methods: ValuationMethods,
  industryMultiples: any,
  scenario: 'conservative' | 'base' | 'optimistic'
) => {
  // Adjust assumptions based on scenario
  const scenarioMultipliers = {
    conservative: 0.8,
    base: 1.0,
    optimistic: 1.2
  };

  const multiplier = scenarioMultipliers[scenario];
  const adjustedGrowth = inputs.revenueGrowth * multiplier;
  const adjustedMargins = {
    ebitda: inputs.ebitdaMargin,
    net: inputs.netMargin
  };

  const futureRevenue = inputs.currentRevenue * Math.pow(1 + adjustedGrowth / 100, inputs.exitTimeframe);
  const futureEBITDA = futureRevenue * (adjustedMargins.ebitda / 100);
  const futureNetIncome = futureRevenue * (adjustedMargins.net / 100);

  const result: any = { totalValue: 0 };
  const values: number[] = [];

  if (methods.revenueMultiple) {
    const revenueMultiple = futureRevenue * industryMultiples.revenue;
    result.revenueMultiple = revenueMultiple;
    values.push(revenueMultiple);
  }

  if (methods.ebitdaMultiple && inputs.ebitdaMargin > 0) {
    const ebitdaMultiple = futureEBITDA * industryMultiples.ebitda;
    result.ebitdaMultiple = ebitdaMultiple;
    values.push(ebitdaMultiple);
  }

  if (methods.peMultiple && inputs.netMargin > 0) {
    const peMultiple = futureNetIncome * industryMultiples.pe;
    result.peMultiple = peMultiple;
    values.push(peMultiple);
  }

  if (methods.dcf) {
    const dcfValue = calculateDCF(inputs, adjustedGrowth, adjustedMargins.net, scenario);
    result.dcfValue = dcfValue;
    values.push(dcfValue);
  }

  result.totalValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  
  return result;
};

const calculateDCF = (
  inputs: BusinessValuationInputs,
  growthRate: number,
  netMargin: number,
  scenario: string
) => {
  const years = inputs.exitTimeframe;
  const discountRate = inputs.discountRate / 100;
  const terminalGrowthRate = inputs.terminalGrowthRate / 100;

  if (discountRate <= terminalGrowthRate) {
    return 0;
  }

  let presentValue = 0;
  let currentRevenue = inputs.currentRevenue;

  for (let year = 1; year <= years; year++) {
    currentRevenue *= (1 + growthRate / 100);
    const cashFlow = currentRevenue * (netMargin / 100);
    const discountFactor = Math.pow(1 + discountRate, year);
    presentValue += cashFlow / discountFactor;
  }

  const terminalCashFlow = currentRevenue * (1 + terminalGrowthRate) * (netMargin / 100);
  const terminalValue = terminalCashFlow / (discountRate - terminalGrowthRate);
  const discountedTerminalValue = terminalValue / Math.pow(1 + discountRate, years);

  return presentValue + discountedTerminalValue;
};

const generateProjections = (inputs: BusinessValuationInputs, scenario: string) => {
  const projections = [];
  const years = Math.min(inputs.exitTimeframe, 10); // Cap at 10 years
  let currentRevenue = inputs.currentRevenue;
  
  for (let year = 1; year <= years; year++) {
    currentRevenue *= (1 + inputs.revenueGrowth / 100);
    const ebitda = currentRevenue * (inputs.ebitdaMargin / 100);
    const netIncome = currentRevenue * (inputs.netMargin / 100);
    
    // Simple valuation based on revenue multiple
    const industryMultiples = valuationMultiples[inputs.industry as keyof typeof valuationMultiples] || valuationMultiples.other;
    const value = currentRevenue * industryMultiples.revenue;
    
    projections.push({
      year: new Date().getFullYear() + year,
      revenue: Math.round(currentRevenue),
      ebitda: Math.round(ebitda),
      netIncome: Math.round(netIncome),
      value: Math.round(value)
    });
  }
  
  return projections;
};

const generateSensitivityAnalysis = (
  inputs: BusinessValuationInputs,
  methods: ValuationMethods,
  industryMultiples: any
) => {
  const baseValue = inputs.currentRevenue * industryMultiples.revenue;
  
  // Revenue growth sensitivity
  const revenueGrowthImpact = [-10, -5, 0, 5, 10].map(adjustment => {
    const adjustedGrowth = inputs.revenueGrowth + adjustment;
    const futureRevenue = inputs.currentRevenue * Math.pow(1 + adjustedGrowth / 100, inputs.exitTimeframe);
    return {
      growth: adjustedGrowth,
      value: Math.round(futureRevenue * industryMultiples.revenue)
    };
  });
  
  // Margin sensitivity
  const marginImpact = [-5, -2.5, 0, 2.5, 5].map(adjustment => {
    const adjustedMargin = inputs.netMargin + adjustment;
    const netIncome = inputs.currentRevenue * (adjustedMargin / 100);
    return {
      margin: adjustedMargin,
      value: Math.round(netIncome * industryMultiples.pe)
    };
  });
  
  // Multiple sensitivity
  const multipleImpact = [-1, -0.5, 0, 0.5, 1].map(adjustment => {
    const adjustedMultiple = industryMultiples.revenue + adjustment;
    return {
      multiple: adjustedMultiple,
      value: Math.round(inputs.currentRevenue * adjustedMultiple)
    };
  });
  
  return {
    revenueGrowthImpact,
    marginImpact,
    multipleImpact
  };
};