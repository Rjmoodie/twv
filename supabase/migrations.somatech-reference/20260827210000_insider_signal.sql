-- SEC Form 4 transactions: public-record reads, service-only ingestion.
create table if not exists public.insider_transactions (
  id bigint generated always as identity primary key,
  ticker text not null check (ticker = upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  cik text not null,
  accession text not null,
  line_index integer not null check (line_index >= 0),
  owner_cik text not null,
  owner_name text not null,
  officer_title text,
  is_officer boolean not null default false,
  is_director boolean not null default false,
  is_ten_percent_owner boolean not null default false,
  transaction_date date not null,
  transaction_code text not null,
  classification text not null check (classification in ('open_market_purchase','open_market_sale','grant','option_exercise','tax_withholding','gift','other')),
  acquired_disposed text check (acquired_disposed in ('A','D')),
  shares numeric not null check (shares >= 0),
  price_per_share numeric,
  shares_owned_after numeric,
  filed_at timestamptz not null,
  filing_url text not null,
  plan_10b5_1 boolean not null default false,
  price_suspect boolean not null default false,
  created_at timestamptz not null default now(),
  unique (accession, line_index)
);
create index if not exists insider_transactions_ticker_date_idx on public.insider_transactions(ticker, transaction_date desc);
create index if not exists insider_transactions_owner_date_idx on public.insider_transactions(owner_cik, transaction_date desc);
alter table public.insider_transactions enable row level security;
drop policy if exists "Authenticated users read insider transactions" on public.insider_transactions;
create policy "Authenticated users read insider transactions" on public.insider_transactions for select to authenticated using (true);
revoke all on public.insider_transactions from anon, authenticated;
grant select on public.insider_transactions to authenticated;
grant select, insert, update on public.insider_transactions to service_role;
grant usage, select on sequence public.insider_transactions_id_seq to service_role;

create table if not exists public.insider_poll_state (
  ticker text primary key,
  alerts_from timestamptz,
  last_checked_at timestamptz not null default 'epoch',
  last_error text,
  consecutive_failures integer not null default 0
);
alter table public.insider_poll_state enable row level security;
revoke all on public.insider_poll_state from public, anon, authenticated;

create or replace function public.insider_poll_targets(batch_size integer default 10)
returns table (ticker text, cik text, alerts_from timestamptz)
language sql security definer set search_path = '' as $$
  select w.ticker, c.cik, s.alerts_from
  from (select distinct ticker from public.watchlist) w
  join public.stock_analysis_cache c using (ticker)
  left join public.insider_poll_state s using (ticker)
  where c.cik is not null
  order by coalesce(s.last_checked_at, 'epoch'::timestamptz)
  limit least(greatest(batch_size, 1), 50);
$$;
revoke all on function public.insider_poll_targets(integer) from public, anon, authenticated;
grant execute on function public.insider_poll_targets(integer) to service_role;

create table if not exists public.push_rate_limit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rate_limit_key text not null,
  consumed_at timestamptz not null default now()
);
create index if not exists push_rate_limit_log_lookup_idx on public.push_rate_limit_log(user_id, rate_limit_key, consumed_at desc);
alter table public.push_rate_limit_log enable row level security;
revoke all on public.push_rate_limit_log from public, anon, authenticated;
grant insert, select on public.push_rate_limit_log to service_role;
grant usage, select on sequence public.push_rate_limit_log_id_seq to service_role;

create or replace function public.consume_push_rate_slot(p_user_id uuid, p_key text, p_window_minutes integer, p_max integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or p_window_minutes is null or p_max is null or p_window_minutes < 1 or p_max < 1 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_key, 0));
  if (select count(*) from public.push_rate_limit_log where user_id = p_user_id and rate_limit_key = p_key
      and consumed_at >= now() - make_interval(mins => p_window_minutes)) >= p_max then return false; end if;
  insert into public.push_rate_limit_log(user_id, rate_limit_key) values (p_user_id, p_key);
  return true;
end; $$;
revoke all on function public.consume_push_rate_slot(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_push_rate_slot(uuid,text,integer,integer) to service_role;

alter table public.notification_outbox drop constraint if exists notification_outbox_status_check;
alter table public.notification_outbox add constraint notification_outbox_status_check
  check (status in ('pending','processing','delivered','partial','failed','suppressed','dead_letter','deferred_digest'));

insert into public.notification_channel_policies
  (event_type, importance, push_mode, email_mode, email_variant, email_preference_key, rate_limit_key, rate_window_minutes, max_pushes_per_window, description)
values ('watchlist_insider_buy', 'time_sensitive', 'rate_limited', 'none', 'transactional', 'updates_enabled', 'insider-activity', 1440, 2,
  'Clustered open-market insider purchases. Push and in-app; sales never interrupt.')
on conflict (event_type) do update set push_mode=excluded.push_mode, email_mode=excluded.email_mode,
  rate_limit_key=excluded.rate_limit_key, rate_window_minutes=excluded.rate_window_minutes,
  max_pushes_per_window=excluded.max_pushes_per_window, description=excluded.description, updated_at=now();

create or replace function public.enqueue_insider_buy_alerts(p_ticker text, p_first_accession text)
returns integer language plpgsql security definer set search_path = '' as $$
declare inserted_count integer;
begin
  with cluster as (
    select owner_cik, owner_name, transaction_date, shares, price_per_share, accession, filing_url
    from public.insider_transactions
    where ticker=p_ticker and classification='open_market_purchase' and not price_suspect
      and transaction_date >= current_date - 7
  ), qualified as (select * from cluster where (select count(distinct owner_cik) from cluster) >= 2), inserted as (
    insert into public.notification_outbox(user_id,event_type,payload,channels,dedupe_key)
    select w.user_id, 'watchlist_insider_buy', jsonb_build_object(
      'ticker', p_ticker, 'insider_count', count(distinct q.owner_cik), 'transactions', jsonb_agg(to_jsonb(q)),
      'first_accession', p_first_accession), array['in_app','push']::text[],
      'watchlist_insider:' || w.id || ':' || p_first_accession
    from public.watchlist w cross join qualified q where w.ticker=p_ticker group by w.id,w.user_id
    on conflict (dedupe_key) where dedupe_key is not null do nothing returning 1
  ) select count(*) into inserted_count from inserted;
  return coalesce(inserted_count,0);
end; $$;
revoke all on function public.enqueue_insider_buy_alerts(text,text) from public, anon, authenticated;
grant execute on function public.enqueue_insider_buy_alerts(text,text) to service_role;

create or replace function public.poll_insider_filings_tick() returns void language plpgsql security definer set search_path='' as $$
declare functions_url text; dispatch_secret text; api_key text;
begin
  select decrypted_secret into functions_url from vault.decrypted_secrets where name='supabase_functions_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name='notification_dispatch_secret';
  select decrypted_secret into api_key from vault.decrypted_secrets where name='supabase_anon_key';
  if functions_url is null or dispatch_secret is null or api_key is null then return; end if;
  perform net.http_post(url:=functions_url||'/poll-insider-filings', headers:=jsonb_build_object('Content-Type','application/json','apikey',api_key,'Authorization','Bearer '||api_key,'x-dispatch-secret',dispatch_secret), body:='{"batch_size":10}'::jsonb);
end; $$;
revoke all on function public.poll_insider_filings_tick() from public, anon, authenticated;
do $$ begin perform cron.unschedule('poll-insider-filings'); exception when others then null; end $$;
select cron.schedule('poll-insider-filings','*/15 * * * *',$$select public.poll_insider_filings_tick()$$);
