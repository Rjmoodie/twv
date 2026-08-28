# Architecture Overview

How the TW Ventures shell is put together, as of the non-real-estate cut.

This describes what is in the tree today. It is deliberately short — the
somatech version of this file ran to 436 lines cataloguing modules that no
longer exist, and a catalogue is exactly the kind of document that rots. Where
the code explains itself, this points at the code instead of restating it.

## Entry and routing

`src/main.tsx` → `src/App.tsx`. `App.tsx` mounts the provider stack and the
router; it holds no application logic.

Provider order matters and is load-bearing:

```
ErrorBoundary
└── QueryClientProvider      react-query, 5min stale / 10min gc, retry 1
    └── PerformanceProvider
        └── ErrorProvider
            └── AuthProvider          Supabase session
                └── TooltipProvider
                    └── BrowserRouter
```

Routes are thin. Everything of substance lives behind `/`:

| Route | Renders |
|---|---|
| `/` | `pages/SomaTech.tsx` — the module shell |
| `/pricing` | Standalone pricing page |
| `/reset-password` | Password recovery |
| `/auth/callback` | Email confirmation landing |
| `/404`, `*` | Not found |
| `/somatech` | Legacy redirect to `/`, preserving query params |

That last one is inherited from somatech and has no callers in this codebase.

## The module shell

`pages/SomaTech.tsx` is a single page that swaps modules in place rather than
routing between them. Three things follow from that, and they trip people up:

1. **The URL is the source of truth.** `?module=<id>` drives `activeModule`. A
   `NavigationContext` consumer — a breadcrumb, the command palette, the
   notification bell — navigates by writing the URL and nothing else. The effect
   that reconciles the URL is therefore the only channel those call sites have.
2. **An absent `module` param means the dashboard.** Not "leave it as it was".
3. **Navigation history is tracked in state**, not the browser stack, so the
   in-app back button and the Android hardware back button share one path.

Modules are registered in `components/somatech/constants.ts`. The registry is
what makes an id routable, what the sidebar renders, and what the document title
comes from. Adding a module means adding a registry entry **and** a `case` in
`renderContent`; the two are not wired together.

Currently registered:

| id | Component | Notes |
|---|---|---|
| `dashboard` | `Dashboard.tsx` | Rates panel only — see below |
| `real-estate` | `RealEstateCalculatorContainer.tsx` | BRRRR + traditional underwriting |
| `account` | `AccountSettings.tsx` | |
| `support` | `SupportPage.tsx` | |

`financial-calendar`, `privacy-policy` and `terms-of-service` have render cases
but no registry entry. The legal pages are reached directly; the calendar is
parked — see below.

## Layout

`layout/SomaTechLayout.tsx` composes the chrome around whatever module is
active: `SomaTechSidebar`, `SomaTechHeader`, `SomaTechContent`, and
`SomaTechDialogs`, plus `BottomNavigation` and `MobileNavigation` under `lg`.

`SomaTechContent` owns the document title and the screen-reader announcement on
module change. `EDGE_TO_EDGE_MODULES` in the layout is a set of module ids that
manage their own scroll container; it is currently empty.

## Access control

Two layers, and they answer different questions:

- **`config/moduleAccess.ts`** — can this user open this module? A rule per id
  giving `requiresAuth`, a `requiredFeature` flag, and the tier to highlight on
  the upgrade prompt. `getModuleAccessStatus` resolves to `ok` / `loading` /
  `unauthenticated` / `upgrade`. `ModuleAccessGate` renders the result.
- **`hooks/useSubscription`** — what tier is this user on, and which feature
  flags does that grant?

The tier model is two parallel paths rather than a ladder (Planner and Investor,
with Complete holding both). It is inherited from somatech and is due to be
replaced by an Investor / PM / Admin role split before any domain table lands —
so treat it as temporary scaffolding, not settled design.

`FeatureGuard` is a separate, simpler admin check on `profiles.role`.

