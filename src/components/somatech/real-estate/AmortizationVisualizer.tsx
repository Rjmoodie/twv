import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import {
  CHART_COLORS, GRID_PROPS, AXIS_PROPS, TOOLTIP_STYLE,
  ANIMATION_DURATION, formatChartCurrency,
} from "@/lib/chartTheme";

interface YearRow {
  year: number;
  principal: number;
  interest: number;
  balance: number;
}

function buildSchedule(loanAmount: number, annualRate: number, termYears: number): YearRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;
  const monthlyPayment =
    monthlyRate === 0
      ? loanAmount / numPayments
      : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1);

  const rows: YearRow[] = [];
  let balance = loanAmount;

  for (let y = 1; y <= termYears; y++) {
    let yearPrincipal = 0;
    let yearInterest = 0;
    for (let m = 0; m < 12; m++) {
      if (balance <= 0) break;
      const interestPayment = balance * monthlyRate;
      const principalPayment = Math.min(monthlyPayment - interestPayment, balance);
      yearInterest += interestPayment;
      yearPrincipal += principalPayment;
      balance = Math.max(0, balance - principalPayment);
    }
    rows.push({
      year: y,
      principal: Math.round(yearPrincipal),
      interest: Math.round(yearInterest),
      balance: Math.round(balance),
    });
  }
  return rows;
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const principal = payload.find((p: any) => p.dataKey === "principal")?.value ?? 0;
  const interest = payload.find((p: any) => p.dataKey === "interest")?.value ?? 0;
  const total = principal + interest;
  return (
    <div style={TOOLTIP_STYLE.contentStyle} className="p-3 space-y-1">
      <p style={TOOLTIP_STYLE.labelStyle}>Year {label}</p>
      <p className="text-sm" style={{ color: CHART_COLORS.success }}>Principal: {fmt(principal)}</p>
      <p className="text-sm" style={{ color: CHART_COLORS.warning }}>Interest: {fmt(interest)}</p>
      <p className="text-xs text-muted-foreground border-t pt-1 mt-1">
        Interest share: {total > 0 ? Math.round((interest / total) * 100) : 0}%
      </p>
    </div>
  );
};

