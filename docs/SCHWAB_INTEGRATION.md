# Schwab Trader API Integration

**Status:** planned, not started
**Author:** drafted 2026-08-27
**Track:** Trader API — Individual (Commercial-ready architecture)

---

## 1. What this replaces

Today, getting an executed trade into the SomaTech dashboard runs through a human:

```
you trade in Schwab  →  you type it into Discord  →  bot parses the text  →  row appears in the dashboard
```

Three of those four steps are transcription. The Schwab Trader API removes them:

```
you trade in Schwab  →  scheduled sync reads the fill  →  row appears in the dashboard
```

The gain isn't only convenience. The synced version carries the **real fill price and timestamp** from the broker, rather than what you remembered to type — and it can't be forgotten, mistyped, or skipped when you're busy.

---

## 2. Scope

**In scope — read only:**

- OAuth connection to a Schwab brokerage account
- Sync executed transactions into `execution_log`
- Sync positions and balances into `portfolio_holdings`
- Batch quotes for portfolio valuation

**Explicitly out of scope:**

- `POST /accounts/{id}/orders` — placing orders
- `PUT` / `DELETE` on orders — replacing or cancelling
- `POST /previewOrder`

### Why read-only, deliberately

1. **There is no sandbox.** Schwab's docs state the Trader API sandbox will "be available later this year." Every call during development hits a live account with real money.
2. **The workflow never needed order entry.** The Discord relay *reported* trades; it never placed them. You trade manually and always have.
3. **Blast radius.** A bug in a read-only sync writes a wrong row in a table. A bug near order entry writes a wrong trade.

Order placement stays out until there's a sandbox and a reason. This is not a placeholder for "phase 6."

---

## 3. Verified contract

Taken from the Schwab Developer Portal docs on 2026-08-27, cross-checked against the `schwabdev` open-source client.

### Endpoints

```
Base:  https://api.schwabapi.com/trader/v1

GET  /accounts/accountNumbers              → accountNumber + hashValue
GET  /accounts                             → balances and positions, all linked accounts
GET  /accounts/{accountHash}               → one account
GET  /accounts/{accountHash}/transactions  ?startDate &endDate &types(required) &symbol
GET  /accounts/{accountHash}/orders        ?fromEnteredTime &toEnteredTime &maxResults &status
GET  /userPreference                       → streamer + client ids

Base:  https://api.schwabapi.com/marketdata/v1

GET  /quotes                               ?symbols &fields &indicative
```

`accountNumbers` → `hashValue` is **mandatory**. Every subsequent call uses the hash, never the raw account number.

### OAuth (3-legged)

```
Authorize  https://api.schwabapi.com/v1/oauth/authorize
             ?client_id={CLIENT_ID}&redirect_uri={CALLBACK}

Callback   https://{CALLBACK}/?code={CODE}&session={SESSION}

Token      POST https://api.schwabapi.com/v1/oauth/token
           Authorization: Basic base64(client_id:client_secret)
           Content-Type: application/x-www-form-urlencoded

  initial  grant_type=authorization_code&code={CODE}&redirect_uri={CALLBACK}
  refresh  grant_type=refresh_token&refresh_token={TOKEN}

Response   { expires_in: 1800, token_type: "Bearer", scope: "api",
             access_token, refresh_token, id_token }
```

### Three gotchas that will cost a debugging session each

1. **The auth code must be URL-decoded before the token exchange.** Schwab's example: it should end in `@`, not `%40`. Sending it encoded returns an opaque 400.
2. **The callback lands on a 404 page** — Schwab's own docs say "the address bar will contain code." Your callback route must exist and capture `?code=` server-side, or you are copy-pasting out of a browser bar forever.
3. **No sandbox.** See §2.

---

## 4. Constraints that shape the design

| Constraint | Value | Consequence |
|---|---|---|
| Access token life | 30 minutes | Refresh on nearly every sync run |
| **Refresh token life** | **7 days, hard, from creation** | **Weekly re-auth is mandatory and cannot be automated** |
| Refresh invalidated by | Password reset | Re-auth can be triggered without warning |
| GET requests | **Unthrottled** | Polling costs nothing; no rate budget to manage |
| Order writes | 0–120/min per account | Irrelevant — out of scope |
| Streamer | WebSocket, **1 connection per user** | Cannot be hosted on request-scoped functions |

### Decision: poll, do not stream

`ACCT_ACTIVITY` on the Streamer API pushes order fills in real time and is the theoretically superior design. It is rejected for now because:

