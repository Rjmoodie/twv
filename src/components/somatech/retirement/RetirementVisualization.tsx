import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { generateRetirementChartData } from "../utils";
import { formatCurrency, formatCurrencyFull } from "./retirementUtils";
import { CHART_COLORS, GRID_PROPS, AXIS_PROPS, TOOLTIP_STYLE, ANIMATION_DURATION } from "@/lib/chartTheme";

interface RetirementVisualizationProps {
  currentAge: string;
  retirementAge: string;
  lifeExpectancy: string;
  currentSavings: string;
  monthlyContribution: string;
  expectedReturn: number[];
  retirementSpending: string;
  inflationRate: number[];
}

const RetirementVisualization = ({
  currentAge,
  retirementAge,
  lifeExpectancy,
  currentSavings,
  monthlyContribution,
  expectedReturn,
  retirementSpending,
  inflationRate
}: RetirementVisualizationProps) => {
  const chartData = generateRetirementChartData(
    currentAge,
    retirementAge,
    lifeExpectancy,
    currentSavings,
    monthlyContribution,
    expectedReturn,
    retirementSpending,
    inflationRate
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Retirement Savings Projection</CardTitle>
            <CardDescription>Accumulation + Decumulation from age {currentAge} to {lifeExpectancy}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart">Chart View</TabsTrigger>
            <TabsTrigger value="table">Table View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="space-y-4">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="age" {...AXIS_PROPS} />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} {...AXIS_PROPS} />
                  <Tooltip
                    {...TOOLTIP_STYLE}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        balance: 'Total Balance',
                        contributions: 'Total Contributions',
                        growth: 'Investment Growth'
                      };
                      return [formatCurrency(Number(value)), labels[name as string] || name];
                    }}
                    labelFormatter={(label) => `Age: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="contributions"
                    stackId="1"
                    stroke={CHART_COLORS.neutral}
                    fill={CHART_COLORS.muted}
                    animationDuration={ANIMATION_DURATION}
                  />
                  <Area
                    type="monotone"
                    dataKey="growth"
                    stackId="1"
                    stroke={CHART_COLORS.primary}
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.7}
                    animationDuration={ANIMATION_DURATION}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke={CHART_COLORS.foreground}
                    strokeWidth={2}
                    dot={false}
                    animationDuration={ANIMATION_DURATION}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="table" className="space-y-4">
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Age</th>
                    <th className="p-2 text-right">Balance</th>
                    <th className="p-2 text-right">Contributions</th>
                    <th className="p-2 text-right">Growth</th>
                    <th className="p-2 text-center">Phase</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{row.age}</td>
                      <td className="p-2 text-right">{formatCurrency(row.balance)}</td>
                      <td className="p-2 text-right">{formatCurrency(row.contributions)}</td>
                      <td className="p-2 text-right">{formatCurrency(row.growth)}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.phase === 'accumulation' ? 'bg-accent/10 text-accent' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {row.phase}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default RetirementVisualization;