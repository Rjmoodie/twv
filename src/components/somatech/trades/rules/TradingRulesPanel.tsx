import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/somatech/AuthProvider';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const DEFAULT_RULES = '1. Only trade A+ setups.\n2. Max risk per trade: 1%.\n3. No revenge trading.';

const TradingRulesPanel: React.FC = () => {
  const { user } = useAuth();
  const storageKey = user?.id ? `trading-rules:${user.id}` : null;
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [draft, setDraft] = useState(DEFAULT_RULES);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    const next = saved?.trim() ? saved : DEFAULT_RULES;
    setRules(next);
    setDraft(next);
  }, [storageKey]);

  const save = () => {
    const next = draft.trim() || DEFAULT_RULES;
    setRules(next);
    if (storageKey) localStorage.setItem(storageKey, next);
    setEditing(false);
  };

  return (
    <div className="card p-4">
      <h2 className="text-lg font-bold mb-2">Trading Plan & Rules</h2>
      {editing ? (
        <>
          <Textarea className="mb-2 min-h-32" value={draft} onChange={e => setDraft(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>Save rules</Button>
            <Button size="sm" variant="outline" onClick={() => { setDraft(rules); setEditing(false); }}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <pre className="rounded bg-muted p-3 mb-2 whitespace-pre-wrap text-sm text-foreground">{rules}</pre>
          <Button size="sm" variant="outline" onClick={() => { setDraft(rules); setEditing(true); }}>Edit rules</Button>
        </>
      )}
    </div>
  );
};

export default TradingRulesPanel;