- It requires a **persistent WebSocket**. Supabase Edge Functions and Vercel Functions are request-scoped and die between invocations. Neither can hold it.
- Hosting it means adding an always-on worker (Fly, Railway, a VM) — new infrastructure, new failure modes, new cost.
- The use case is publishing your trades to members. **Five-minute latency is not a product problem.**

GET being unthrottled removes the only argument for streaming under the current requirements. Revisit if sub-minute latency ever matters.

---

## 5. Architecture

Reuses the pattern already proven by `dispatch-notifications`:

```
pg_cron (*/15)
  └─→ dispatch_schwab_sync_tick()        security definer, secrets from Vault
        └─→ net.http_post
              └─→ supabase/functions/schwab-sync
                    ├─→ token service (refresh if <5 min left)
                    ├─→ GET /accounts/{hash}/transactions   since cursor
                    ├─→ GET /accounts/{hash}                positions
                    └─→ upsert execution_log + portfolio_holdings
                          └─→ ExecutionLog.tsx / HoldingsTable.tsx  (already built)
```

**The receiving end already exists.** `execution_log` has `ticker`, `action`, `shares`, `notional_usd`, `fill_price`, `status`, `filled_at`, `rationale`. `ExecutionLog.tsx` already renders it in the portfolio Brokerage tab. `brokerage_connections.provider` already accommodates a second broker.

What is missing is one sync function and a token service.

---

## 6. Schema changes

New migration, e.g. `20260828000000_schwab_connection.sql`.

### 6.1 Token storage

Per-connection tokens rotate and must never reach a client. Same posture as `notification_outbox`: **RLS enabled, zero policies**, service-role only.

```sql
create table public.schwab_oauth_tokens (
  connection_id       uuid primary key references public.brokerage_connections(id) on delete cascade,
  access_token        text not null,
  access_expires_at   timestamptz not null,
  refresh_token       text not null,
  refresh_expires_at  timestamptz not null,
  last_refreshed_at   timestamptz,
  updated_at          timestamptz not null default now()
);

alter table public.schwab_oauth_tokens enable row level security;
-- Intentionally no policies. Service role only.
```

Do **not** put these in Vault. Vault is keyed by name and suits a small number of app-level secrets (as with `notification_dispatch_secret`); per-user rotating tokens belong in a table with a foreign key and a cursor.

`SCHWAB_CLIENT_ID` and `SCHWAB_CLIENT_SECRET` **do** belong in Supabase function secrets — they are app-level and never rotate per user.

### 6.2 Connection metadata

```sql
alter table public.brokerage_connections
  add column if not exists account_hash        text,
  add column if not exists last_synced_at      timestamptz,
  add column if not exists sync_cursor         timestamptz,
  add column if not exists connection_status   text not null default 'active'
    check (connection_status in ('active','expiring','expired','error'));
```

### 6.3 Generalise the order id

`execution_log.alpaca_order_id` is provider-specific and predates having a `provider` column.

```sql
alter table public.execution_log
  add column if not exists broker_order_id text;

update public.execution_log
   set broker_order_id = alpaca_order_id
 where broker_order_id is null and alpaca_order_id is not null;

-- Dedupe key for sync. Partial: manual rows have no broker id.
create unique index if not exists execution_log_broker_order_uniq
  on public.execution_log (connection_id, broker_order_id)
  where broker_order_id is not null;
```

Keep `alpaca_order_id` for one release, then drop it once `alpacaService.ts` reads the new column.

> **Note:** a partial unique index cannot serve as an `ON CONFLICT` arbiter unless the predicate is repeated, and PostgREST cannot do that. Sync must therefore run its upsert as explicit SQL through a security-definer function, **not** through `supabase.from(...).upsert(..., { onConflict })`. This exact trap already cost this codebase a production bug — see `20260825010800`.

---

## 7. Token service

The single most failure-prone component. Requirements:

1. **Refresh proactively** — if `access_expires_at` is under 5 minutes away, refresh before making calls.
2. **Always persist the returned `refresh_token`.** Schwab's refresh response includes one. Whether or not it currently rotates, storing what comes back is rotation-safe and is what was attested to on the company registration form.
3. **Serialize refreshes.** Two concurrent refreshes will race and one will persist a stale token, locking the user out. Use a Postgres advisory lock keyed on `connection_id`:

```sql
select pg_advisory_xact_lock(hashtext('schwab_token'), hashtext(connection_id::text));
```

Take the lock, re-read the row inside it, and skip the refresh if another worker already did it.

4. **Never log tokens.** Not on error paths, not in Sentry breadcrumbs.

---

## 8. The weekly re-auth loop — mandatory, not polish

