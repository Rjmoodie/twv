import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  /** Override auto color — defaults to green if trending up, red if trending down */
  color?: string;
  height?: number;
  className?: string;
}

export function Sparkline({ data, color, height = 40, className }: SparklineProps) {
  const uid = useId();
  const gradId = `sparkGrad-${uid.replace(/:/g, "")}`;

  const isPositive = data.length >= 2 && data[data.length - 1] >= data[0];
  const lineColor = color ?? (isPositive ? "hsl(var(--chart-1))" : "hsl(var(--destructive))");

  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.25} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={lineColor}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
