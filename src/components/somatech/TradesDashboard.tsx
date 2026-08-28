import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign, 
  Calendar,
  Activity,
  Target,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Trade {
  id: number;
  ticker: string;
  strike: number;
  option_type: 'C' | 'P';
  expiry: string;
  status: 'OPEN' | 'ADDED' | 'CLOSED';
  thread_id?: number;
  main_msg_id?: number;
  opened_at: string;
  closed_at?: string;
  entries: string;
  pnl: string;
  created_at: string;
  updated_at: string;
}

interface TradeAnalysis {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalPnL: number;
  winRate: number;
  avgHoldingTime: number;
}

const TradesDashboard: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showClosedTrades, setShowClosedTrades] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'all' | 'today' | 'week' | 'month'>('all');

  useEffect(() => {
    fetchTrades();
  }, [showClosedTrades, selectedTimeframe]);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('plays')
        .select('*')
        .order('opened_at', { ascending: false });

      // Filter by status
      if (!showClosedTrades) {
        query = query.in('status', ['OPEN', 'ADDED']);
      }

      // Filter by timeframe
      if (selectedTimeframe !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (selectedTimeframe) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'month':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(0);
        }
        
        query = query.gte('opened_at', startDate.toISOString());
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setTrades(data || []);
      calculateAnalysis(data || []);
    } catch (err) {
      console.error('Error fetching trades:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch trades');
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalysis = (tradesData: Trade[]) => {
    const closedTrades = tradesData.filter(trade => trade.status === 'CLOSED');
    const totalPnL = closedTrades.reduce((sum, trade) => {
      const pnlValue = parseFloat(trade.pnl || '0');
      return sum + (isNaN(pnlValue) ? 0 : pnlValue);
    }, 0);

    const winningTrades = closedTrades.filter(trade => {
      const pnlValue = parseFloat(trade.pnl || '0');
      return pnlValue > 0;
    });

    const avgHoldingTime = closedTrades.length > 0 
      ? closedTrades.reduce((sum, trade) => {
          const opened = new Date(trade.opened_at);
          const closed = new Date(trade.closed_at || trade.updated_at);
          return sum + (closed.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / closedTrades.length
      : 0;

    setAnalysis({
      totalTrades: tradesData.length,
      openTrades: tradesData.filter(t => t.status === 'OPEN' || t.status === 'ADDED').length,
      closedTrades: closedTrades.length,
      totalPnL,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      avgHoldingTime
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (days: number) => {
    if (days < 1) return '< 1 day';
    if (days < 7) return `${Math.round(days)} days`;
    if (days < 30) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-accent/10 text-accent border-accent/20';
      case 'ADDED': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'CLOSED': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPnLColor = (pnl: string) => {
    const value = parseFloat(pnl || '0');
    if (value > 0) return 'text-accent';
    if (value < 0) return 'text-destructive';
    return 'text-gray-600';
  };

  const getOptionTypeColor = (type: 'C' | 'P') => {
    return type === 'C' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading trades...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-destructive text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>Error loading trades: {error}</p>
          <Button onClick={fetchTrades} className="mt-4" variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor your options trades with real-time analysis and performance metrics
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg p-1">
            {(['all', 'today', 'week', 'month'] as const).map((timeframe) => (
              <Button
                key={timeframe}
                variant={selectedTimeframe === timeframe ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setSelectedTimeframe(timeframe)}
                className="h-8 px-3 capitalize"
              >
                {timeframe}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClosedTrades(!showClosedTrades)}
            className="flex items-center gap-2"
          >
            {showClosedTrades ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showClosedTrades ? 'Hide Closed' : 'Show Closed'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTrades}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Analysis Cards */}
      {analysis && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trades</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.totalTrades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{analysis.openTrades}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analysis.totalPnL >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {formatCurrency(analysis.totalPnL)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analysis.winRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Hold Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(analysis.avgHoldingTime)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Positions</CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No trades found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-semibold">{trade.ticker}</h3>
                          <Badge className={getOptionTypeColor(trade.option_type)}>
                            {trade.option_type === 'C' ? 'Call' : 'Put'}
                          </Badge>
                          <Badge className={getStatusColor(trade.status)}>
                            {trade.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Strike: ${trade.strike}</span>
                          <span>Expiry: {formatDate(trade.expiry)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="text-sm">
                        <p className="text-muted-foreground">Entry Time</p>
                        <p className="font-medium">{formatDate(trade.opened_at)}</p>
                      </div>
                      
                      {trade.closed_at && (
                        <div className="text-sm">
                          <p className="text-muted-foreground">Exit Time</p>
                          <p className="font-medium">{formatDate(trade.closed_at)}</p>
                        </div>
                      )}

                      <div className="text-sm">
                        <p className="text-muted-foreground">P&L</p>
                        <p className={`font-semibold ${getPnLColor(trade.pnl)}`}>
                          {trade.pnl ? formatCurrency(parseFloat(trade.pnl)) : 'N/A'}
                        </p>
                      </div>

                      {trade.entries && (
                        <div className="text-sm">
                          <p className="text-muted-foreground">Entries</p>
                          <p className="font-medium">{trade.entries}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Thread ID for Discord integration */}
                  {trade.thread_id && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Discord Thread: {trade.thread_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TradesDashboard;
