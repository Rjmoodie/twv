import { useCallback, useEffect, useState } from 'react';
import type { JourneyDraft } from '@/hooks/useJourney';
import type { JourneyAnalysis } from '@/lib/journeyMetrics';
import {
  journeyPlanService,
  type JourneyInputMetadata,
  type JourneyPlanRecord,
} from '@/services/journeyPlanService';
import { loadAllCompletedJourneys } from '@/hooks/useJourney';

const journeyIds = ['debt-freedom', 'budget-clarity', 'investor-starter', 'home-buying', 'business-owner'] as const;

function metadataForDraft(draft: JourneyDraft, source: JourneyInputMetadata['source']): Record<string, JourneyInputMetadata> {
  const asOf = new Date().toISOString();
  return Object.fromEntries(Object.keys(draft.answers).map(key => [key, {
    source: draft.prefilledIds?.includes(key) ? (draft.prefillSource ?? 'profile') : source,
    asOf,
    linked: draft.prefilledIds?.includes(key) ?? false,
  }]));
}

export function useJourneyPlans(userId: string | undefined) {
  const [plans, setPlans] = useState<JourneyPlanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) { setPlans([]); return []; }
    setLoading(true);
    setError(null);
    try {
      let loaded = await journeyPlanService.list(userId);

      // One-release, idempotent migration from completed local plans. The local
      // records remain as a recovery copy until the next product migration.
      const local = loadAllCompletedJourneys();
      for (const journeyId of journeyIds) {
        const completed = local[journeyId];
        if (!completed || loaded.some(plan => plan.journey_id === journeyId && plan.parent_plan_id === null)) continue;
        const draft: JourneyDraft = {
          journeyId,
          answers: completed.answers,
          startedAt: completed.completedAt,
        };
        const migrated = await journeyPlanService.create({
          userId,
          journeyId,
          answers: completed.answers,
          inputMetadata: metadataForDraft(draft, 'migration'),
          isBaseline: true,
        });
        loaded = [migrated, ...loaded];
      }
      setPlans(loaded);
      return loaded;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load Journey plans.';
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void reload(); }, [reload]);

  const createFromDraft = useCallback(async (draft: JourneyDraft): Promise<JourneyPlanRecord | null> => {
    if (!userId) return null;
    const existing = plans.find(plan => plan.journey_id === draft.journeyId && plan.is_baseline);
    if (existing) {
      const updated = await journeyPlanService.update(existing, {
        answers: draft.answers,
        inputMetadata: { ...existing.input_metadata, ...metadataForDraft(draft, 'manual') },
      });
      setPlans(current => current.map(plan => plan.id === updated.id ? updated : plan));
      return updated;
    }
    const created = await journeyPlanService.create({
      userId,
      journeyId: draft.journeyId,
      answers: draft.answers,
      inputMetadata: metadataForDraft(draft, 'manual'),
      isBaseline: true,
    });
    setPlans(current => [created, ...current]);
    return created;
  }, [plans, userId]);

  const update = useCallback(async (
    plan: JourneyPlanRecord,
    answers: Record<string, string | number>,
    analysis: JourneyAnalysis,
  ) => {
    const now = new Date().toISOString();
    const metadata = { ...plan.input_metadata };
    for (const key of Object.keys(answers)) {
      if (plan.answers[key] === answers[key]) continue;
      const previous = metadata[key];
      metadata[key] = {
        source: 'manual',
        asOf: now,
        linked: false,
        overriddenAt: previous?.linked ? now : previous?.overriddenAt ?? now,
      };
    }
    const updated = await journeyPlanService.update(plan, {
      answers,
      inputMetadata: metadata,
      assumptions: analysis.assumptions,
    });
    setPlans(current => current.map(item => item.id === updated.id ? updated : item));
    return updated;
  }, []);

  const branch = useCallback(async (plan: JourneyPlanRecord, name: string) => {
    const created = await journeyPlanService.branch(plan, name);
    setPlans(current => [created, ...current]);
    return created;
  }, []);

  const activate = useCallback(async (plan: JourneyPlanRecord, analysis: JourneyAnalysis) => {
    const activated = await journeyPlanService.activate(plan, analysis);
    setPlans(current => current.map(item => {
      if (item.journey_id !== activated.journey_id) return item;
      if (item.id === activated.id) return activated;
      return {
        ...item,
        is_baseline: false,
        status: item.status === 'active' ? 'paused' : item.status,
      };
    }));
    return activated;
  }, []);

  return { plans, loading, error, reload, createFromDraft, update, branch, activate };
}