## Dashboard

`Dashboard.tsx` renders one panel: `dashboard/RatesSnapshot`. Everything else
that used to live there was personal-finance or market data and went with the
cut. Rates survived on merit — the policy rate, the Treasury curve and consumer
borrowing costs feed the BRRRR refinance assumption directly.

This is the surface that becomes the deal pipeline, then the portfolio view.

## Calendar

`FinancialCalendar.tsx` is in the tree but not in the registry. Its personal
reminder half still works; its market half read earnings, FDA and macro feeds
from an edge function that was deleted. It is kept as the starting point for
repointing at project milestones, inspections and permits, and deliberately not
reachable until then.

## Backend

Supabase — Postgres, Auth, and twenty edge functions:

| Group | Functions |
|---|---|
| Billing | `checkout`, `create-checkout-session`, `create-subscription`, `create-portal-session`, `customer-portal`, `billing-portal`, `check-subscription`, `stripe-webhook` |
| Real estate | `fetch-real-estate-leads`, `enrich-real-estate-leads`, `geocode-real-estate-leads`, `get-mapbox-token` |
| Rates | `fetch-rates` (FRED) |
| Notifications | `dispatch-notifications`, `email-unsubscribe`, `resend-webhook` |
| Account | `delete-account` |
| Bank data | `plaid-link`, `plaid-sync` |

`_shared/` holds the pieces more than one function needs. Two are worth knowing
about before you touch outbound mail:

- **`email-brand.ts`** classifies every message as transactional, marketing or
  internal, and **throws** rather than warns when the material and the class
  disagree — because the class, not the caller, decides what the footer must
  legally carry under CAN-SPAM.
- **`notificationPolicy.ts`** resolves delivery channels from
  `notification_channel_policies` rows. Adding a notification type is an insert,
  not a new branch in the dispatcher.

`emailTemplates.ts` currently registers one event type, `calendar_reminder`. An
unregistered type is dead-lettered with a clear error rather than being sent
with invented copy.

### Database

`supabase/migrations/` is **empty by design**. TW runs its own Supabase project
and ports tables one at a time. The 68 inherited migrations sit in
`supabase/migrations.somatech-reference/` as reference only — and that ledger
has known drift from the database it came from, so verify DDL against the source
schema rather than trusting the file. See `supabase/migrations/README.md`.

`src/integrations/supabase/types.ts` is generated from the *somatech* database
and still describes tables this project does not have. Treat it as a historical
artifact until TW's own schema exists and the file is regenerated.

## Build and quality gates

- **Vite** with manual chunking; the production build **fails** without Supabase
  configuration rather than shipping a bundle that cannot authenticate. Override
  deliberately with `ALLOW_MISSING_SUPABASE=1`.
- **`npm run typecheck`** runs `scripts/typecheck-gate.mjs`, which fails only on
  unresolved identifiers (TS2304/TS2552) — the errors that survive bundling and
  throw at runtime — and reports the remaining backlog without failing on it.
  `npm run typecheck:full` shows everything.
- **Vitest** for unit tests, **Playwright** for e2e, **Lighthouse CI** for
  performance budgets.
- **Capacitor** wraps `dist/` for iOS and Android. `capacitor.config.ts` strips
  the dev server block on a production build.

## Known inherited debt

Carried over from somatech, none of it load-bearing, all of it worth knowing:

- A type-error backlog the gate reports but does not fail on.
- `components/somatech/utils.ts` and `types.ts` still carry types and helpers for
  removed modules; real-estate code imports both, so pruning them is separate
  surgery.
- `AdminNavigation` links to `/admin` routes that do not exist in `App.tsx`.
- A handful of files under `components/ui/` and `components/somatech/lead-gen/`
  are unreferenced or reference missing siblings, and predate the cut.
- The whole tree is still named `somatech` — the directory, the shell components,
  storage keys, and user-visible copy.
