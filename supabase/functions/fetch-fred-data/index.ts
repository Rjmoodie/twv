import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const FRED_API_KEY = Deno.env.get("FRED_API_KEY");
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const FRED_SERIES = {
  gdpGrowth: "A191RL1Q225SBEA",
  inflation: "CPIAUCSL",
  oilPrice: "DCOILBRENTEU",
  usdIndex: "DTWEXBGS",
  fedFundsRate: "FEDFUNDS",
  treasury10Y: "DGS10",
  unemployment: "UNRATE",
};

async function fetchFREDLatest(seriesId: string) {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.observations && data.observations.length > 0) {
    return parseFloat(data.observations[0].value);
  }
  return null;
}

serve(async (req) => {
  try {
    const [gdpGrowth, inflation, oilPrice, usdIndex, fedFundsRate, treasury10Y, unemployment] = await Promise.all([
      fetchFREDLatest(FRED_SERIES.gdpGrowth),
      fetchFREDLatest(FRED_SERIES.inflation),
      fetchFREDLatest(FRED_SERIES.oilPrice),
      fetchFREDLatest(FRED_SERIES.usdIndex),
      fetchFREDLatest(FRED_SERIES.fedFundsRate),
      fetchFREDLatest(FRED_SERIES.treasury10Y),
      fetchFREDLatest(FRED_SERIES.unemployment),
    ]);
    return new Response(
      JSON.stringify({ gdpGrowth, inflation, oilPrice, usdIndex, fedFundsRate, treasury10Y, unemployment }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}); 