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
5. `20260828140000_project_access_crm_portfolio.sql` — project-scoped access,
   CRM, investor records, invitations, and the portfolio read model.
6. `20260829100000_investor_inquiries.sql` — investor inquiry capture and
   accreditation records.
7. `20260829110000_project_collaboration.sql` — private project files, with
   audience-aware metadata as the source of truth.
8. `20260829120000_pm_public_portfolios.sql` — `pm_portfolio_entries`, the
   published case-study table behind the public portfolio.
9. `20260830100000_project_inquiries.sql` — public client-service intake.
   Submitting does not create an account, project, membership, or contract.
10. `20260830120000_single_tenant_scoping.sql` — corrects three places written
    as though exactly one organization would ever exist. The schema stays
    org-scoped.
11. `20260830130000_project_inquiry_scoping.sql` — the companion fix to the
    above, for `submit_project_inquiry`, which that migration missed.
12. `20260830140000_dispatch_schedule.sql` — schedules the notification
    dispatcher with pg_cron, after Vercel Hobby refused a 5-minute cron.
13. `20260830150000_rls_initplan.sql` — wraps `auth.uid()` as
    `(select auth.uid())` in policies so it is evaluated once per query
    rather than once per candidate row.
14. `20260903193000_services_project_manager_access.sql` — grants the Services
    account the organization-level Project Manager persona used by `/pm`.
    Project assignments stay explicit in `project_members`.
15. `20260906120000_portfolio_gallery_and_geo.sql` — replaces the bare `text[]`
    of photo URLs with an ordered array of objects carrying captions, plus
    project geocoding.

`../tests/20260828_backend_foundation.test.sql` is the RLS and lifecycle smoke
suite for this foundation.

## Validation status

The first four migrations applied successfully to a fresh local Supabase stack
on 2026-08-28. That is local replay evidence for the foundation only, and the
eleven migrations added since have not been replayed from zero as a set. The
repository is not linked to a hosted project from here.

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
