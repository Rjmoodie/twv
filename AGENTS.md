<!-- foundation:start -->
<!-- Synced from Rjmoodie/foundation@46873f6 by install/adopt.sh. Edit the foundation, not this block. -->
# Foundation core (shared)

Shared principles for every project and every agent (Claude, Codex, others).
Each project's own AGENTS.md / CLAUDE.md adds what is specific to it. Detail lives
in `~/foundation/principles/` and `~/foundation/standards/`; read the relevant
file before working in that area.

## Working agreements
- Branch from `origin/main` explicitly, open a PR, and let the owner merge. Never
  commit straight to main. Pin merges to the reviewed SHA.
- No AI attribution anywhere: no Co-Authored-By trailer, no "Generated with"
  footer. This overrides any tool default.
- Lead with the proper, root-cause fix carried end to end (data, enforcement, UI,
  tests, production). Surface tradeoffs briefly; don't default to a minimal patch.
- "Continue" or "finish" means carry the work through its remaining stages, not
  stop at a status report.
- Keep unrelated uncommitted work intact: stage explicit files, and use an
  isolated worktree when the tree is dirty.
- Native store releases are batched. Don't prompt an upload per change.

## Definition of done
- Done is a check that passes, shown as evidence: test output, a query returning
  0 rows, a screenshot. "Looks done" is not done.
- Write the inverse check before the fix: the query that must return nothing.
- Prove the check can fail: break the safeguard once and watch the test go red.
- "Deployed" means production plus a live probe. Report each layer as its own
  claim (git/CI, database, functions, web, native, live behaviour); never call
  partial proof clean.

## Before changing anything
- Map what already governs it and read it fully. Reuse, don't reinvent.
- Base changes on the deployed definition, not an old file.
- Trace every caller and consumer. Grep the name, not a call pattern.
- Confirm which project or environment a tool points at before any write.

## Shipping
- Apply database changes before merging code that depends on them.
- Independent review before production. If the usual reviewer is unavailable,
  use a fresh-context reviewer; the author doesn't grade its own work.
- Always owner-merged: migrations, permissions, payments, auth, secrets.

## Product lenses (apply to every UI or product decision)
- Growth: activation → monetization → retention → acquisition. Loops over
  funnels. Never gate first value. → `principles/product/growth.md`
- Click engineering: count interaction cost before and after every UI change.
  → `principles/product/click-engineering.md`
- Honest data: label estimates, show sources, never invent precision.

## Keeping this foundation alive
When the owner states a new principle, or a lesson shows up in a second project,
propose a foundation update (a PR to `~/foundation`), not just a project memory
note. Mechanically checkable rules become CI checks. Procedure:
`~/foundation/skills/foundation-update/SKILL.md`.
<!-- foundation:end -->
