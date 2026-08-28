import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, ShieldAlert, Search, Sparkles, Copy } from 'lucide-react';

function MarkdownOutput({ content }: { content: string }) {
  const { toast } = useToast();

  const copy = () => {
    navigator.clipboard.writeText(content);
    toast({ title: 'Copied to clipboard' });
  };

  return (
    <div className="relative group">
      <Button
        size="icon"
        variant="ghost"
        onClick={copy}
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm whitespace-pre-wrap leading-relaxed font-mono">
        {content}
      </div>
    </div>
  );
}

async function callAIAnalysis(tool: string, payload: Record<string, unknown>): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('ai-analysis', {
    body: { tool, payload },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: string; message?: string } | null;
      throw new Error(payload?.error || payload?.message || error.message);
    }
    throw new Error(error.message);
  }
  if (!data?.content) throw new Error('The AI service returned an empty response. Please try again.');
  return data.content as string;
}

// ── Thesis Builder ─────────────────────────────────────────────────────────────
function ThesisTool() {
  const { toast } = useToast();
  const [ticker, setTicker] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const content = await callAIAnalysis('thesis', { ticker: ticker.toUpperCase(), companyName });
      setResult(content);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Ticker</Label>
          <Input
            placeholder="AAPL"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="font-mono uppercase"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Company name (optional)</Label>
          <Input
            placeholder="Apple Inc."
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </div>
      </div>
      <Button onClick={run} disabled={loading || !ticker.trim()} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? 'Generating thesis…' : 'Generate investment thesis'}
      </Button>
      {result && <MarkdownOutput content={result} />}
    </div>
  );
}

// ── Portfolio Risk Scan ────────────────────────────────────────────────────────
function RiskTool() {
  const { toast } = useToast();
  const [tickerInput, setTickerInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async () => {
    const tickers = tickerInput.split(/[\s,]+/).map((t) => t.trim().toUpperCase()).filter(Boolean);
    if (tickers.length < 2) {
      toast({ title: 'Enter at least 2 tickers', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult('');
    try {
      const content = await callAIAnalysis('risk', { tickers });
      setResult(content);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Portfolio tickers (comma or space separated)</Label>
        <Input
          placeholder="AAPL, MSFT, NVDA, JPM, BRK.B"
          value={tickerInput}
          onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
          className="font-mono"
        />
        <p className="text-[10px] text-muted-foreground">Enter 2–20 holdings. Order doesn't matter.</p>
      </div>
      <Button onClick={run} disabled={loading || !tickerInput.trim()} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
        {loading ? 'Scanning portfolio…' : 'Run risk analysis'}
      </Button>
      {result && <MarkdownOutput content={result} />}
    </div>
  );
}

// ── AI Stock Screener ──────────────────────────────────────────────────────────
function ScreenerTool() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const examples = [
    'Profitable small-cap tech companies with low debt and high insider ownership',
    'Dividend aristocrats yielding over 3% in defensive sectors',
    'Companies benefiting from AI infrastructure spending with strong free cash flow',
  ];

  const run = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const content = await callAIAnalysis('screener', { query: q });
      setResult(content);
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs">Describe the stocks you're looking for</Label>
        <Textarea
          placeholder="e.g. Profitable small-cap biotech companies with cash runway over 24 months and no debt…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          className="resize-none text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] text-muted-foreground">Examples:</p>
        <div className="flex flex-col gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => { setQuery(ex); run(ex); }}
              className="text-left text-xs px-3 py-2 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={() => run()} disabled={loading || !query.trim()} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        {loading ? 'Screening market…' : 'Find matching stocks'}
      </Button>
      {result && <MarkdownOutput content={result} />}
    </div>
  );
}

// ── Main Module ────────────────────────────────────────────────────────────────
export default function AIToolsModule() {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">AI Tools</h1>
          <p className="text-sm text-muted-foreground">Claude analysis grounded in Somatech SEC and quote data — Tier 3</p>
        </div>
        <div className="ml-auto flex items-center gap-2"><Badge variant="secondary">SEC + Alpha Vantage</Badge><Badge>Tier 3</Badge></div>
      </div>

      <Tabs defaultValue="thesis">
        <TabsList className="w-full grid grid-cols-3 rounded-2xl">
          <TabsTrigger value="thesis" className="gap-1.5 rounded-xl">
            <FileText className="h-3.5 w-3.5" /> Thesis
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1.5 rounded-xl">
            <ShieldAlert className="h-3.5 w-3.5" /> Risk Scan
          </TabsTrigger>
          <TabsTrigger value="screener" className="gap-1.5 rounded-xl">
            <Search className="h-3.5 w-3.5" /> Screener
          </TabsTrigger>
        </TabsList>

        <TabsContent value="thesis" className="mt-4">
          <Card className="app-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Investment Thesis Builder
              </CardTitle>
              <CardDescription>
                Enter a ticker and get an AI-generated investment thesis covering moat, growth drivers, risks, and verdict.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThesisTool />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <Card className="app-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" /> Portfolio Risk Scan
              </CardTitle>
              <CardDescription>
                Paste your portfolio tickers and get a concentration, sector, and macro risk assessment with specific recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RiskTool />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="screener" className="mt-4">
          <Card className="app-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" /> Natural Language Screener
              </CardTitle>
              <CardDescription>
                Describe the kind of stocks you're looking for in plain English and get a curated list of matching tickers with rationale.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScreenerTool />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center">
        AI analysis is for educational purposes only and does not constitute financial advice. Always do your own due diligence.
      </p>
    </div>
  );
}
