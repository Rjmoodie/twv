import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const PILLARS = [
  { id: 'P', label: 'Positive Emotion', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', description: 'Joy, pleasure, enjoyment from this' },
  { id: 'E', label: 'Engagement', color: 'bg-blue-100 text-blue-800 border-blue-200', description: 'Flow, skill use, deep involvement' },
  { id: 'R', label: 'Relationships', color: 'bg-pink-100 text-pink-800 border-pink-200', description: 'Shared with or for people you care about' },
  { id: 'M', label: 'Meaning', color: 'bg-purple-100 text-purple-800 border-purple-200', description: 'Part of something bigger than yourself' },
  { id: 'A', label: 'Accomplishment', color: 'bg-accent/10 text-accent border-accent/20', description: 'Achieving a meaningful goal' },
];

interface Goal {
  id: string;
  text: string;
  pillars: string[];
  monthlyCost?: number;
}

export default function PermaGoalsTool() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoal, setNewGoal] = useState('');
  const [newCost, setNewCost] = useState('');

  const addGoal = () => {
    if (!newGoal.trim()) return;
    setGoals((prev) => [
      ...prev,
      { id: crypto.randomUUID(), text: newGoal.trim(), pillars: [], monthlyCost: newCost ? Number(newCost) : undefined },
    ]);
    setNewGoal('');
    setNewCost('');
  };

  const togglePillar = (goalId: string, pillarId: string) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, pillars: g.pillars.includes(pillarId) ? g.pillars.filter((p) => p !== pillarId) : [...g.pillars, pillarId] }
          : g
      )
    );
  };

  const removeGoal = (id: string) => setGoals((prev) => prev.filter((g) => g.id !== id));

  const coveredPillars = new Set(goals.flatMap((g) => g.pillars));
  const missingPillars = PILLARS.filter((p) => !coveredPillars.has(p.id));
  const noMappingGoals = goals.filter((g) => g.pillars.length === 0);
  const totalMonthly = goals.reduce((sum, g) => sum + (g.monthlyCost ?? 0), 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Map your financial goals to the PERMA model. Goals with no pillar mapping are candidates for cuts. Pillars with no spending are underinvestments in wellbeing.
      </p>

      {/* Pillar legend */}
      <div className="flex flex-wrap gap-1.5">
        {PILLARS.map((p) => (
          <span key={p.id} className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', p.color)}>
            {p.id} — {p.label}
          </span>
        ))}
      </div>

      {/* Add goal */}
      <div className="flex gap-2">
        <Input
          placeholder="Add a financial goal or spending item…"
          value={newGoal}
          onChange={(e) => setNewGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addGoal()}
          className="flex-1"
        />
        <Input
          placeholder="$/mo"
          type="number"
          value={newCost}
          onChange={(e) => setNewCost(e.target.value)}
          className="w-20 font-mono"
        />
        <Button size="icon" onClick={addGoal} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div key={goal.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{goal.text}</p>
                  {goal.monthlyCost !== undefined && (
                    <p className="text-xs text-muted-foreground">${goal.monthlyCost}/mo</p>
                  )}
                </div>
                <button onClick={() => removeGoal(goal.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PILLARS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => togglePillar(goal.id, p.id)}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full border transition-all',
                      goal.pillars.includes(p.id) ? p.color : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    {p.id}
                  </button>
                ))}
                {goal.pillars.length === 0 && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> No pillar — candidate for cut
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analysis */}
      {goals.length > 0 && (
        <div className="space-y-2">
          {missingPillars.length > 0 && (
            <div className="rounded-xl bg-warning/10 border border-warning/20 p-3 text-sm">
              <p className="font-semibold text-warning mb-1">Underinvested pillars</p>
              <p className="text-warning text-xs">
                None of your goals map to: {missingPillars.map((p) => p.label).join(', ')}. Consider if you're neglecting these areas.
              </p>
            </div>
          )}
          {noMappingGoals.length > 0 && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-sm">
              <p className="font-semibold text-destructive mb-1">Goals without a why</p>
              <p className="text-destructive text-xs">
                {noMappingGoals.map((g) => g.text).join(', ')} — these don't map to any PERMA pillar. Strong candidates to reconsider.
              </p>
            </div>
          )}
          {totalMonthly > 0 && (
            <div className="rounded-xl bg-muted/50 p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Total monthly tracked</span>
              <span className="font-mono font-semibold">${totalMonthly.toLocaleString()}/mo</span>
            </div>
          )}
        </div>
      )}

      {goals.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          Add your financial goals or spending items above to get started.
        </p>
      )}
    </div>
  );
}
