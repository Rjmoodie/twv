import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Star, TrendingUp, DollarSign, Minus as Dog } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  marketShare: string; // relative to largest competitor (1x = equal, 2x = twice as large)
  marketGrowth: string; // %
}

const QUADRANT_META = {
  star:        { label: 'Star',         color: '#10b981', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-accent dark:text-accent', icon: Star,      desc: 'High share, high growth. Invest to maintain position — these become cash cows as the market matures.' },
  cashCow:     { label: 'Cash Cow',     color: '#3b82f6', bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-700 dark:text-blue-400',       icon: DollarSign, desc: 'High share, low growth. Milk profits to fund Stars and Question Marks. Defend position.' },
  questionMark:{ label: 'Question Mark',color: '#f59e0b', bg: 'bg-warning/100/10',   border: 'border-warning/20/30',   text: 'text-warning dark:text-warning',     icon: TrendingUp, desc: 'Low share, high growth. Decide: invest heavily to become a Star, or divest.' },
  dog:         { label: 'Dog',          color: '#6b7280', bg: 'bg-muted',          border: 'border-border',         text: 'text-muted-foreground',                  icon: Dog,        desc: 'Low share, low growth. Generate little cash. Consider divesting unless there is a strategic reason to keep.' },
};

type QuadrantKey = keyof typeof QUADRANT_META;

function getQuadrant(share: number, growth: number): QuadrantKey {
  const highShare = share >= 1;  // ≥ 1× = at least equal to largest competitor
  const highGrowth = growth >= 10; // 10% threshold (classic BCG)
  if (highShare && highGrowth) return 'star';
  if (highShare && !highGrowth) return 'cashCow';
  if (!highShare && highGrowth) return 'questionMark';
  return 'dog';
}

const PRESETS: Product[] = [
  { id: 1, name: 'iPhone',        marketShare: '1.8', marketGrowth: '6'  },
  { id: 2, name: 'Mac',           marketShare: '0.9', marketGrowth: '8'  },
  { id: 3, name: 'iPad',          marketShare: '1.5', marketGrowth: '4'  },
  { id: 4, name: 'Apple Watch',   marketShare: '2.5', marketGrowth: '18' },
  { id: 5, name: 'Apple TV+',     marketShare: '0.4', marketGrowth: '22' },
];

let nextId = 10;

export default function BCGMatrix() {
  const [products, setProducts] = useState<Product[]>([
    { id: 1, name: '', marketShare: '', marketGrowth: '' },
    { id: 2, name: '', marketShare: '', marketGrowth: '' },
    { id: 3, name: '', marketShare: '', marketGrowth: '' },
  ]);

  const update = (id: number, field: keyof Product, val: string) =>
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: val } : p)));

  const add = () => setProducts((prev) => [...prev, { id: nextId++, name: '', marketShare: '', marketGrowth: '' }]);
  const remove = (id: number) => setProducts((prev) => prev.filter((p) => p.id !== id));

  const loadPreset = () => setProducts(PRESETS);

  const parsed = products
    .filter((p) => p.name.trim())
    .map((p) => {
      const share = parseFloat(p.marketShare);
      const growth = parseFloat(p.marketGrowth);
      if (isNaN(share) || isNaN(growth) || share <= 0) return null;
      return { ...p, share, growth, quadrant: getQuadrant(share, growth) };
    })
    .filter(Boolean) as { id: number; name: string; share: number; growth: number; quadrant: QuadrantKey }[];

  const byQuadrant = (q: QuadrantKey) => parsed.filter((p) => p.quadrant === q);

  // Dot plot coordinates: x = log scale market share (0.1 → 10), y = market growth
  const GROWTH_THRESHOLD = 10;
  const SHARE_THRESHOLD = 1;

  // SVG dimensions
  const W = 400, H = 340, PAD = 40;
  const plotW = W - PAD * 2;
  const plotH = H - PAD * 2;

  // x: log scale share 0.1 – 10
  const xScale = (share: number) => {
    const lo = Math.log10(0.1), hi = Math.log10(10);
    return PAD + ((Math.log10(Math.max(0.1, Math.min(10, share))) - lo) / (hi - lo)) * plotW;
  };
  // y: growth -5 to 30, top of chart = high growth
  const yScale = (growth: number) => {
    const lo = -5, hi = 30;
    return PAD + plotH - ((Math.max(lo, Math.min(hi, growth)) - lo) / (hi - lo)) * plotH;
  };

  const dividerX = xScale(SHARE_THRESHOLD);
  const dividerY = yScale(GROWTH_THRESHOLD);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-sm text-muted-foreground">
          Plot business units by relative market share and market growth rate to prioritise investment.
        </p>
        <Button size="sm" variant="outline" className="text-xs h-7 shrink-0" onClick={loadPreset}>
          Load Apple example
        </Button>
      </div>

      {/* Input table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left py-2 pr-3 font-medium">Product / BU</th>
              <th className="text-center py-2 px-2 font-medium" title="Relative market share vs. largest competitor (1× = tied, 2× = twice as large)">Rel. Share (×)</th>
              <th className="text-center py-2 px-2 font-medium" title="Annual market growth rate in %">Growth (%)</th>
              <th className="text-center py-2 px-2 font-medium">Quadrant</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {products.map((p) => {
              const share = parseFloat(p.marketShare);
              const growth = parseFloat(p.marketGrowth);
              const valid = p.name.trim() && !isNaN(share) && share > 0 && !isNaN(growth);
              const q = valid ? getQuadrant(share, growth) : null;
              const meta = q ? QUADRANT_META[q] : null;
              return (
                <tr key={p.id}>
                  <td className="py-1.5 pr-3">
                    <Input
                      value={p.name}
                      onChange={(e) => update(p.id, 'name', e.target.value)}
                      placeholder="e.g. Product A"
                      className="h-7 text-xs"
                    />
                  </td>
                  <td className="py-1.5 px-1.5">
                    <Input
                      type="number"
                      value={p.marketShare}
                      onChange={(e) => update(p.id, 'marketShare', e.target.value)}
                      placeholder="1.0"
                      className="h-7 text-center text-xs font-mono"
                    />
                  </td>
                  <td className="py-1.5 px-1.5">
                    <Input
                      type="number"
                      value={p.marketGrowth}
                      onChange={(e) => update(p.id, 'marketGrowth', e.target.value)}
                      placeholder="10"
                      className="h-7 text-center text-xs font-mono"
                    />
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {meta ? (
                      <Badge variant="secondary" className={`text-[10px] ${meta.bg} ${meta.text} border ${meta.border}`}>
                        {meta.label}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-1.5 pl-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(p.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={add} disabled={products.length >= 10}>
        <Plus className="h-3 w-3" />
        Add product
      </Button>

      {/* Plot */}
      {parsed.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">BCG Matrix</p>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg rounded-xl border border-border bg-card">
              {/* Quadrant backgrounds */}
              {/* Stars: top-right */}
              <rect x={dividerX} y={PAD} width={W - PAD - dividerX} height={dividerY - PAD} fill="#10b98110" />
              {/* Cash Cows: bottom-right */}
              <rect x={dividerX} y={dividerY} width={W - PAD - dividerX} height={H - PAD - dividerY} fill="#3b82f610" />
              {/* Question Marks: top-left */}
              <rect x={PAD} y={PAD} width={dividerX - PAD} height={dividerY - PAD} fill="#f59e0b10" />
              {/* Dogs: bottom-left */}
              <rect x={PAD} y={dividerY} width={dividerX - PAD} height={H - PAD - dividerY} fill="#6b728010" />

              {/* Divider lines */}
              <line x1={dividerX} y1={PAD} x2={dividerX} y2={H - PAD} stroke="currentColor" strokeWidth="1" strokeDasharray="4,3" className="text-border" />
              <line x1={PAD} y1={dividerY} x2={W - PAD} y2={dividerY} stroke="currentColor" strokeWidth="1" strokeDasharray="4,3" className="text-border" />

              {/* Quadrant labels */}
              <text x={W - PAD - 4} y={PAD + 14} textAnchor="end" fontSize="9" fill="#10b981" fontWeight="600">STAR ★</text>
              <text x={W - PAD - 4} y={H - PAD - 6} textAnchor="end" fontSize="9" fill="#3b82f6" fontWeight="600">CASH COW $</text>
              <text x={PAD + 4} y={PAD + 14} textAnchor="start" fontSize="9" fill="#f59e0b" fontWeight="600">? QUESTION MARK</text>
              <text x={PAD + 4} y={H - PAD - 6} textAnchor="start" fontSize="9" fill="#9ca3af" fontWeight="600">DOG</text>

              {/* Axes labels */}
              <text x={W / 2} y={H - 4} textAnchor="middle" fontSize="9" className="fill-muted-foreground">← Relative Market Share →</text>
              <text x={10} y={H / 2} textAnchor="middle" fontSize="9" transform={`rotate(-90 10 ${H / 2})`} className="fill-muted-foreground">← Market Growth % →</text>

              {/* Axis ticks */}
              {[0.1, 0.25, 1, 4, 10].map((v) => (
                <g key={v}>
                  <line x1={xScale(v)} y1={H - PAD} x2={xScale(v)} y2={H - PAD + 4} stroke="currentColor" strokeWidth="0.5" className="text-border" />
                  <text x={xScale(v)} y={H - PAD + 12} textAnchor="middle" fontSize="7" className="fill-muted-foreground">{v}×</text>
                </g>
              ))}
              {[-5, 0, 10, 20, 30].map((v) => (
                <g key={v}>
                  <line x1={PAD - 4} y1={yScale(v)} x2={PAD} y2={yScale(v)} stroke="currentColor" strokeWidth="0.5" className="text-border" />
                  <text x={PAD - 6} y={yScale(v) + 3} textAnchor="end" fontSize="7" className="fill-muted-foreground">{v}%</text>
                </g>
              ))}

              {/* Data dots */}
              {parsed.map((p) => {
                const cx = xScale(p.share);
                const cy = yScale(p.growth);
                const color = QUADRANT_META[p.quadrant].color;
                return (
                  <g key={p.id}>
                    <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1.5} />
                    <text x={cx} y={cy - 11} textAnchor="middle" fontSize="8" fill={color} fontWeight="600">
                      {p.name.length > 10 ? p.name.slice(0, 9) + '…' : p.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Quadrant summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {(Object.entries(QUADRANT_META) as [QuadrantKey, typeof QUADRANT_META[QuadrantKey]][]).map(([key, meta]) => {
              const items = byQuadrant(key);
              const Icon = meta.icon;
              return (
                <div key={key} className={`rounded-xl border p-3 ${meta.bg} ${meta.border}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={`h-3.5 w-3.5 ${meta.text}`} />
                    <p className={`text-xs font-semibold ${meta.text}`}>{meta.label}</p>
                    {items.length > 0 && <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>}
                  </div>
                  {items.length > 0 ? (
                    <ul className="space-y-0.5 mb-2">
                      {items.map((p) => (
                        <li key={p.id} className="text-xs text-foreground font-medium">{p.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mb-2">None</p>
                  )}
                  <p className="text-[10px] text-muted-foreground leading-snug">{meta.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Relative market share ≥ 1× means you are at least as large as the biggest competitor. Market growth ≥ 10% is the classic BCG threshold for "high growth." Thresholds vary by industry — adjust your interpretation accordingly.
      </p>
    </div>
  );
}
