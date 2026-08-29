# TW Ventures

A vertically integrated real-estate development platform — internal underwriting
through investor reporting.

The firm runs one asset through five stages: acquisitions, development,
construction, stabilization, and management. The platform is built as that
lifecycle rather than as a set of disconnected tools, so a deal carries its
underwriting forward into the budget it is later measured against.

## Status

**Phase 0 UI, Phase 1 backend foundation.** The app logs in, routes, and
underwrites deals. The database now carries deals through projects, budgets,
costs, draws, and milestones, but those operational screens, the investor
portal, the fee-client track, and the public site are not built yet.

This codebase began as a copy of the somatech platform, and the non-real-estate
half of that product has been removed. What remains is the shell, auth, billing,
and the real-estate surface. Expect to find inherited naming and inherited debt —
see [Architecture Overview](./docs/ARCHITECTURE_OVERVIEW.md) for the honest list.

## What works today

| Area | State |
|---|---|
| Auth, session handling, account settings | Working |
| BRRRR and traditional rental underwriting | Working — ported as-is |
| Saved deals, deal comparison, amortization | Working |
| Property deal sourcing, Mapbox + PostGIS maps | Working |
| Interest rates panel (FRED) | Working |
| Stripe subscriptions and billing portal | Working |
| Notifications and outbound mail | Schema and worker code ready locally; not deployed |
| Database schema | Fresh TW schema — local replay passed; not linked or deployed |
| Project lifecycle backend | Schema ready — UI not built |

## Stack

- **Frontend** — React 18, TypeScript, Vite, Tailwind, shadcn/ui
- **Backend** — Supabase (Postgres, Auth, 18 edge functions)
- **Payments** — Stripe
- **Maps** — Mapbox GL, Turf, PostGIS
- **Mobile** — Capacitor (iOS and Android shells)
- **Hosting** — Vercel

## Local development

Requires Node 22+, a Supabase project, and a Stripe account for billing work.

```bash
npm install
cp .env.example .env    # then fill it in
npm run dev             # http://localhost:8081
```

`.env.example` documents every key and what breaks without it. The production
build **fails** without Supabase configuration rather than shipping a bundle
that cannot authenticate — override deliberately with
`ALLOW_MISSING_SUPABASE=1 npm run build` if you are building without a backend
on purpose.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server on :8081 |
| `npm run build` | Production build |
| `npm run typecheck` | Type gate — fails on unresolved identifiers, reports the rest |
| `npm run typecheck:full` | Every type error, including the inherited backlog |
| `npm test` | Vitest |
| `npm run test:e2e` | Playwright |
| `npm run lint` | ESLint |
| `npm run cap:ios` / `cap:android` | Build, sync, and open the native shell |

## Database

`supabase/migrations/` now contains TW's fresh foundation in dependency order:
platform identity and billing, the real-estate lifecycle, lead sourcing, and
communications/account operations. The sequence was replayed against a clean
local Supabase database; it has not been linked to or deployed on a hosted
project.

The 68 inherited migrations that used to sit in
`supabase/migrations.somatech-reference/` were removed on 2026-08-29. They were
never part of TW's ledger; recover one from git history if you need it (see
[supabase/migrations/README.md](./supabase/migrations/README.md)). Read that file
before extending the schema.

Do not apply TW migrations through the configured Supabase MCP connection — it
points at a different project.

## Documentation

- [Architecture Overview](./docs/ARCHITECTURE_OVERVIEW.md) — how the shell fits together
- [Deployment](./docs/DEPLOYMENT.md)
- [Security](./docs/SECURITY.md)

Most of the codebase is documented in place: `.env.example` per key, edge
functions in their own header comments, and the type gate in
`scripts/typecheck-gate.mjs`.

## Security

- `.env` is gitignored and must never be committed
- Row Level Security on every Supabase table
- Server-side secrets live in Supabase edge function secrets, never in `.env`
- Outbound mail is compliance-checked at render time — see
  `supabase/functions/_shared/email-brand.ts`

---

TW Ventures LLC
