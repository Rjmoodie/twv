# Migrations

Empty by design. TW Ventures runs its own Supabase project with its own schema.

`../migrations.somatech-reference/` holds the 68 migrations inherited from the
somatech codebase. They are REFERENCE ONLY — do not apply them as a set.

Two reasons:

1. Most of them are for modules TW does not have (stocks, options, brokerage,
   LMS, Discord, trades).
2. The somatech ledger has drifted from its production database. Tables exist in
   production with no migration file — `brrrr_deals` is one, and it is not the
   only one. Treat `src/integrations/supabase/types.ts` in that repo as the more
   reliable record of what actually exists.

When porting a table, write a fresh migration here and verify the DDL against
the somatech production schema rather than trusting the reference file.