export const AmortizationVisualizer = () => {
  const [homePrice, setHomePrice] = useState("400000");
  const [downPayment, setDownPayment] = useState("80000");
  const [interestRate, setInterestRate] = useState("7");
  const [termYears, setTermYears] = useState("30");

  const { schedule, monthlyPayment, totalPaid, totalInterest, crossoverYear, loanAmount } = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    const down = parseFloat(downPayment) || 0;
    const rate = parseFloat(interestRate) || 0;
    const term = parseInt(termYears) || 30;
    const loan = Math.max(0, price - down);

    if (loan <= 0 || rate < 0 || term <= 0) {
      return { schedule: [], monthlyPayment: 0, totalPaid: 0, totalInterest: 0, crossoverYear: null, loanAmount: loan };
    }

    const rows = buildSchedule(loan, rate, term);
    const monthly =
      rate === 0
        ? loan / (term * 12)
        : (loan * (rate / 100 / 12) * Math.pow(1 + rate / 100 / 12, term * 12)) /
          (Math.pow(1 + rate / 100 / 12, term * 12) - 1);

    const totalP = rows.reduce((s, r) => s + r.principal + r.interest, 0);
    const totalI = rows.reduce((s, r) => s + r.interest, 0);
    const crossover = rows.find((r) => r.principal >= r.interest)?.year ?? null;

    return {
      schedule: rows,
      monthlyPayment: Math.round(monthly),
      totalPaid: Math.round(totalP),
      totalInterest: Math.round(totalI),
      crossoverYear: crossover,
      loanAmount: loan,
    };
  }, [homePrice, downPayment, interestRate, termYears]);

  const interestPct = totalPaid > 0 ? Math.round((totalInterest / totalPaid) * 100) : 0;
  const isValid = loanAmount > 0 && parseFloat(interestRate) >= 0;

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle>Mortgage Amortization</CardTitle>
          <CardDescription>
            See exactly how much of your payment goes to interest vs. paying down your loan — year by year.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Home Price ($)</Label>
              <Input
                type="number"
                value={homePrice}
                onChange={(e) => setHomePrice(e.target.value)}
                placeholder="400000"
              />
            </div>
            <div className="space-y-2">
              <Label>Down Payment ($)</Label>
              <Input
                type="number"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                placeholder="80000"
              />
            </div>
            <div className="space-y-2">
              <Label>Interest Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="7"
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Term</Label>
              <Select value={termYears} onValueChange={setTermYears}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 years</SelectItem>
                  <SelectItem value="15">15 years</SelectItem>
                  <SelectItem value="20">20 years</SelectItem>
                  <SelectItem value="25">25 years</SelectItem>
                  <SelectItem value="30">30 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isValid && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Payment</p>
                <p className="text-2xl font-bold mt-1">{fmt(monthlyPayment)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Loan Amount</p>
                <p className="text-2xl font-bold mt-1">{fmt(loanAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Paid</p>
                <p className="text-2xl font-bold mt-1">{fmt(totalPaid)}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-900">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Interest</p>
                <p className="text-2xl font-bold mt-1 text-warning">{fmt(totalInterest)}</p>
                <p className="text-xs text-muted-foreground mt-1">{interestPct}% of all payments</p>
              </CardContent>
            </Card>
          </div>

          {/* Insight callout */}
          <Card className="border-l-4 border-l-orange-400 bg-warning/10 dark:bg-warning/15/20">
            <CardContent className="pt-4 pb-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-sm">The real cost of this loan:</span>
                <Badge variant="secondary">
                  You borrow {fmt(loanAmount)} and repay {fmt(totalPaid)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="text-warning dark:text-warning font-medium">{fmt(totalInterest)}</span> goes
                directly to the lender — never reducing what you owe. That's{" "}
                <span className="font-medium">
                  {loanAmount > 0 ? Math.round((totalInterest / loanAmount) * 100) : 0}%
                </span>{" "}
                of your original loan in interest alone.
                {crossoverYear && (
                  <>
                    {" "}Your payments don't start favoring principal over interest until{" "}
                    <span className="font-medium">Year {crossoverYear}</span>.
                  </>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Stacked bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Annual Payment Breakdown</CardTitle>
              <CardDescription>
                Each bar shows how much of that year's payments went to interest vs. reducing your balance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={schedule} barCategoryGap="20%">
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis
                    dataKey="year"
                    {...AXIS_PROPS}
                    tickFormatter={(v) => `Yr ${v}`}
                    interval={Math.floor(schedule.length / 10)}
                  />
                  <YAxis
                    {...AXIS_PROPS}
                    tickFormatter={formatChartCurrency}
                    width={72}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs capitalize text-muted-foreground">{value}</span>
                    )}
                  />
                  {crossoverYear && (
                    <ReferenceLine
                      x={crossoverYear}
                      stroke={CHART_COLORS.neutral}
                      strokeDasharray="4 4"
                      label={{
                        value: "Crossover",
                        position: "top",
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                  )}
                  <Bar
                    dataKey="interest"
                    name="Interest"
                    stackId="a"
                    fill={CHART_COLORS.warning}
                    animationDuration={ANIMATION_DURATION}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="principal"
                    name="Principal"
                    stackId="a"
                    fill={CHART_COLORS.success}
                    animationDuration={ANIMATION_DURATION}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Year-by-year table */}
          <Card>
            <CardHeader>
              <CardTitle>Year-by-Year Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="text-left py-2 pr-4">Year</th>
                      <th className="text-right py-2 pr-4">Principal Paid</th>
                      <th className="text-right py-2 pr-4 text-warning">Interest Paid</th>
                      <th className="text-right py-2 pr-4">Interest %</th>
                      <th className="text-right py-2">Remaining Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row) => {
                      const yearTotal = row.principal + row.interest;
                      const iPct = yearTotal > 0 ? Math.round((row.interest / yearTotal) * 100) : 0;
                      const isCrossover = row.year === crossoverYear;
                      return (
                        <tr
                          key={row.year}
                          className={`border-b border-border/40 hover:bg-muted/30 transition-colors ${
                            isCrossover ? "bg-muted/50 font-medium" : ""
                          }`}
                        >
                          <td className="py-2 pr-4 font-medium">
                            {row.year}
                            {isCrossover && (
                              <Badge variant="outline" className="ml-2 text-xs">crossover</Badge>
                            )}
                          </td>
                          <td className="text-right py-2 pr-4 text-accent dark:text-accent">
                            {fmt(row.principal)}
                          </td>
                          <td className="text-right py-2 pr-4 text-warning">{fmt(row.interest)}</td>
                          <td className="text-right py-2 pr-4">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                iPct > 50
                                  ? "bg-warning/10 dark:bg-warning/15/40 text-warning dark:text-warning"
                                  : "bg-accent/10 dark:bg-accent/40 text-accent dark:text-accent"
                              }`}
                            >
                              {iPct}%
                            </span>
                          </td>
                          <td className="text-right py-2">{fmt(row.balance)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold text-sm">
                      <td className="py-3 pr-4">Total</td>
                      <td className="text-right py-3 pr-4 text-accent dark:text-accent">
                        {fmt(schedule.reduce((s, r) => s + r.principal, 0))}
                      </td>
                      <td className="text-right py-3 pr-4 text-warning">
                        {fmt(totalInterest)}
                      </td>
                      <td className="text-right py-3 pr-4 text-muted-foreground text-xs">
                        {interestPct}%
                      </td>
                      <td className="text-right py-3">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
