import React from 'react';
import { TradesProvider, useTrades } from './trades/context/TradesProvider';
import ConnectBrokerDialog from './trades/ConnectBrokerDialog';
import TradesDashboard from './trades/dashboard/TradesDashboard';
import TradeLogTable from './trades/TradeLogTable';
import TradingRulesPanel from './trades/rules/TradingRulesPanel';
import { Loader2 } from 'lucide-react';

function TradesContent() {
  const { connection, trades, isLoading } = useTrades();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <ConnectBrokerDialog />

      {connection && trades.length > 0 && (
        <>
          <TradesDashboard />
          <div className="card p-4">
            <h2 className="text-xl font-bold mb-4">Trade Log</h2>
            <TradeLogTable />
          </div>
          <TradingRulesPanel />
        </>
      )}

      {connection && trades.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">No filled orders found</p>
          <p className="text-sm mt-1">Your supported fill history appears after Schwab completes its first read-only sync.</p>
        </div>
      )}

    </div>
  );
}

const Trades: React.FC = () => (
  <TradesProvider>
    <TradesContent />
  </TradesProvider>
);

export default Trades;
