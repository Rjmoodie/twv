-- Ownership-signal correctness hardening.
--
-- Form 4/A filings supersede earlier filed facts, one Form 4 can name multiple
-- reporting owners, and a 13F position can disappear completely. Preserve each
-- of those facts explicitly instead of relying on presentation code to infer it.

alter table public.insider_transactions
  add column if not exists form text not null default '4',
  add column if not exists is_amendment boolean not null default false,
  add column if not exists actor_key text,
  add column if not exists joint_filing boolean not null default false,
  add column if not exists is_superseded boolean not null default false,
  add column if not exists superseded_by_accession text;

update public.insider_transactions
set actor_key = owner_cik
where actor_key is null or btrim(actor_key) = '';
alter table public.insider_transactions
  alter column actor_key set not null;

alter table public.insider_transactions
  drop constraint if exists insider_transactions_form_check;
alter table public.insider_transactions
  add constraint insider_transactions_form_check check (form in ('4', '4/A'));

alter table public.insider_transactions
  drop constraint if exists insider_transactions_accession_line_index_key;
create unique index if not exists insider_transactions_accession_owner_line_key
  on public.insider_transactions(accession, owner_cik, line_index);
create index if not exists insider_transactions_effective_ticker_date_idx
  on public.insider_transactions(ticker, transaction_date desc)
  where not is_superseded;

-- A filing ledger is the ingestion watermark. Transaction rows cannot serve as
-- that watermark because a valid filing may contain no usable transaction row.
create table if not exists public.insider_filings (
  accession text primary key,
  ticker text not null check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  cik text not null,
  form text not null check (form in ('4', '4/A')),
  filed_at timestamptz not null,
  filing_url text not null,
  is_amendment boolean not null default false,
  actor_key text,
  joint_filing boolean not null default false,
  period_of_report date,
  original_submission_date date,
  row_count integer not null default 0 check (row_count >= 0),
  parser_version integer not null default 1 check (parser_version > 0),
  ingested_at timestamptz not null default now()
);
create index if not exists insider_filings_ticker_filed_idx
  on public.insider_filings(ticker, filed_at desc);
alter table public.insider_filings enable row level security;
revoke all on public.insider_filings from public, anon, authenticated;
grant select, insert, update on public.insider_filings to service_role;

insert into public.insider_filings(
  accession, ticker, cik, form, filed_at, filing_url, is_amendment,
  actor_key, joint_filing, row_count, parser_version
)
select accession, min(ticker), min(cik), min(form), min(filed_at), min(filing_url),
       bool_or(is_amendment), min(actor_key), bool_or(joint_filing), count(*)::integer, 1
from public.insider_transactions
group by accession
on conflict(accession) do nothing;

