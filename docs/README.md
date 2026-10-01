# TW Ventures Documentation

Technical documentation for the TW Ventures platform.

## Index

| Document | Covers |
|---|---|
| [Architecture Overview](./ARCHITECTURE_OVERVIEW.md) | How the shell, routing, and module registry fit together |
| [Deployment Guide](./DEPLOYMENT.md) | Vercel build and deploy |
| [Security Guide](./SECURITY.md) | Secrets handling, RLS posture, security review checklist |

That is the complete set. The previous index advertised twenty-two documents,
nineteen of which never existed — the links had been broken since the somatech
import. Add a row here when you add a file, and only then.

## Where the rest of the documentation lives

Most of this codebase is documented in place rather than in prose files, and
that is deliberate — a header comment cannot drift away from the code it sits
on:

- **Environment variables** — `.env.example`, with a comment per key explaining
  what breaks without it.
- **Edge functions** — each `supabase/functions/*/index.ts` opens with what it
  does and why. `_shared/email-brand.ts` in particular carries the CAN-SPAM
  reasoning behind the mail variants.
- **Database** — `supabase/migrations/README.md` is the annotated ledger: what
  each of the fifteen migrations does, and what has actually been replayed.
- **Type gate** — `scripts/typecheck-gate.mjs` explains what it fails on and
  why the root tsconfig cannot be used for the check.

## Reference material

`docs/data/README.md` lists the source material kept for planning. Nothing in
that directory is imported or built against.
