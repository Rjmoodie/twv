import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  ticker: string;
}

const TradingViewChart = ({ ticker }: TradingViewChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    // Create TradingView widget script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: "D",
      timezone: "Etc/UTC",
      theme: "light",
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      allow_symbol_change: true,
      container_id: `tradingview_${ticker}`,
      studies: ["RSI@tv-basicstudies", "MACD@tv-basicstudies"],
      hide_side_toolbar: false,
      save_image: false,
      hide_volume: false
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [ticker]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Chart - {ticker}</CardTitle>
        <CardDescription>Professional TradingView chart with real-time data</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div
          ref={containerRef}
          className="h-64 w-full sm:h-80 lg:h-[420px]"
          id={`tradingview_${ticker}`}
        />
      </CardContent>
    </Card>
  );
};

export default TradingViewChart;