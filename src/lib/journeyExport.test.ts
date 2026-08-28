import { describe, expect, it } from 'vitest';
import { getJourney } from '@/components/somatech/journey/journeyConfig';
import { analyzeJourney } from './journeyMetrics';
import { buildJourneyExportHtml } from './journeyExport';

describe('journey export', () => {
  it('exports typed scenario deltas and escapes plan names', () => {
    const journey = getJourney('debt-freedom')!;
    const baselineAnswers = { totalDebt: 10_000, currentMinimumPayment: 250, monthlyPayment: 500, interestRate: 0, monthlyIncome: 4_000 };
    const scenarioAnswers = { ...baselineAnswers, monthlyPayment: 1_000 };
    const html = buildJourneyExportHtml({
      journey,
      planName: '<Aggressive & safe>',
      answers: scenarioAnswers,
      analysis: analyzeJourney(journey, scenarioAnswers),
      baselineName: 'Baseline',
      baselineAnalysis: analyzeJourney(journey, baselineAnswers),
    });

    expect(html).toContain('&lt;Aggressive &amp; safe&gt;');
    expect(html).toContain('10 months sooner');
    expect(html).not.toContain('<Aggressive & safe>');
  });
});