create or replace function public.apply_form4_amendment(p_ticker text, p_accession text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_count integer := 0;
  original_accession text;
begin
  if p_accession is null or upper(coalesce(p_ticker, '')) = '' then
    return 0;
  end if;

  -- Prefer the amendment's structured original-submission date. If it is not
  -- present, accept a period-of-report match only when it identifies exactly one
  -- earlier original filing for the same filer group. Ambiguity fails closed.
  with amendment as (
    select *
    from public.insider_filings
    where accession = p_accession
      and ticker = upper(p_ticker)
      and is_amendment
  ), candidates as (
    select original.accession, original.filed_at
    from amendment
    join public.insider_filings original
      on original.ticker = amendment.ticker
     and original.form = '4'
     and original.actor_key = amendment.actor_key
     and original.filed_at < amendment.filed_at
     and (
       (
         amendment.original_submission_date is not null
         and original.filed_at::date = amendment.original_submission_date
       )
       or (
         amendment.original_submission_date is null
         and amendment.period_of_report is not null
         and original.period_of_report = amendment.period_of_report
       )
     )
  ), unambiguous as (
    select min(accession) accession
    from candidates
    having count(*) = 1
  )
  select accession into original_accession from unambiguous;

  -- A small number of legacy filings predate the filing ledger metadata. For
  -- those only, fall back to an exact owner-group and transaction-date match,
  -- again requiring a single candidate accession.
  if original_accession is null then
    with amendment_rows as (
      select actor_key, array_agg(distinct transaction_date order by transaction_date) dates,
             min(filed_at) filed_at
      from public.insider_transactions
      where ticker = upper(p_ticker)
        and accession = p_accession
        and is_amendment
      group by actor_key
    ), candidates as (
      select prior.accession
      from public.insider_transactions prior
      join amendment_rows amendment on amendment.actor_key = prior.actor_key
      where prior.ticker = upper(p_ticker)
        and prior.accession <> p_accession
        and not prior.is_amendment
        and prior.filed_at < amendment.filed_at
      group by prior.accession, amendment.dates
      having array_agg(distinct prior.transaction_date order by prior.transaction_date) = amendment.dates
    ), unambiguous as (
      select min(accession) accession from candidates having count(*) = 1
    )
    select accession into original_accession from unambiguous;
  end if;

  if original_accession is null then return 0; end if;

  update public.insider_transactions
     set is_superseded = true,
         superseded_by_accession = p_accession
   where accession = original_accession
     and accession <> p_accession;
  get diagnostics updated_count = row_count;

  return coalesce(updated_count, 0);
end;
$$;
revoke all on function public.apply_form4_amendment(text, text) from public, anon, authenticated;
grant execute on function public.apply_form4_amendment(text, text) to service_role;

-- p_first_accession remains the public argument name for compatibility. It is
-- the accession that triggered this evaluation; the durable dedupe accession is
-- derived from the opening purchase in the seven-day cluster.
create or replace function public.enqueue_insider_buy_alerts(p_ticker text, p_first_accession text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  cluster_end date;
  cluster_start date;
  opening_accession text;
  inserted_count integer := 0;
begin
  select max(transaction_date)
    into cluster_end
    from public.insider_transactions
   where ticker = upper(p_ticker)
     and accession = p_first_accession
     and classification = 'open_market_purchase'
     and not price_suspect
     and not is_superseded;

  if cluster_end is null then return 0; end if;
  cluster_start := cluster_end - 6;

  if (
    select count(distinct actor_key)
    from public.insider_transactions
    where ticker = upper(p_ticker)
      and classification = 'open_market_purchase'
      and not price_suspect
      and not is_superseded
      and transaction_date between cluster_start and cluster_end
  ) < 2 then
    return 0;
  end if;

  -- Include superseded rows only while choosing the stable opening accession.
  -- That keeps an amendment from making the same cluster look new; payload facts
  -- below still come exclusively from effective rows.
  select accession into opening_accession
  from public.insider_transactions
  where ticker = upper(p_ticker)
    and classification = 'open_market_purchase'
    and not price_suspect
    and transaction_date between cluster_start and cluster_end
  order by transaction_date, filed_at, accession
  limit 1;

  with cluster as (
    select actor_key,
           string_agg(distinct owner_name, ' & ' order by owner_name) owner_name,
           string_agg(distinct officer_title, ' & ' order by officer_title)
             filter(where officer_title is not null) officer_title,
           transaction_date, shares, price_per_share, accession, filing_url,
           plan_10b5_1, joint_filing
    from public.insider_transactions
    where ticker = upper(p_ticker)
      and classification = 'open_market_purchase'
      and not price_suspect
      and not is_superseded
      and transaction_date between cluster_start and cluster_end
    group by accession, line_index, actor_key, transaction_date, shares,
             price_per_share, filing_url, plan_10b5_1, joint_filing
  ), inserted as (
    insert into public.notification_outbox(user_id, event_type, payload, channels, dedupe_key)
    select w.user_id,
           'watchlist_insider_buy',
           jsonb_build_object(
             'ticker', upper(p_ticker),
             'insider_count', count(distinct cluster.actor_key),
             'transactions', jsonb_agg(to_jsonb(cluster) order by cluster.transaction_date, cluster.owner_name),
             'first_accession', opening_accession
           ),
           array['in_app', 'push']::text[],
           'watchlist_insider:' || w.id || ':' || opening_accession
    from public.watchlist w
    cross join cluster
    where w.ticker = upper(p_ticker)
    group by w.id, w.user_id
    on conflict(dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return coalesce(inserted_count, 0);
end;
$$;
revoke all on function public.enqueue_insider_buy_alerts(text, text) from public, anon, authenticated;
grant execute on function public.enqueue_insider_buy_alerts(text, text) to service_role;

-- Complete exits are prior-only rows. A left join starting from current holdings
-- cannot represent them, so compare the two effective manager periods with a
-- full join and use the current filing as the provenance for an exit.
create or replace function public.institutional_signal_for_ticker(p_ticker text)
returns table(
  manager_name text, manager_cik text, report_period date, filed_at timestamptz,
  issuer_name text, cusip text, value_usd numeric, shares numeric,
  previous_shares numeric, share_change numeric, change_direction text,
  match_method text, filing_url text
)
language sql
security definer
set search_path = ''
stable
as $$
  with filing_choice as (
    select f.*,
      bool_or(f.amendment_kind = 'restatement')
        over(partition by f.manager_cik, f.report_period) has_restatement,
      row_number() over(
        partition by f.manager_cik, f.report_period, f.amendment_kind
        order by f.filed_at desc, f.accession desc
      ) kind_rank
    from public.institutional_13f_filings f
  ), effective_filings as (
    select * from filing_choice
    where (amendment_kind = 'restatement' and kind_rank = 1)
       or (amendment_kind = 'original' and not has_restatement and kind_rank = 1)
       or amendment_kind = 'additional_holdings'
  ), manager_periods as (
    select manager_cik, report_period,
           dense_rank() over(partition by manager_cik order by report_period desc) period_rank
    from (select distinct manager_cik, report_period from effective_filings) periods
  ), period_provenance as (
    select f.manager_cik, f.report_period, max(f.filed_at) filed_at,
           (array_agg(f.filing_url order by f.filed_at desc, f.accession desc))[1] filing_url
    from effective_filings f
    group by f.manager_cik, f.report_period
  ), raw_mapped as (
    select h.*, m.ticker, m.match_method, f.filed_at, f.filing_url, p.period_rank
    from public.institutional_13f_holdings h
    join effective_filings f on f.accession = h.accession
    join manager_periods p on p.manager_cik = h.manager_cik and p.report_period = h.report_period
    join public.institutional_security_map m using(cusip)
    where m.ticker = upper(p_ticker)
      and h.put_call is null
      and h.shares_or_principal_type = 'SH'
  ), mapped as (
    select manager_cik, report_period, period_rank, min(issuer_name) issuer_name,
           cusip, min(match_method) match_method, max(filed_at) filed_at,
           (array_agg(filing_url order by filed_at desc, accession desc))[1] filing_url,
           sum(value_usd) value_usd, sum(shares_or_principal) shares_or_principal
    from raw_mapped
    group by manager_cik, report_period, period_rank, cusip
  ), current_rows as (
    select * from mapped where period_rank = 1
  ), prior_rows as (
    select * from mapped where period_rank = 2
  ), positions as (
    select coalesce(current_rows.manager_cik, prior_rows.manager_cik) manager_cik,
           current_rows.issuer_name current_issuer_name,
           prior_rows.issuer_name prior_issuer_name,
           coalesce(current_rows.cusip, prior_rows.cusip) cusip,
           current_rows.value_usd current_value,
           current_rows.shares_or_principal current_shares,
           prior_rows.shares_or_principal previous_shares,
           coalesce(current_rows.match_method, prior_rows.match_method) match_method,
           current_rows.filed_at current_filed_at,
           current_rows.filing_url current_filing_url
    from current_rows
    full join prior_rows
      on prior_rows.manager_cik = current_rows.manager_cik
     and prior_rows.cusip = current_rows.cusip
  )
  select managers.display_name,
         positions.manager_cik,
         current_period.report_period,
         coalesce(positions.current_filed_at, provenance.filed_at),
         coalesce(positions.current_issuer_name, positions.prior_issuer_name),
         positions.cusip,
         coalesce(positions.current_value, 0::numeric),
         coalesce(positions.current_shares, 0::numeric),
         positions.previous_shares,
         coalesce(positions.current_shares, 0::numeric) - coalesce(positions.previous_shares, 0::numeric),
         case
           when positions.current_shares is null and positions.previous_shares is not null then 'exited'
           when positions.previous_shares is null then 'new'
           when positions.current_shares > positions.previous_shares then 'increased'
           when positions.current_shares < positions.previous_shares then 'decreased'
           else 'unchanged'
         end,
         positions.match_method,
         coalesce(positions.current_filing_url, provenance.filing_url)
  from positions
  join public.institutional_managers managers on managers.cik = positions.manager_cik
  join manager_periods current_period
    on current_period.manager_cik = positions.manager_cik
   and current_period.period_rank = 1
  left join period_provenance provenance
    on provenance.manager_cik = current_period.manager_cik
   and provenance.report_period = current_period.report_period
  order by coalesce(positions.current_value, 0) desc, managers.display_name;
$$;
revoke all on function public.institutional_signal_for_ticker(text) from public, anon;
grant execute on function public.institutional_signal_for_ticker(text) to authenticated, service_role;

insert into public.notification_channel_policies(
  event_type, importance, push_mode, email_mode, email_variant,
  email_preference_key, description
)
values (
  'insider_weekly_digest', 'activity', 'none', 'on_request', 'marketing',
  'digest_enabled',
  'Opt-in weekly SEC Form 4 activity for companies on the user watchlist or in a portfolio.'
)
on conflict(event_type) do update set
  importance = excluded.importance,
  push_mode = excluded.push_mode,
  email_mode = excluded.email_mode,
  email_variant = excluded.email_variant,
  email_preference_key = excluded.email_preference_key,
  description = excluded.description,
  updated_at = now();

create or replace function public.enqueue_weekly_insider_digests(p_week_start date default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_week_start date := date_trunc('week', now() at time zone 'UTC')::date;
  week_start date := coalesce(p_week_start, date_trunc('week', now() at time zone 'UTC')::date - 7);
  week_end date;
  inserted_count integer := 0;
begin
  week_end := week_start + 7;
  if extract(isodow from week_start) <> 1 then
    raise exception 'week_start must be a Monday';
  end if;
  if week_start >= current_week_start then
    raise exception 'week_start must identify a completed UTC week';
  end if;

  with tracked as (
    select w.user_id, upper(w.ticker) ticker
    from public.watchlist w
    union
    select p.user_id, upper(h.ticker)
    from public.portfolios p
    join public.portfolio_holdings h on h.portfolio_id = p.id
    where h.ticker is not null
    union
    select b.user_id, upper(b.symbol)
    from public.brokerage_positions b
    where b.symbol is not null
  ), effective_transactions as (
    select ticker, accession, actor_key, joint_filing,
           string_agg(distinct owner_name, ' & ' order by owner_name) owner_name,
           string_agg(distinct officer_title, ' & ' order by officer_title)
             filter(where officer_title is not null) officer_title,
           classification, transaction_date, filed_at, shares, price_per_share,
           shares_owned_after, plan_10b5_1, bool_or(is_officer) is_officer,
           filing_url
    from public.insider_transactions
    where filed_at >= week_start::timestamp at time zone 'UTC'
      and filed_at < week_end::timestamp at time zone 'UTC'
      and not price_suspect
      and not is_superseded
    group by ticker, accession, line_index, actor_key, joint_filing,
             classification, transaction_date, filed_at, shares,
             price_per_share, shares_owned_after, plan_10b5_1, filing_url
  ), eligible as (
    select tracked.user_id, transactions.*,
      (
        transactions.classification = 'open_market_sale'
        and not transactions.plan_10b5_1
        and transactions.is_officer
        and transactions.shares_owned_after is not null
        and transactions.shares + transactions.shares_owned_after > 0
        and transactions.shares / (transactions.shares + transactions.shares_owned_after) >= 0.10
      ) as flagged_sale,
      case
        when transactions.classification = 'open_market_purchase' then 0
        when transactions.classification = 'open_market_sale'
          and not transactions.plan_10b5_1
          and transactions.is_officer
          and transactions.shares_owned_after is not null
          and transactions.shares + transactions.shares_owned_after > 0
          and transactions.shares / (transactions.shares + transactions.shares_owned_after) >= 0.10 then 1
        else 2
      end as editorial_priority
    from tracked
    join public.user_email_preferences preferences
      on preferences.user_id = tracked.user_id
     and preferences.digest_enabled
     and not preferences.unsubscribed
    join effective_transactions transactions on transactions.ticker = tracked.ticker
  ), ranked as (
    select eligible.*,
           row_number() over(
             partition by user_id
             order by editorial_priority, filed_at desc, ticker, owner_name
           ) item_rank,
           count(*) over(partition by user_id) total_count
    from eligible
  ), summaries as (
    select user_id,
           max(total_count)::integer transaction_count,
           count(distinct ticker)::integer ticker_count,
           jsonb_agg(
             jsonb_build_object(
               'ticker', ticker,
               'owner_name', owner_name,
               'officer_title', officer_title,
               'classification', classification,
               'transaction_date', transaction_date,
               'filed_at', filed_at,
               'shares', shares,
               'price_per_share', price_per_share,
               'shares_owned_after', shares_owned_after,
               'plan_10b5_1', plan_10b5_1,
               'flagged_sale', flagged_sale,
               'filing_url', filing_url
             ) order by editorial_priority, filed_at desc, ticker, owner_name
           ) filter(where item_rank <= 50) transactions
    from ranked
    group by user_id
  ), inserted as (
    insert into public.notification_outbox(user_id, event_type, payload, channels, dedupe_key)
    select summaries.user_id,
           'insider_weekly_digest',
           jsonb_build_object(
             'week_start', week_start,
             'week_end', week_end - 1,
             'transaction_count', summaries.transaction_count,
             'ticker_count', summaries.ticker_count,
             'truncated', summaries.transaction_count > 50,
             'transactions', summaries.transactions
           ),
           array['email']::text[],
           'insider_weekly_digest:' || summaries.user_id || ':' || week_start
    from summaries
    on conflict(dedupe_key) where dedupe_key is not null do nothing
    returning 1
  )
  select count(*) into inserted_count from inserted;

  return coalesce(inserted_count, 0);
end;
$$;
revoke all on function public.enqueue_weekly_insider_digests(date) from public, anon, authenticated;
grant execute on function public.enqueue_weekly_insider_digests(date) to service_role;

create or replace function public.build_insider_digest_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  functions_url text;
  dispatch_secret text;
  api_key text;
begin
  select decrypted_secret into functions_url
  from vault.decrypted_secrets where name = 'supabase_functions_url';
  select decrypted_secret into dispatch_secret
  from vault.decrypted_secrets where name = 'notification_dispatch_secret';
  select decrypted_secret into api_key
  from vault.decrypted_secrets where name = 'supabase_anon_key';
  if functions_url is null or dispatch_secret is null or api_key is null then return; end if;

  perform net.http_post(
    url := functions_url || '/build-insider-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', api_key,
      'Authorization', 'Bearer ' || api_key,
      'x-dispatch-secret', dispatch_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.build_insider_digest_tick() from public, anon, authenticated;

do $$ begin
  perform cron.unschedule('build-insider-digest');
exception when others then null;
end $$;
select cron.schedule(
  'build-insider-digest',
  '5 13 * * 1',
  $$select public.build_insider_digest_tick()$$
);
