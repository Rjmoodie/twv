import React from 'react';
import { useTrades } from '../context/TradesProvider';
import { X } from 'lucide-react';

interface TradeDetailModalProps {
  tradeId: string;
  onClose: () => void;
}

const TradeDetailModal: React.FC<TradeDetailModalProps> = ({ tradeId, onClose }) => {
  const { trades } = useTrades();
  const trade = trades.find(t => t.id === tradeId);
  if (!trade) return null;

  return (
    <div className="modal">
      <button
        type="button"
        aria-label="Close trade details"
        className="absolute right-2 top-2 z-10 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={onClose}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      <h2 className="text-xl font-bold mb-2">Trade Detail: {trade.ticker}</h2>
      <div>Provider: {trade.provider}</div>
      <div>Side: {trade.side.toUpperCase()}</div>
      <div>Filled: {trade.filled_at ?? 'N/A'}</div>
      <div>Quantity: {trade.qty}</div>
      <div>Average fill: {trade.filled_avg_price == null ? 'N/A' : `$${trade.filled_avg_price.toFixed(2)}`}</div>
      <div>Strategy: {trade.strategy ?? 'Not journaled'}</div>
    </div>
  );
};

export default TradeDetailModal; 
