import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Tier = 1 | 2;

interface SourceCoverage {
  source:        string;
  city:          string;
  state:         string;
  violations:    boolean;
  latLng:        boolean;
  ownerName:     boolean;
  ownerAtFetch:  boolean; // owner available without enrichment pass
  propValue:     boolean;
  severity:      boolean;
  assessor:      string | null;
  leadType:      string;
  tier:          Tier;
}

const COVERAGE: SourceCoverage[] = [
  {
    source:       'nyc_hpd',
    city:         'New York',
    state:        'NY',
    violations:   true,
    latLng:       true,
    ownerName:    true,
    ownerAtFetch: false,
    propValue:    true,
    severity:     true,
    assessor:     'NYC PLUTO (DCP)',
    leadType:     'Code Violation',
    tier:         1,
  },
  {
    source:       'philly_violations',
    city:         'Philadelphia',
    state:        'PA',
    violations:   true,
    latLng:       true,
    ownerName:    true,
    ownerAtFetch: true,
    propValue:    true,
    severity:     false,
    assessor:     'OPA (market value)',
    leadType:     'Code Violation',
    tier:         1,
  },
  {
    source:       'chicago_violations',
    city:         'Chicago',
    state:        'IL',
    violations:   true,
    latLng:       true,
    ownerName:    true,
    ownerAtFetch: false,
    propValue:    true,
    severity:     false,
    assessor:     'Cook County (Socrata)',
    leadType:     'Code Violation',
    tier:         1,
  },
  {
    source:       'sf_violations',
    city:         'San Francisco',
    state:        'CA',
    violations:   true,
    latLng:       true,
    ownerName:    true,
    ownerAtFetch: false,
    propValue:    true,
    severity:     false,
    assessor:     'SF Assessor-Recorder',
    leadType:     'Code Violation',
    tier:         1,
  },
  {
    source:       'boston_violations',
    city:         'Boston',
    state:        'MA',
    violations:   true,
    latLng:       true,
    ownerName:    true,
    ownerAtFetch: false,
    propValue:    true,
    severity:     false,
    assessor:     'Boston Assessing Dept',
    leadType:     'Code Violation',
    tier:         1,
  },
  {
    source:       'la_violations',
    city:         'Los Angeles',
    state:        'CA',
    violations:   true,
    latLng:       false,
    ownerName:    false,
    ownerAtFetch: false,
    propValue:    false,
    severity:     false,
    assessor:     null,
    leadType:     'Code Violation',
    tier:         2,
  },
  {
    source:       'austin_violations',
    city:         'Austin',
    state:        'TX',
    violations:   true,
    latLng:       true,
    ownerName:    false,
    ownerAtFetch: false,
    propValue:    false,
    severity:     false,
    assessor:     null,
    leadType:     'Code Violation',
    tier:         2,
  },
  {
    source:       'seattle_violations',
    city:         'Seattle',
    state:        'WA',
    violations:   true,
    latLng:       true,
    ownerName:    false,
    ownerAtFetch: false,
    propValue:    false,
    severity:     false,
    assessor:     null,
    leadType:     'Code Violation',
    tier:         2,
  },
  {
    source:       'hud_reo',
    city:         'National',
    state:        'All',
    violations:   false,
    latLng:       false,
    ownerName:    true,
    ownerAtFetch: true,
    propValue:    true,
    severity:     true,
    assessor:     'HUD Home Store API',
    leadType:     'REO / Bank-Owned',
    tier:         1,
  },
];

const Yes = () => (
  <span className="flex justify-center">
    <Check className="h-4 w-4 text-emerald-500" />
  </span>
);

const No = () => (
  <span className="flex justify-center">
    <X className="h-4 w-4 text-muted-foreground/40" />
  </span>
);

const YesNote = ({ note }: { note: string }) => (
  <span className="flex justify-center items-center gap-1 group relative">
    <Check className="h-4 w-4 text-emerald-500" />
    <span className="text-[10px] text-muted-foreground leading-none">{note}</span>
  </span>
);

export const DataCoverageTable: React.FC = () => {
  const [open, setOpen] = useState(false);

  const tier1 = COVERAGE.filter(r => r.tier === 1);
  const tier2 = COVERAGE.filter(r => r.tier === 2);

  const renderRow = (row: SourceCoverage) => (
    <tr key={row.source} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 px-3 text-sm font-medium whitespace-nowrap">
        {row.city}
      </td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground">{row.state}</td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground">{row.leadType}</td>
      <td className="py-2.5 px-3"><Yes /></td>
      <td className="py-2.5 px-3">{row.latLng ? <Yes /> : <No />}</td>
      <td className="py-2.5 px-3">
        {row.ownerName
          ? row.ownerAtFetch
            ? <YesNote note="direct" />
            : <YesNote note="enriched" />
          : <No />}
      </td>
      <td className="py-2.5 px-3">{row.propValue ? <Yes /> : <No />}</td>
      <td className="py-2.5 px-3">{row.severity ? <Yes /> : <No />}</td>
      <td className="py-2.5 px-3 text-xs text-muted-foreground">
        {row.assessor ?? '—'}
      </td>
    </tr>
  );

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          Data coverage by city
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {COVERAGE.length} sources
          </Badge>
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="overflow-x-auto border-t border-border/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">City</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">State</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Lead Type</th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Violations</th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Lat/Lng</th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Owner</th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Prop Value</th>
                <th className="py-2 px-3 text-center text-xs font-medium text-muted-foreground">Severity</th>
                <th className="py-2 px-3 text-left text-xs font-medium text-muted-foreground">Assessor Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9} className="px-3 pt-3 pb-1">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wide">
                    Tier 1 — Violations + Owner + Value
                  </span>
                </td>
              </tr>
              {tier1.map(renderRow)}
              <tr>
                <td colSpan={9} className="px-3 pt-4 pb-1">
                  <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wide">
                    Tier 2 — Violations only
                  </span>
                </td>
              </tr>
              {tier2.map(renderRow)}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-border/40 flex gap-4 text-[11px] text-muted-foreground">
            <span><span className="font-medium text-foreground">direct</span> = available at fetch time</span>
            <span><span className="font-medium text-foreground">enriched</span> = populated on enrichment pass via county assessor</span>
          </div>
        </div>
      )}
    </div>
  );
};
