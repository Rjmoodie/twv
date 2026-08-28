import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/components/somatech/AuthProvider';
import { useStockData } from './StockDataProvider';
import { publishResearch } from '@/services/researchPublishingService';
import { toast } from '@/hooks/use-toast';

export default function PublishResearchDialog({ onRequestAuth }: { onRequestAuth?: () => void }) {
  const { user } = useAuth();
  const { stockData, dcfScenarios, investmentThesis } = useStockData();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState(() => stockData ? `${stockData.name || stockData.symbol}: investment analysis` : '');
  const [summary, setSummary] = useState('');
  const [thesis, setThesis] = useState(investmentThesis.moat || '');
  const [risks, setRisks] = useState(investmentThesis.risks || '');
  const [opportunities, setOpportunities] = useState(investmentThesis.opportunities || '');
  const [disclosure, setDisclosure] = useState('');
  const [authorMode, setAuthorMode] = useState<'named' | 'anonymous'>('named');
  const stockSymbol = stockData?.symbol;
  const stockName = stockData?.name;

  useEffect(() => {
    if (!open || !stockSymbol) return;
    setPublishedUrl(null);
    setError('');
    setTitle(`${stockName || stockSymbol}: investment analysis`);
    setSummary('');
    setThesis(investmentThesis.moat || '');
    setRisks(investmentThesis.risks || '');
    setOpportunities(investmentThesis.opportunities || '');
  }, [open, stockSymbol, stockName, investmentThesis.moat, investmentThesis.risks, investmentThesis.opportunities]);

  const validation = useMemo(() => {
    if (title.trim().length < 10) return 'Use a descriptive title of at least 10 characters.';
    if (summary.trim().length < 40) return 'Add a summary of at least 40 characters.';
    if (thesis.trim().length < 80) return 'Explain the investment thesis in at least 80 characters.';
    if (risks.trim().length < 40) return 'Describe material risks in at least 40 characters.';
    if (disclosure.trim().length < 20 || !/(hold|position|conflict|none|no\s+(?:financial\s+)?interest)/i.test(disclosure)) {
      return 'State whether you hold the security and identify any conflicts, including when there are none.';
    }
    return null;
  }, [title, summary, thesis, risks, disclosure]);

  if (!stockData) return null;

  const submit = async () => {
    if (!user) { setOpen(false); onRequestAuth?.(); return; }
    if (validation) { setError(validation); return; }
    setLoading(true); setError('');
    try {
      const post = await publishResearch({
        userId: user.id, stockData, dcfScenarios, investmentThesis,
        title, summary, thesis, risks, opportunities, disclosure, authorMode,
      });
      const url = `${window.location.origin}/research/${post.slug}`;
      setPublishedUrl(url);
      toast({ title: 'Analysis published', description: 'Your permanent public research page is live.' });
    } catch (cause) {
      console.error('Research publishing failed:', cause);
      setError(cause instanceof Error ? cause.message : 'The analysis could not be published.');
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Send className="h-4 w-4" />Publish analysis</Button></DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Publish {stockData.symbol} research</DialogTitle>
          <DialogDescription>Create a permanent, searchable article. Market data is frozen at its displayed timestamp; readers will see your assumptions and disclosure.</DialogDescription>
        </DialogHeader>
        {publishedUrl ? (
          <div className="space-y-4 py-4">
            <Alert><AlertDescription>Your analysis is public. Changes should be made as revisions so readers retain context.</AlertDescription></Alert>
            <Button asChild className="w-full gap-2"><a href={publishedUrl}><ExternalLink className="h-4 w-4" />View published analysis</a></Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="research-title">Title</Label><Input id="research-title" value={title} maxLength={180} onChange={e => { setTitle(e.target.value); setError(''); }} /></div>
            <div className="space-y-1.5"><Label htmlFor="research-summary">Executive summary</Label><Textarea id="research-summary" value={summary} maxLength={600} rows={3} onChange={e => { setSummary(e.target.value); setError(''); }} placeholder="What is the conclusion, time horizon, and central evidence?" /></div>
            <div className="space-y-1.5"><Label htmlFor="research-thesis">Thesis</Label><Textarea id="research-thesis" value={thesis} maxLength={12000} rows={6} onChange={e => { setThesis(e.target.value); setError(''); }} placeholder="Explain the business quality, valuation, catalysts, and evidence." /></div>
            <div className="space-y-1.5"><Label htmlFor="research-risks">Material risks</Label><Textarea id="research-risks" value={risks} maxLength={8000} rows={4} onChange={e => { setRisks(e.target.value); setError(''); }} placeholder="What could invalidate the thesis or permanently impair capital?" /></div>
            <div className="space-y-1.5"><Label htmlFor="research-opportunities">Catalysts and opportunities</Label><Textarea id="research-opportunities" value={opportunities} maxLength={8000} rows={3} onChange={e => setOpportunities(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="research-disclosure">Disclosure</Label><Textarea id="research-disclosure" value={disclosure} maxLength={1000} rows={2} onChange={e => { setDisclosure(e.target.value); setError(''); }} placeholder="State whether you hold the security and identify conflicts." /></div>
            <div className="space-y-1.5"><Label>Attribution</Label><Select value={authorMode} onValueChange={v => setAuthorMode(v as 'named' | 'anonymous')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="named">Public profile</SelectItem><SelectItem value="anonymous">Anonymous analyst</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Named publishing requires a public profile; otherwise the article displays “SomaTech member.”</p></div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>
        )}
        {!publishedUrl && <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={loading || Boolean(validation)}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish responsibly</Button></DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
