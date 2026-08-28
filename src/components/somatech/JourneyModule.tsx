import React from 'react';
import JourneyFlow from './journey/JourneyFlow';

interface JourneyModuleProps {
  onNavigate?: (module: string) => void;
  /** Called when Journey is closed — should pop nav history, not push a new entry. */
  onClose?: () => void;
  onRequestAuth?: () => void;
}

export default function JourneyModule({ onNavigate, onClose, onRequestAuth }: JourneyModuleProps) {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      <JourneyFlow
        open={true}
        onClose={onClose ?? (() => onNavigate?.('dashboard'))}
        onRequestAuth={() => onRequestAuth?.()}
        onBrowseCommunity={() => onNavigate?.('community')}
      />
    </div>
  );
}