The refresh token dies 7 days after creation regardless of activity. Without handling, day 8 looks like this: sync gets a 401, the catch marks it failed, and **the dashboard keeps showing last week's data with no indication it is stale.** In a finance app that is worse than an outright error.

Three pieces:

**1. Expiry warning.** A daily check queues a notification when `refresh_expires_at` is under 48 hours away. Reuse the existing pipeline — `notification_outbox` → `dispatch-notifications` → in-app / email / push. No new infrastructure.

**2. Reconnect affordance.** `BrokerageConnect.tsx` shows connection status and a **Reconnect** button that restarts the authorize flow:

```
Schwab · Connected · expires in 3 days        [ Reconnect ]
Schwab · Expired                              [ Reconnect ]
```

**3. Honest degradation.** When a connection is expired, the sync marks `connection_status = 'expired'` and the UI labels the data with its `last_synced_at` rather than presenting it as current. This turns a silent correctness bug into a visible, harmless one.

---

## 9. Components to build

| Path | Responsibility |
|---|---|
| `supabase/migrations/20260828000000_schwab_connection.sql` | §6 schema |
| `supabase/functions/_shared/schwabToken.ts` | Token service — §7 |
| `supabase/functions/schwab-oauth/index.ts` | Callback: URL-decode code, exchange, store, fetch `accountNumbers`, create connection |
| `supabase/functions/schwab-sync/index.ts` | Poll transactions + positions, dedupe, upsert |
| `src/components/somatech/portfolio/BrokerageConnect.tsx` | Schwab provider, status row, Reconnect |
| `src/services/brokerage/schwabService.ts` | Client-side connection CRUD, mirroring `alpacaService.ts` |

Callback URL to register: `https://somatech.pro/api/schwab/callback` — must be HTTPS, 255-char limit across all registered URLs, comma-separated if multiple.

---

## 10. Delivery phases

**Phase 0 — Prerequisites** *(you, not code)*
Register the app on the Individual track. Record `client_id` / `client_secret` into Supabase function secrets — never into the repo or a chat window. Register the callback URL.

**Phase 1 — OAuth loop only.** Connect, store tokens, refresh, reconnect. No data sync at all. Ship it and **let it run for two weeks** to feel the re-auth cycle before anything depends on it. This phase exists specifically to de-risk the 7-day expiry.

**Phase 2 — Transaction sync.** Cron → `execution_log`. This is the phase that retires the Discord relay. Verify against a known trade before trusting it.

**Phase 3 — Positions and quotes.** Replace hand-maintained `portfolio_holdings` for the linked account. Point `refreshHoldingQuotes` at batch `/quotes` — one request replaces the current pool of 4, and the concurrency pool comes out.

**Phase 4 — Commercial track** *(only when a member actually asks)*. Company registration, fit review, per-member tokens. The code from phases 1–3 does not change; the only difference is that `brokerage_connections` holds many rows instead of one. Expect the reviewer to ask about `autonomous-rebalance`'s `approval_required=false` auto-submit path — have an answer ready.

**Phase 5 — Streaming** *(only if latency ever matters)*. Requires an always-on worker. See §4.

---

## 11. Open items

Blocking Phase 2:

- [ ] **`Transaction` schema body** — exact field names for a fill: which id is stable for dedupe, where symbol / quantity / price / side live, which timestamp is the fill time. Likely nested under `transferItems[]`.
- [ ] **`TransactionType` enum** — `types` is a required query parameter and must not be guessed.

Worth asking `TraderAPI@Schwab.com`:

- [ ] Does the Commercial track rotate refresh tokens, or is it the same hard 7 days? The registration form asks about rotation support, which sits oddly against the documented fixed expiry.
- [ ] Does `Market Data - Commercial` carry per-user fees, and are exchange licenses passed through or included?

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Weekly re-auth becomes a support burden | High at scale | Phase 1 proves it with one user first |
| No sandbox — development against live money | High | Read-only scope; order endpoints never called |
| Concurrent refresh races, locking users out | Medium | Advisory lock, §7 |
| Stale data presented as current | Medium | `connection_status` + `last_synced_at` labelling, §8 |
| Only covers Schwab-holding members | Medium | Keep the existing quote path for everyone else |
| Client secret leakage | High | Function secrets only; never repo, never chat |

---

## 13. What this does not solve

Schwab supplies quotes, price history, option chains with Greeks, movers, market hours, and instrument search. It does **not** supply:

- **Earnings calendar** — stays on Alpha Vantage
- **Financial statements** — stays on SEC EDGAR, which is free and better for this
- **PDUFA / FDA** — unrelated; still needs a forward-looking source

This is an addition to the data layer, not a consolidation of it.
