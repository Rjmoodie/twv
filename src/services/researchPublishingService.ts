import { supabase } from '@/integrations/supabase/client';
import type { StockData, DCFScenarios, InvestmentThesis } from '@/components/somatech/types';

export interface ResearchDraftInput {
  userId: string;
  stockData: StockData;
  dcfScenarios: DCFScenarios;
  investmentThesis: InvestmentThesis;
  title: string;
  summary: string;
  thesis: string;
  risks: string;
  opportunities?: string;
  disclosure: string;
  authorMode: 'named' | 'anonymous';
}

const slugify = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 96);

export async function publishResearch(input: ResearchDraftInput): Promise<{ id: string; slug: string }> {
  const ticker = input.stockData.symbol.toUpperCase();
  const slug = `${slugify(`${ticker}-${input.title}`)}-${crypto.randomUUID().slice(0, 8)}`;
  const sources = input.stockData.dataSources ? [
    input.stockData.dataSources.fundamentals,
    input.stockData.dataSources.quote,
    input.stockData.dataSources.chart,
  ] : [];
  const snapshot = {
    ticker,
    companyName: input.stockData.name,
    price: input.stockData.price,
    marketCap: input.stockData.marketCap ?? null,
    pe: input.stockData.pe ?? null,
    beta: input.stockData.beta ?? null,
    sector: input.stockData.sector ?? null,
    analyzedAt: input.stockData.lastUpdated,
    dcfScenarios: input.dcfScenarios,
  };

  if (input.authorMode === 'named') {
    const { data: profile, error: profileError } = await supabase.from('public_profiles').select('user_id').eq('user_id', input.userId).eq('is_public', true).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error('Create and enable a public research profile in Account settings, or publish anonymously.');
  }

  const { data, error } = await supabase.from('research_posts').insert({
    author_id: input.userId,
    slug,
    ticker,
    company_name: input.stockData.name || ticker,
    title: input.title.trim(),
    summary: input.summary.trim(),
    thesis: input.thesis.trim(),
    risks: input.risks.trim(),
    opportunities: input.opportunities?.trim() || null,
    disclosure: input.disclosure.trim(),
    snapshot: snapshot as never,
    sources: sources as never,
    status: 'published',
    author_mode: input.authorMode,
    published_at: new Date().toISOString(),
  }).select('id, slug').single();
  if (error) throw error;
  return data as { id: string; slug: string };
}
