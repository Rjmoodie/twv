import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Save, Share2 } from "lucide-react";
import { CashFlowReport } from "../types";
import { useToast } from "@/hooks/use-toast";

interface CashFlowExportProps {
  report: CashFlowReport;
  activeScenario: 'conservative' | 'base' | 'optimistic';
}

const CashFlowExport = ({ report, activeScenario }: CashFlowExportProps) => {
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const generatePDFContent = () => {
    const currentScenario = report.scenarios[activeScenario];
    
    return `
      CASH FLOW SIMULATION REPORT
      ===========================
      
      Business: ${report.inputs.businessName || 'Unnamed Business'}
      Industry: ${report.inputs.industry}
      Generated: ${new Date().toLocaleDateString()}
      Scenario: ${activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}
      
      EXECUTIVE SUMMARY
      ================
      Starting Cash: ${formatCurrency(report.inputs.startingCash)}
      Ending Cash: ${formatCurrency(currentScenario.endingCash)}
      Net Change: ${formatCurrency(currentScenario.endingCash - report.inputs.startingCash)}
      Cash Runway: ${Number.isFinite(currentScenario.runway) ? `${currentScenario.runway} months` : 'Infinite'}
      Break-even Month: ${currentScenario.breakEvenMonth > 0 ? `Month ${currentScenario.breakEvenMonth}` : 'N/A'}
      
      FINANCIAL INPUTS
      ===============
      Monthly Revenue: ${formatCurrency(report.inputs.monthlyRevenue)}
      Revenue Growth Rate: ${report.inputs.revenueGrowthRate}% per month
      Tax Rate: ${report.inputs.taxRate}%
      
      Fixed Expenses:
      ${report.inputs.fixedExpenses.map(exp => `- ${exp.name}: ${formatCurrency(exp.amount)}`).join('\n')}
      
      Variable Expenses:
      ${report.inputs.variableExpenses.map(exp => `- ${exp.name}: ${exp.isPercentage ? `${exp.amount}%` : formatCurrency(exp.amount)}`).join('\n')}
      
      MONTHLY PROJECTIONS (${activeScenario.toUpperCase()})
      ====================================
      ${currentScenario.monthlyProjections.map(month => 
        `Month ${month.month}: Inflows ${formatCurrency(month.inflows)}, Outflows ${formatCurrency(month.outflows)}, Net ${formatCurrency(month.netFlow)}, Balance ${formatCurrency(month.cashBalance)}`
      ).join('\n')}
      
      ALERTS & RECOMMENDATIONS
      =======================
      ${currentScenario.alerts.map(alert => `- ${alert.title}: ${alert.description}`).join('\n')}
    `;
  };

  const handleExportPDF = () => {
    const content = generatePDFContent();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-flow-report-${activeScenario}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Report Exported",
      description: "Your cash flow report has been downloaded successfully.",
    });
  };

  const handleSaveReport = () => {
    // For now, we'll save to localStorage
    const savedReports = JSON.parse(localStorage.getItem('cashFlowReports') || '[]');
    const reportData = {
      id: Date.now(),
      businessName: report.inputs.businessName || 'Unnamed Business',
      scenario: activeScenario,
      createdAt: new Date().toISOString(),
      report: report
    };
    
    savedReports.push(reportData);
    localStorage.setItem('cashFlowReports', JSON.stringify(savedReports));
    
    toast({
      title: "Report Saved",
      description: "Your cash flow report has been saved successfully.",
    });
  };

  const handleShareReport = () => {
    const shareData = {
      title: `Cash Flow Report - ${report.inputs.businessName || 'Business'}`,
      text: `Cash flow simulation showing ${formatCurrency(report.scenarios[activeScenario].endingCash)} ending cash balance`,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link Copied",
        description: "Report link has been copied to clipboard.",
      });
    }
  };

  const handleExportCSV = () => {
    const currentScenario = report.scenarios[activeScenario];
    const csvHeaders = ['Month', 'Inflows', 'Outflows', 'Net Flow', 'Cash Balance'];
    const csvRows = currentScenario.monthlyProjections.map(month => [
      month.month,
      month.inflows,
      month.outflows,
      month.netFlow,
      month.cashBalance
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-flow-data-${activeScenario}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Data Exported",
      description: "Cash flow data has been exported to CSV.",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Export & Save
        </CardTitle>
        <CardDescription>
          Export your cash flow analysis or save for future reference
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button 
          onClick={handleExportPDF} 
          className="w-full justify-start" 
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF Report
        </Button>
        
        <Button 
          onClick={handleExportCSV} 
          className="w-full justify-start" 
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV Data
        </Button>
        
        <Button 
          onClick={handleSaveReport} 
          className="w-full justify-start" 
          variant="outline"
        >
          <Save className="h-4 w-4 mr-2" />
          Save Analysis
        </Button>
        
        <Button 
          onClick={handleShareReport} 
          className="w-full justify-start" 
          variant="outline"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Share Report
        </Button>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">Report Summary</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Business: {report.inputs.businessName || 'Unnamed'}</div>
            <div>Scenario: {activeScenario.charAt(0).toUpperCase() + activeScenario.slice(1)}</div>
            <div>Timeframe: {report.inputs.timeframe} months</div>
            <div>Generated: {new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowExport;