export type PeerProfile = {
  ticker: string;
  name: string;
  cik?: string | null;
  industry?: string | null;
  sector?: string | null;
  sic?: string | null;
  marketCapitalization?: number | null;
  revenueTTM?: number | null;
  profitMarginTTM?: number | null;
  quarterlyRevenueGrowthYOY?: number | null;
};

export type PeerSuggestion = PeerProfile & {
  score: number;
  confidence: "high" | "medium";
  reasons: string[];
  warnings: string[];
};

export const PEER_GROUPS = [
  ["AAPL", "MSFT", "GOOGL", "DELL", "HPQ"],
  ["MSFT", "ORCL", "CRM", "ADBE", "GOOGL"],
  ["NVDA", "AMD", "INTC", "QCOM"],
  ["WMT", "COST", "TGT"], ["HD", "LOW"],
  ["JPM", "BAC", "C", "WFC"], ["GS", "MS"],
  ["XOM", "CVX", "COP"], ["PFE", "MRK", "LLY", "JNJ"],
  ["KO", "PEP"], ["MCD", "SBUX"], ["CAT", "DE"],
  ["BA", "LMT", "NOC"], ["PLD", "AMT", "EQIX"],
] as const;

const normalized = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const validPositive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const validFinite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function scaleSimilarity(target: unknown, candidate: unknown, points: number) {
  if (!validPositive(target) || !validPositive(candidate)) return { points: 0, available: false };
  const ordersApart = Math.abs(Math.log10(candidate / target));
  return { points: Math.max(0, points * (1 - ordersApart / 2)), available: true };
}

function valueSimilarity(target: unknown, candidate: unknown, tolerance: number, points: number) {
  if (!validFinite(target) || !validFinite(candidate)) return { points: 0, available: false };
  return { points: Math.max(0, points * (1 - Math.abs(candidate - target) / tolerance)), available: true };
}

export function scorePeer(target: PeerProfile, candidate: PeerProfile): PeerSuggestion | null {
  if (candidate.ticker === target.ticker) return null;
  if (target.cik && candidate.cik && target.cik === candidate.cik) return null;
  const targetIndustry = normalized(target.industry);
  const candidateIndustry = normalized(candidate.industry);
  const targetSector = normalized(target.sector);
  const candidateSector = normalized(candidate.sector);
  const exactIndustry = Boolean(targetIndustry) && targetIndustry === candidateIndustry;
  const exactSic = Boolean(target.sic) && String(target.sic) === String(candidate.sic);
  const sameSector = Boolean(targetSector) && targetSector === candidateSector;
  const targetWords = new Set(targetIndustry.split(" ").filter((word) => word.length > 2));
  const overlap = candidateIndustry.split(" ").filter((word) => targetWords.has(word)).length;
  const relatedGroup = PEER_GROUPS.some((group) => {
    const members = group as readonly string[];
    return members.includes(target.ticker) && members.includes(candidate.ticker);
  });

  // Never manufacture a peer from sector alone. A company needs a specific
  // classification relationship or an explicit, reviewable operating cohort.
  if (!exactIndustry && !exactSic && overlap === 0 && !relatedGroup) return null;

  let score = exactSic ? 42 : exactIndustry ? 38 : relatedGroup ? 40 : Math.min(24, overlap * 12);
  const reasons: string[] = [];
  const warnings: string[] = [];
  if (exactSic) reasons.push(`Same SEC SIC ${target.sic}`);
  else if (exactIndustry) reasons.push(`Same reported industry: ${candidate.industry}`);
  else if (overlap) reasons.push(`Related reported industry: ${candidate.industry}`);
  if (relatedGroup) reasons.push("Reviewed business or operating cohort");
  if (sameSector) { score += 8; reasons.push(`Same sector: ${candidate.sector}`); }
  else warnings.push("Different reported sector");

  const marketCap = scaleSimilarity(target.marketCapitalization, candidate.marketCapitalization, 18);
  const revenue = scaleSimilarity(target.revenueTTM, candidate.revenueTTM, 16);
  const margin = valueSimilarity(target.profitMarginTTM, candidate.profitMarginTTM, 0.35, 10);
  const growth = valueSimilarity(target.quarterlyRevenueGrowthYOY, candidate.quarterlyRevenueGrowthYOY, 0.5, 6);
  score += marketCap.points + revenue.points + margin.points + growth.points;
  if (!marketCap.available) warnings.push("Market-cap similarity unavailable");
  else if (marketCap.points >= 9) reasons.push("Comparable market-cap scale");
  else warnings.push("Market-cap scale differs materially");
  if (!revenue.available) warnings.push("Revenue similarity unavailable");
  else if (revenue.points >= 8) reasons.push("Comparable revenue scale");
  else warnings.push("Revenue scale differs materially");
  if (!margin.available) warnings.push("Margin similarity unavailable");
  else if (margin.points >= 5) reasons.push("Comparable profitability");
  if (!growth.available) warnings.push("Growth similarity unavailable");
  else if (growth.points >= 3) reasons.push("Comparable recent growth");

  const rounded = Math.min(100, Math.round(score));
  if (rounded < 45) return null;
  return { ...candidate, score: rounded, confidence: rounded >= 75 ? "high" : "medium", reasons, warnings };
}

export function rankPeers(target: PeerProfile, candidates: PeerProfile[], limit = 8) {
  const unique = new Map<string, PeerProfile>();
  for (const candidate of candidates) if (candidate.ticker && !unique.has(candidate.ticker)) unique.set(candidate.ticker, candidate);
  return [...unique.values()].map((candidate) => scorePeer(target, candidate)).filter((value): value is PeerSuggestion => value != null)
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker)).slice(0, limit);
}
