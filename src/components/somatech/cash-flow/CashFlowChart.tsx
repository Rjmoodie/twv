import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ComposedChart, Area, AreaChart } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { CashFlowReport } from "../types";
import { CHART_COLORS, GRID_PROPS, AXIS_PROPS, TOOLTIP_STYLE, ANIMATION_DURATION, formatChartCurrency } from "@/lib/chartTheme";

interface CashFlowChartProps {
  report: CashFlowReport;
  activeScenario: 'conservative' | 'base' | 'optimistic';
}

const CashFlowChart = ({ report, activeScenario }: CashFlowChartProps) => {
  const [chartType, setChartType] = useState<'cashBalance' | 'cashFlow' | 'comparison'>('cashBalance');
  
  const formatCurrency = formatChartCurrency;

  const currentScenario = report.scenarios[activeScenario];
  
  // Prepare data for cash balance chart
  const cashBalanceData = currentScenario.monthlyProjections.map((month) => ({
    month: `M${month.month}`,
    cashBalance: month.cashBalance,
    netFlow: month.netFlow,
    inflows: month.inflows,
    outflows: month.outflows,
  }));

  // Prepare comparison data
  const comparisonData = report.scenarios.base.monthlyProjections.map((_, index) => ({
    month: `M${index + 1}`,
    conservative: report.scenarios.conservative.monthlyProjections[index]?.cashBalance || 0,
    base: report.scenarios.base.monthlyProjections[index]?.cashBalance || 0,
    optimistic: report.scenarios.optimistic.monthlyProjections[index]?.cashBalance || 0,
  }));

  const renderCashBalanceChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={cashBalanceData}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="month" {...AXIS_PROPS} />
        <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          labelFormatter={(label) => `Month ${label.replace('M', '')}`}
        />
        <Area
          type="monotone"
          dataKey="cashBalance"
          fill={CHART_COLORS.primary}
          fillOpacity={0.15}
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          name="Cash Balance"
          animationDuration={ANIMATION_DURATION}
        />
        <Line
          type="monotone"
          dataKey="netFlow"
          stroke={CHART_COLORS.chart2}
          strokeWidth={2}
          dot={false}
          name="Net Cash Flow"
          animationDuration={ANIMATION_DURATION}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const renderCashFlowChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={cashBalanceData}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="month" {...AXIS_PROPS} />
        <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          labelFormatter={(label) => `Month ${label.replace('M', '')}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="inflows" fill={CHART_COLORS.success} name="Inflows" animationDuration={ANIMATION_DURATION} radius={[3, 3, 0, 0]} />
        <Bar dataKey="outflows" fill={CHART_COLORS.warning} name="Outflows" animationDuration={ANIMATION_DURATION} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const renderComparisonChart = () => (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={comparisonData}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="month" {...AXIS_PROPS} />
        <YAxis tickFormatter={formatCurrency} {...AXIS_PROPS} />
        <Tooltip
          {...TOOLTIP_STYLE}
          formatter={(value: number, name: string) => [formatCurrency(value), name]}
          labelFormatter={(label) => `Month ${label.replace('M', '')}`}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="conservative"
          stroke={CHART_COLORS.warning}
          strokeWidth={2}
          name="Conservative"
          strokeDasharray="5 5"
          dot={false}
          animationDuration={ANIMATION_DURATION}
        />
        <Line
          type="monotone"
          dataKey="base"
          stroke={CHART_COLORS.primary}
          strokeWidth={3}
          name="Base Case"
          dot={false}
          animationDuration={ANIMATION_DURATION}
        />
        <Line
          type="monotone"
          dataKey="optimistic"
          stroke={CHART_COLORS.success}
          strokeWidth={2}
          name="Optimistic"
          strokeDasharray="5 5"
          dot={false}
          animationDuration={ANIMATION_DURATION}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg sm:text-xl">Cash Flow Visualization</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Interactive charts showing your cash flow projections
            </CardDescription>
          </div>
          <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cashBalance">Cash Balance Over Time</SelectItem>
              <SelectItem value="cashFlow">Monthly Cash Flow</SelectItem>
              <SelectItem value="comparison">Scenario Comparison</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {chartType === 'cashBalance' && renderCashBalanceChart()}
        {chartType === 'cashFlow' && renderCashFlowChart()}
        {chartType === 'comparison' && renderComparisonChart()}
        
        <div className="mt-4 text-sm text-muted-foreground">
          {chartType === 'cashBalance' && "Shows cash balance and net cash flow over time"}
          {chartType === 'cashFlow' && "Compares monthly inflows vs outflows"}
          {chartType === 'comparison' && "Compares cash balance across all scenarios"}
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;