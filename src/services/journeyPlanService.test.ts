import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('journey operating-plan migration', () => {
  const sql = fs.readFileSync(path.resolve('supabase/migrations/20260826060000_journey_operating_plans.sql'), 'utf8');

  it('enforces one baseline and one active plan per journey', () => {
    expect(sql).toContain('journey_plans_one_baseline_idx');
    expect(sql).toContain("where status = 'active'");
  });

  it('checks scenario ownership and activates with optimistic revision control', () => {
    expect(sql).toContain('parent.user_id = new.user_id');
    expect(sql).toContain('p_expected_revision');
    expect(sql).toContain('activated_revision = selected.revision + 1');
    expect(sql).toContain("errcode = '40001'");
  });

  it('keeps actions stable across recalculation', () => {
    expect(sql).toContain('unique(plan_id, action_key)');
    expect(sql).toContain('source_revision');
    expect(sql).toContain('on public.financial_events(user_id, journey_plan_id, source_key);');
  });

  it('completes plan actions and calendar events through one status function', () => {
    expect(sql).toContain('set_journey_plan_action_status');
    expect(sql).toContain("set is_completed = (p_status = 'completed')");
    expect(sql).toContain("event_key = any");
    expect(sql).toContain('sync_journey_action_from_financial_event');
  });

  it('links shared progress to the activated source revision without exposing balances', () => {
    expect(sql).toContain('journey_posts_plan_idx');
    expect(sql).toContain("verification_mode in ('plan_activation','user_reported')");
  });
});
