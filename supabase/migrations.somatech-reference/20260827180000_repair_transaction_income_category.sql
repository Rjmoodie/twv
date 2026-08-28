-- Repair: let stored transactions tell income apart from transfers.
--
-- plaid-sync wrote `category_key = null` for BOTH income and 'ignore' (transfers,
-- card payments). Anything rebuilding a month from plaid_transactions therefore
-- could not distinguish them, and the historical backfill classified by sign —
-- so every TRANSFER_IN, which carries a negative amount, was counted as income.
-- That inflated income and savings rate for every past month.
--
-- plaid-sync now stores 'income' explicitly, but existing rows predate that and
-- would be skipped (under-reporting income) until a full re-sync. transactions/
-- sync is cursor-based and will not re-deliver them, so they are repaired here
-- from plaid_category, which already holds the Plaid personal_finance_category.
--
-- Run in Supabase Dashboard → SQL Editor.

-- ── 0. Preview: what will be relabelled ───────────────────────────────────────
-- select plaid_category, count(*), sum(abs(amount))
--   from public.plaid_transactions
--  where category_key is null
--    and amount < 0
--    and plaid_category is not null
--  group by plaid_category
--  order by 2 desc;

begin;

-- Income categories in Plaid's PFC taxonomy all start with INCOME. Transfers
-- (TRANSFER_IN / TRANSFER_OUT) and LOAN_PAYMENTS stay null, which is what makes
-- them skippable rather than countable.
update public.plaid_transactions
   set category_key = 'income'
 where category_key is null
   and plaid_category is not null
   and upper(plaid_category) like 'INCOME%';

commit;

-- Rows whose plaid_category is null came from Plaid's legacy category array and
-- cannot be reclassified here. They stay null and are excluded from income,
-- which under-reports rather than over-reports — the safer direction for a
-- health score. A future full re-sync (clearing plaid_connections.sync_cursor)
-- would rewrite them correctly.
