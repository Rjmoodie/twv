-- Research scores are a shared, trusted cache. Browser users may read it, but
-- allowing any authenticated account to replace raw_financials lets one user
-- alter the scores shown to every other user.

drop policy if exists "research_scores_insert_auth" on public.research_scores;
drop policy if exists "research_scores_update_auth" on public.research_scores;

revoke insert, update, delete on table public.research_scores from authenticated;

comment on table public.research_scores is
  'Shared research cache. Client read-only; writes are restricted to trusted server roles.';
