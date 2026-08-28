# Security

Practices for the TW Ventures platform, and the specific traps this codebase
inherited.

## Before anything else: which project are you pointed at?

This repo was copied from somatech, and the copy brought somatech's Supabase
project ref with it. That has been cleared, but the lesson stands — there are
**three** independent ways to accidentally operate on the wrong database:

| Path | Guard |
|---|---|
| `supabase/config.toml` → `project_id` | Now `TW_PROJECT_REF_NOT_SET`; fill in with TW's ref only |
| The configured Supabase MCP connection | Points at a different project — never apply TW migrations through it |
| `.env` → `VITE_SUPABASE_URL` | Must be TW's project; check before any `db push` |

Before running any destructive CLI command, confirm the target:

```bash
supabase projects list      # which projects can this token reach?
supabase status             # what is this directory linked to?
```

`supabase db reset` against the wrong project destroys it. There is no undo.

## Secrets

**Do:**
- Keep `.env` local and gitignored — it already is
- Put server-side secrets in Supabase edge function secrets, never in `.env`
- Use the anon key in the browser and rely on RLS to protect data
- Rotate anything that has ever been committed, even briefly

**Don't:**
- Commit `.env`, service role keys, or a database URL
- Paste a project ref or key into documentation — this file used to carry
  somatech's, which is how the wrong-project problem propagated
- Ship the service role key to the browser under any circumstance

`.env.example` documents every key and what breaks without it.

## Row Level Security

Every table holding user or client data gets RLS enabled and explicit policies.
A table without RLS is readable by anyone holding the anon key, which is
everyone.

The build plan makes `project_members` the access spine — nearly every
investor and fee-client read resolves through it. Write policies that way from
the first migration rather than per-table ad hoc rules:

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Membership is the grant. One join, one place to audit.
CREATE POLICY "Members read their projects" ON projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = projects.id
        AND project_members.user_id = auth.uid()
    )
  );
```

Two rules that are painful to retrofit, so apply them from the start:

- **A PM is not an Admin.** A project manager running a job must not see the
  equity structure behind it. Separate the roles before the tables exist —
  changing this later means rewriting every policy.
- **`documents.visibility` is not optional.** An LP operating agreement, a fee
  client's lien waiver, and an internal job-cost sheet cannot share a bucket.

## Database function hygiene

Two findings the Supabase Security Advisor raises that are worth pre-empting:

**Mutable search_path.** A `SECURITY DEFINER` function without a pinned
`search_path` can be hijacked by a caller who creates a shadowing object:

```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''          -- pin it, always
AS $$
BEGIN
  -- fully qualify every reference: public.my_table, not my_table
END;
$$;
```

**Extensions in the public schema.** Move them:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION postgis SET SCHEMA extensions;
```

Run the Security Advisor in the project dashboard after each migration batch —
Project Settings → Security.

## Edge function authentication

Functions verify the caller's Supabase JWT by default. Turning that off is
occasionally correct and always needs a stated reason in `config.toml`, because
the next reader cannot tell an intentional exception from an oversight.

Current exceptions, both justified in the file:

- `resend-webhook` — authenticates by Svix signature
- `email-unsubscribe` — authenticates by a server-issued one-time token

Anything called by a third party with no user session (Stripe's webhook, a cron
trigger) needs this considered explicitly. A function that 401s a webhook fails
silently from the caller's side.

## Outbound mail

`supabase/functions/_shared/email-brand.ts` classifies every message as
transactional, marketing, or internal, and **throws** rather than warns when the
class and the material disagree. That is deliberate: under CAN-SPAM the class,
not the caller, decides what the footer must legally carry. Marketing mail
requires a working opt-out and a physical postal address; transactional mail
must not offer an unsubscribe link.

Change the brand block, not the variant logic, and keep its tests passing.

## If a key is compromised

1. Rotate it at the provider immediately — Supabase, Stripe, Mapbox
2. Update the Supabase edge function secrets and the Vercel environment
3. Redeploy so the new value is in the bundle (Vite inlines `VITE_*` at build
   time — a rotated key does nothing until you rebuild)
4. Review the provider's access logs for the exposure window
5. If the service role key leaked, treat the database as compromised: audit
   recent writes before assuming it was unused

## Checklist

**Before the first deploy**
- [ ] `config.toml` `project_id` is TW's, not somatech's
- [ ] RLS enabled on every table holding user or client data
- [ ] PM and Admin separated in the role model
- [ ] `documents.visibility` modelled in the first migration that adds documents
- [ ] Security Advisor reviewed with no unresolved errors
- [ ] Edge function `verify_jwt` exceptions each carry a stated reason
- [ ] No secret in git history

**Ongoing**
- [ ] Security Advisor after each migration batch
- [ ] `npm run security:audit` in CI
- [ ] Rotate keys on staff changes
- [ ] Review RLS policies whenever a new counterparty type is added
