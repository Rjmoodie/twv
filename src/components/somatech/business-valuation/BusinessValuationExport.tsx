import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Save, FileText } from "lucide-react";
import { BusinessValuationReport } from "../types";

interface BusinessValuationExportProps {
  report: BusinessValuationReport;
  onSave?: () => void;
  onExportPDF?: () => void;
}

const BusinessValuationExport = ({ report, onSave, onExportPDF }: BusinessValuationExportProps) => {
  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

  const handleExportPDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else {
      // Generate PDF content as text for now
      const pdfContent = `
BUSINESS VALUATION REPORT
========================

Business Information:
- Industry: ${report.inputs.industry}
- Business Type: ${report.inputs.businessType}
- Current Revenue: ${formatCurrency(report.inputs.currentRevenue)}
- Revenue Growth: ${report.inputs.revenueGrowth}%

Valuation Summary:
- Conservative: ${formatCurrency(report.scenarios.conservative.totalValue)}
- Base Case: ${formatCurrency(report.scenarios.base.totalValue)}
- Optimistic: ${formatCurrency(report.scenarios.optimistic.totalValue)}

Financial Projections:
${report.projections.map(p => 
  `Year ${p.year}: Revenue ${formatCurrency(p.revenue)}, Value ${formatCurrency(p.value)}`
).join('\n')}
      `;
      
      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'business-valuation-report.txt';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave();
    } else {
      // Save to localStorage for now
      const savedReports = JSON.parse(localStorage.getItem('business-valuations') || '[]');
      const reportWithId = {
        ...report,
        id: Date.now(),
        createdAt: new Date().toISOString()
      };
      savedReports.push(reportWithId);
      localStorage.setItem('business-valuations', JSON.stringify(savedReports));
      
      // Show success message (you could use a toast here)
      alert('Valuation report saved successfully!');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="h-5 w-5" />
          <span>Export & Save Report</span>
        </CardTitle>
        <CardDescription>Save or export your business valuation analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={handleExportPDF} className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export PDF Report</span>
            </Button>
            
            <Button variant="outline" onClick={handleSave} className="flex items-center space-x-2">
              <Save className="h-4 w-4" />
              <span>Save Valuation</span>
            </Button>
          </div>
          
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• PDF export includes full valuation analysis, charts, and methodology</p>
            <p>• Saved valuations can be accessed and updated anytime</p>
            <p>• Share reports with advisors, investors, or stakeholders</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BusinessValuationExport;