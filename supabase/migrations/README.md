# TW Ventures migrations

This directory is TW Ventures' authoritative migration ledger. It is fresh by
design and must remain independent of the inherited SomaTech ledger.

Apply in timestamp order:

1. `20260828100000_platform_foundation.sql` — Auth profiles, organizations,
   memberships, RLS helpers, billing, usage, and avatar storage.
2. `20260828110000_real_estate_operations.sql` — properties, deal pipeline,
   immutable underwriting versions, saved BRRRR compatibility, projects,
   budgets, costs, draws, and milestones.
3. `20260828120000_lead_sourcing.sql` — public-source leads, fetch jobs, and
   private review state.
4. `20260828130000_communications_and_account.sql` — account operations,
   feedback, consent, notification routing/outbox, delivery ledgers, and
   calendar/project reminder queue functions.

`../tests/20260828_backend_foundation.test.sql` is the RLS and lifecycle smoke
suite for this foundation.

## Validation status

The complete four-migration sequence applied successfully to a fresh local
Supabase stack on 2026-08-28. This is local replay evidence only: the repository
is not linked to a TW hosted project and no migration has been deployed.

The first pgTAP run found three privilege-boundary gaps caused by inherited
Supabase role grants. The migrations now explicitly revoke those defaults
before applying their least-privilege grants, and the hardened sequence replayed
cleanly from zero. The 26-assertion pgTAP suite still needs a post-hardening
rerun; do not treat the clean replay alone as proof that every assertion passes.

The 68 migrations inherited from the somatech codebase used to sit in
`../migrations.somatech-reference/`. They were removed on 2026-08-29 and live
only in git history now:

    git show :supabase/migrations.somatech-reference/<file>.sql
    git log --diff-filter=D -- 'supabase/migrations.somatech-reference/*'

Never apply them as a set. Two reasons:

1. Most of them are for modules TW does not have (stocks, options, brokerage,
   LMS, Discord, trades).
2. The somatech ledger has drifted from its production database. Tables exist in
   production with no migration file — `brrrr_deals` is one, and it is not the
   only one. Treat `src/integrations/supabase/types.ts` in that repo as the more
   reliable record of what actually exists.

When extending the schema, write a fresh TW migration here. Reference the old
files only to discover an active caller's column contract; do not copy their
ledger, roles, grants, or policies wholesale.
