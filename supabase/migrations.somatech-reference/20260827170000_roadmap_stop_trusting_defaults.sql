-- Roadmap: stop reading column defaults as facts the user stated.
--
-- financial_profiles' snapshot columns shipped with DEFAULT 0 / false, which made
-- "never told us" indistinguishable from "told us zero". Every roadmap predicate
-- of the form `high_interest_debt === 0` therefore fired on brand-new profiles,
-- and detectAutoCompletions persisted the result to user_milestones — where
-- resolveState trusted the stored row forever. Entering real debt afterwards did
-- not undo it.
--
-- Two fixes here: unset means NULL, and every milestone row records whether a
-- human or an inference put it there.
--
-- Run in Supabase Dashboard → SQL Editor. Section 0 is a preview; read it before
-- running section 3.

-- ── 0. Preview: what section 3 will delete ────────────────────────────────────
-- select um.user_id, um.milestone_id, um.status, um.completed_at
--   from public.user_milestones um
--   join public.financial_profiles fp on fp.user_id = um.user_id
--  where um.milestone_id in ('p1-kill-highcost-debt', 'p2-midcost-debt', 'p4-debt-clear')
--    and fp.snapshot_completed is not true;

begin;

-- ── 1. Unset means unset ──────────────────────────────────────────────────────
alter table public.financial_profiles
  alter column high_interest_debt drop default,
  alter column low_interest_debt  drop default,
  alter column liquid_savings     drop default,
  alter column employer_match_pct drop default,
  alter column has_hsa_access     drop default;

-- ── 2. Clear values nobody ever stated ────────────────────────────────────────
-- A completed snapshot is the only evidence that a 0 was typed rather than
-- defaulted, so rows with snapshot_completed = true are left exactly as they are.
update public.financial_profiles
   set high_interest_debt = null,
       low_interest_debt  = null,
       liquid_savings     = null,
       employer_match_pct = null,
       has_hsa_access     = null
 where snapshot_completed is not true;

-- ── 3. Remove completions inferred from those defaults ────────────────────────
-- These three milestones are the ones whose completionCheck read a defaulted
-- column. Existing rows carry no marker distinguishing an auto-write from a hand
-- tick (bulkUpsertMilestones set completed_at exactly like upsertMilestone did),
-- so this deletes on the only available signal: the profile never completed a
-- snapshot, meaning the predicate could only ever have seen defaults. A user who
-- ticked one of these by hand before filling in their snapshot loses the tick and
-- can re-set it; the alternative is leaving a false "debt cleared" in place.
delete from public.user_milestones um
 where um.milestone_id in ('p1-kill-highcost-debt', 'p2-midcost-debt', 'p4-debt-clear')
   and exists (
     select 1
       from public.financial_profiles fp
      where fp.user_id = um.user_id
        and fp.snapshot_completed is not true
   );

-- ── 4. Record who decided ─────────────────────────────────────────────────────
-- Existing rows default to 'user': after section 3 the remaining rows belong to
-- profiles with a real snapshot, so crediting them to the user is the safe read.
-- From here on the app writes 'auto' for inferred completions, and the roadmap
-- re-evaluates those against the current profile instead of trusting them.
alter table public.user_milestones
  add column if not exists source text not null default 'user'
    check (source in ('user', 'auto'));

commit;
