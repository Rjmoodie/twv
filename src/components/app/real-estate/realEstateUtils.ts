import { BRRRRResults, BRRRRInputs } from "./brrrrCalculations";
import { toast } from "@/hooks/use-toast";

/**
 * Utility functions for real estate calculations
 */

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  // An infinite return is the defining BRRRR success case: every dollar of
  // invested capital came back out on the refinance, so return on remaining
  // capital is unbounded. Render it rather than printing "Infinity%".
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '−∞';
  if (!Number.isFinite(value)) return 'N/M';
  return `${value.toFixed(1)}%`;
};

/**
 * Traditional real estate calculation for basic rental property analysis
 */
export const calculateTraditionalRealEstate = (
  propertyPrice: string,
  downPayment: string,
  monthlyRent: string,
  operatingExpenses: string
) => {
  if (!propertyPrice || !downPayment || !monthlyRent || !operatingExpenses) return null;

  const price = parseFloat(propertyPrice);
  const down = parseFloat(downPayment);
  const rent = parseFloat(monthlyRent);
  const expenses = parseFloat(operatingExpenses);

  const loanAmount = price - down;
  const monthlyPayment = loanAmount * 0.005; // Simplified 6% rate
  const netCashFlow = rent - monthlyPayment - expenses;
  const cashOnCashReturn = (netCashFlow * 12) / down * 100;
  const capRate = ((rent * 12) - (expenses * 12)) / price * 100;

  return {
    monthlyPayment: Math.round(monthlyPayment),
    netCashFlow: Math.round(netCashFlow),
    cashOnCashReturn: Math.round(cashOnCashReturn * 100) / 100,
    capRate: Math.round(capRate * 100) / 100,
    profitable: netCashFlow > 0
  };
};

/**
 * Generate comprehensive BRRRR deal report for export
 */
export const generateBRRRRReport = (
  inputs: BRRRRInputs,
  results: BRRRRResults,
  dealName: string,
  dealNotes?: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>BRRRR Deal Report - ${dealName || 'Untitled Deal'}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .section { margin-bottom: 30px; }
          .section h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
          .metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
          .metric { padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
          .metric-value { font-size: 1.2em; font-weight: bold; color: #2563eb; }
          .positive { color: #16a34a; }
          .negative { color: #dc2626; }
          .phase { margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px; }
          .phase h3 { margin-top: 0; color: #666; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>BRRRR Deal Analysis Report</h1>
          <h2>${dealName || 'Untitled Deal'}</h2>
          <p>Generated on ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="section">
          <h2>Executive Summary</h2>
          <div class="metrics">
            <div class="metric">
              <div>Total Investment</div>
              <div class="metric-value">${formatCurrency(results.totalInvestment)}</div>
            </div>
            <div class="metric">
              <div>Equity Created</div>
              <div class="metric-value">${formatCurrency(results.equityCreated)}</div>
            </div>
            <div class="metric">
              <div>Cash Out Amount</div>
              <div class="metric-value">${formatCurrency(results.cashOutAmount)}</div>
            </div>
            <div class="metric">
              <div>Capital Recycled</div>
              <div class="metric-value">${formatPercentage(results.capitalRecycled)}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2>Phase Analysis</h2>
          
          <div class="phase">
            <h3>Buy Phase</h3>
            <p><strong>Purchase Price:</strong> ${formatCurrency(inputs.purchasePrice)}</p>
            <p><strong>Down Payment:</strong> ${formatCurrency((inputs.purchasePrice * inputs.downPaymentPercent) / 100)} (${inputs.downPaymentPercent}%)</p>
            <p><strong>Total Acquisition Cost:</strong> ${formatCurrency(results.totalAcquisitionCost)}</p>
            <p><strong>Initial Cash Needed:</strong> ${formatCurrency(results.initialCashNeeded)}</p>
          </div>

          <div class="phase">
            <h3>Rehab Phase</h3>
            <p><strong>Renovation Budget:</strong> ${formatCurrency(inputs.renovationBudget)}</p>
            <p><strong>Contingency:</strong> ${formatCurrency((inputs.renovationBudget * inputs.contingencyPercent) / 100)} (${inputs.contingencyPercent}%)</p>
            <p><strong>Total Rehab Cost:</strong> ${formatCurrency(results.totalRehabCost)}</p>
            <p><strong>Holding Costs:</strong> ${formatCurrency(results.totalHoldingCost)}</p>
          </div>

          <div class="phase">
            <h3>Rent Phase</h3>
            <p><strong>Monthly Rent:</strong> ${formatCurrency(inputs.monthlyRent)}</p>
            <p><strong>Effective Monthly Rent:</strong> ${formatCurrency(results.effectiveMonthlyRent)}</p>
            <p><strong>Operating Expenses:</strong> ${formatCurrency(results.monthlyOperatingExpenses)}</p>
            <p><strong>Pre-Refi Cash Flow:</strong> <span class="${results.preRefinanceCashFlow >= 0 ? 'positive' : 'negative'}">${formatCurrency(results.preRefinanceCashFlow)}</span></p>
          </div>

          <div class="phase">
            <h3>Refinance Phase</h3>
            <p><strong>After Repair Value (ARV):</strong> ${formatCurrency(inputs.arv)}</p>
            <p><strong>Refinance LTV:</strong> ${inputs.refinanceLTV}%</p>
            <p><strong>Max Refinance Loan:</strong> ${formatCurrency(results.maxRefinanceLoan)}</p>
            <p><strong>Post-Refi Cash Flow:</strong> <span class="${results.postRefinanceCashFlow >= 0 ? 'positive' : 'negative'}">${formatCurrency(results.postRefinanceCashFlow)}</span></p>
            <p><strong>Remaining Equity:</strong> ${formatCurrency(results.remainingEquity)}</p>
          </div>
        </div>

        ${dealNotes ? `
        <div class="section">
          <h2>Notes</h2>
          <p>${dealNotes.replace(/\n/g, '<br>')}</p>
        </div>
        ` : ''}

        <div class="section">
          <h2>Investment Metrics</h2>
          <div class="metrics">
            <div class="metric">
              <div>Post-Refinance ROI</div>
              <div class="metric-value">${formatPercentage(results.postRefinanceROI)}</div>
            </div>
            <div class="metric">
              <div>Rent-to-Value Ratio</div>
              <div class="metric-value">${formatPercentage(results.rentToValueRatio)}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
};

/**
 * Export BRRRR deal to print/PDF
 */
export const exportBRRRRToPrint = (
  inputs: BRRRRInputs,
  results: BRRRRResults,
  dealName: string,
  dealNotes?: string
): void => {
  const html = generateBRRRRReport(inputs, results, dealName, dealNotes);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast({
      title: "Export Failed",
      description: "Unable to open print window. Please check your browser settings.",
      variant: "destructive",
    });
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.print();
};