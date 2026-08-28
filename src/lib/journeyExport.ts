import type { JourneyDef } from '@/components/somatech/journey/journeyConfig';
import type { JourneyAnalysis } from './journeyMetrics';
import { describeMetricDelta } from './journeyMetrics';
import { formatMoney } from './journeyMoney';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function inputValue(type: string, value: string | number | undefined, prefix?: string, suffix?: string): string {
  if (value === undefined || value === '') return 'Not entered';
  if (type === 'currency' || type === 'itemized') return formatMoney(Number(value));
  return `${prefix ?? ''}${String(value)}${suffix ? ` ${suffix}` : ''}`;
}

export function buildJourneyExportHtml(params: {
  journey: JourneyDef;
  planName: string;
  answers: Record<string, string | number>;
  analysis: JourneyAnalysis;
  baselineName?: string;
  baselineAnalysis?: JourneyAnalysis | null;
}): string {
  const { journey, answers, analysis, baselineAnalysis } = params;
  const inputRows = journey.questions.map(question => `
    <tr><th>${escapeHtml(question.label)}</th><td>${escapeHtml(inputValue(question.type, answers[question.id], question.prefix, question.suffix))}</td></tr>`).join('');
  const metricRows = analysis.metrics.map(metric => {
    const baselineMetric = baselineAnalysis?.metrics.find(item => item.id === metric.id);
    const delta = baselineMetric ? describeMetricDelta(baselineMetric, metric) : null;
    return `<tr><th>${escapeHtml(metric.label)}</th>${baselineMetric ? `<td>${escapeHtml(baselineMetric.value)}</td>` : ''}<td>${escapeHtml(metric.value)}</td>${baselineMetric ? `<td>${escapeHtml(delta?.label ?? 'Not comparable')}</td>` : ''}</tr>`;
  }).join('');
  const assumptions = analysis.assumptions.length
    ? `<h2>Model assumptions</h2><ul>${analysis.assumptions.map(item => `<li>${escapeHtml(item.label)}: ${escapeHtml(item.value)} <small>(${escapeHtml(item.version)})</small></li>`).join('')}</ul>`
    : '';
  const comparison = Boolean(baselineAnalysis);

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(journey.title)} — ${escapeHtml(params.planName)}</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;color:#172033}body{max-width:920px;margin:40px auto;padding:0 28px}h1{margin:0;font-size:28px}h2{margin:30px 0 10px;font-size:16px}p,li{font-size:12px;line-height:1.6;color:#556070}.eyebrow{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#65718a;margin-bottom:5px}.meta{margin:8px 0 26px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:10px 12px;border:1px solid #dbe1ea;text-align:left;vertical-align:top}th{background:#f5f7fa;font-weight:600}.note{margin-top:28px;padding:12px;border:1px solid #dbe1ea;border-radius:8px}small{color:#7a8497}@media print{body{margin:0;max-width:none}.no-print{display:none}h2{break-after:avoid}tr{break-inside:avoid}}
  </style></head><body>
    <div class="eyebrow">SomaTech Journey operating plan</div><h1>${escapeHtml(journey.title)} — ${escapeHtml(params.planName)}</h1>
    <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())}. Values are planning inputs and modeled outputs, not verified account balances or guarantees.</p>
    <h2>Your inputs</h2><table><tbody>${inputRows}</tbody></table>
    <h2>${comparison ? 'Scenario comparison' : 'Plan results'}</h2>
    <table><thead><tr><th>Metric</th>${comparison ? `<th>${escapeHtml(params.baselineName ?? 'Baseline')}</th>` : ''}<th>${escapeHtml(params.planName)}</th>${comparison ? '<th>Difference</th>' : ''}</tr></thead><tbody>${metricRows}</tbody></table>
    ${assumptions}
    <p class="note">This plan supports financial understanding and decision-making. Projections depend on the inputs and assumptions shown and may differ from actual outcomes.</p>
  </body></html>`;
}

export function printJourneyPlan(params: Parameters<typeof buildJourneyExportHtml>[0]): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Allow pop-ups to export this plan.');
  printWindow.opener = null;
  printWindow.document.open();
  printWindow.document.write(buildJourneyExportHtml(params));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 200);
}
