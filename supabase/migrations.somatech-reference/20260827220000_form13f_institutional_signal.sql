-- Form 13F is delayed quarterly institutional disclosure, not an insider trade.
-- Keep its identity, provenance and semantics separate from Form 4.
create table if not exists public.institutional_managers (
  cik text primary key check (cik ~ '^\d{10}$'),
  name text not null,
  display_name text not null,
  active boolean not null default true,
  last_checked_at timestamptz not null default 'epoch',
  last_error text,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.institutional_managers enable row level security;
revoke all on public.institutional_managers from public, anon, authenticated;
grant select, insert, update on public.institutional_managers to service_role;

insert into public.institutional_managers(cik,name,display_name) values
  ('0001067983','Berkshire Hathaway Inc','Berkshire Hathaway'),
  ('0001649339','Scion Asset Management, LLC','Scion Asset Management'),
  ('0001336528','Pershing Square Capital Management, L.P.','Pershing Square'),
  ('0001350694','Bridgewater Associates, LP','Bridgewater Associates'),
  ('0001037389','Renaissance Technologies LLC','Renaissance Technologies')
on conflict (cik) do update set display_name=excluded.display_name, active=true, updated_at=now();

create table if not exists public.institutional_13f_filings (
  accession text primary key,
  manager_cik text not null references public.institutional_managers(cik),
  form text not null check (form in ('13F-HR','13F-HR/A')),
  report_period date not null,
  filed_at timestamptz not null,
  filing_url text not null,
  information_table_url text not null,
  holding_count integer not null default 0,
  total_value_usd numeric not null default 0,
  is_amendment boolean not null default false,
  amendment_kind text not null default 'original' check (amendment_kind in ('original','restatement','additional_holdings','unknown')),
  ingested_at timestamptz not null default now()
);
create index if not exists institutional_13f_filings_manager_period_idx on public.institutional_13f_filings(manager_cik,report_period desc,filed_at desc);
alter table public.institutional_13f_filings enable row level security;
revoke all on public.institutional_13f_filings from public, anon, authenticated;
grant select, insert, update on public.institutional_13f_filings to service_role;

create table if not exists public.institutional_13f_holdings (
  id bigint generated always as identity primary key,
  accession text not null references public.institutional_13f_filings(accession) on delete cascade,
  line_index integer not null check (line_index >= 0),
  manager_cik text not null references public.institutional_managers(cik),
  report_period date not null,
  issuer_name text not null,
  title_of_class text not null,
  cusip text not null check (cusip ~ '^[A-Z0-9]{8,9}$'),
  figi text,
  value_usd numeric not null check (value_usd >= 0),
  shares_or_principal numeric not null check (shares_or_principal >= 0),
  shares_or_principal_type text not null,
  put_call text check (put_call in ('PUT','CALL')),
  investment_discretion text,
  voting_sole numeric not null default 0,
  voting_shared numeric not null default 0,
  voting_none numeric not null default 0,
  unique(accession,line_index)
);
create index if not exists institutional_13f_holdings_cusip_period_idx on public.institutional_13f_holdings(cusip,report_period desc);
create index if not exists institutional_13f_holdings_manager_period_idx on public.institutional_13f_holdings(manager_cik,report_period desc);
alter table public.institutional_13f_holdings enable row level security;
revoke all on public.institutional_13f_holdings from public, anon, authenticated;
grant select, insert, update on public.institutional_13f_holdings to service_role;
grant usage, select on sequence public.institutional_13f_holdings_id_seq to service_role;

create table if not exists public.institutional_security_map (
  cusip text primary key check (cusip ~ '^[A-Z0-9]{8,9}$'),
  ticker text not null check (ticker=upper(ticker) and ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  match_method text not null check (match_method in ('manual','issuer_name_exact')),
  issuer_name text not null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists institutional_security_map_ticker_idx on public.institutional_security_map(ticker);
alter table public.institutional_security_map enable row level security;
revoke all on public.institutional_security_map from public, anon, authenticated;
grant select, insert, update on public.institutional_security_map to service_role;

create or replace function public.normalize_security_issuer(value text) returns text
language sql immutable set search_path='' as $$
  select trim(regexp_replace(regexp_replace(upper(coalesce(value,'')), '\m(INCORPORATED|INC|CORPORATION|CORP|COMPANY|CO|LIMITED|LTD|PLC|HOLDINGS?|GROUP|THE)\M', '', 'g'), '[^A-Z0-9]+', ' ', 'g'));
$$;

create or replace function public.refresh_institutional_security_map() returns integer
language plpgsql security definer set search_path='' as $$
declare inserted_count integer;
begin
  with issuer_names as (
    select cusip,min(issuer_name) issuer_name,public.normalize_security_issuer(min(issuer_name)) normalized
    from public.institutional_13f_holdings where put_call is null group by cusip
  ), company_names as (
    select ticker,company_name,public.normalize_security_issuer(company_name) normalized,
           count(*) over(partition by public.normalize_security_issuer(company_name)) matches
    from public.stock_analysis_cache
  ), inserted as (
    insert into public.institutional_security_map(cusip,ticker,match_method,issuer_name)
    select i.cusip,c.ticker,'issuer_name_exact',i.issuer_name from issuer_names i join company_names c using(normalized)
    where i.normalized<>'' and c.matches=1
    on conflict(cusip) do nothing returning 1
  ) select count(*) into inserted_count from inserted;
  return coalesce(inserted_count,0);
end; $$;
revoke all on function public.refresh_institutional_security_map() from public,anon,authenticated;
grant execute on function public.refresh_institutional_security_map() to service_role;

create or replace function public.institutional_signal_for_ticker(p_ticker text)
returns table(manager_name text,manager_cik text,report_period date,filed_at timestamptz,issuer_name text,cusip text,
  value_usd numeric,shares numeric,previous_shares numeric,share_change numeric,change_direction text,match_method text,filing_url text)
language sql security definer set search_path='' stable as $$
  with filing_choice as (
    select f.*,
      max(case when f.amendment_kind='restatement' then f.filed_at end) over(partition by f.manager_cik,f.report_period) latest_restatement,
      max(case when f.amendment_kind='original' then f.filed_at end) over(partition by f.manager_cik,f.report_period) latest_original
    from public.institutional_13f_filings f
  ), effective_filings as (
    select * from filing_choice where
      (latest_restatement is not null and amendment_kind='restatement' and filed_at=latest_restatement)
      or (latest_restatement is null and (
        (amendment_kind='original' and filed_at=latest_original) or amendment_kind='additional_holdings'
      ))
  ), manager_periods as (
    select manager_cik,report_period,dense_rank() over(partition by manager_cik order by report_period desc) period_rank
    from (select distinct manager_cik,report_period from effective_filings) periods
  ), raw_mapped as (
    select h.*,m.ticker,m.match_method,f.filed_at,f.filing_url,p.period_rank
    from public.institutional_13f_holdings h
    join effective_filings f on f.accession=h.accession
    join manager_periods p on p.manager_cik=h.manager_cik and p.report_period=h.report_period
    join public.institutional_security_map m using(cusip)
    where m.ticker=upper(p_ticker) and h.put_call is null and h.shares_or_principal_type='SH'
  ), mapped as (
    select manager_cik,report_period,period_rank,min(issuer_name) issuer_name,cusip,min(ticker) ticker,min(match_method) match_method,
      max(filed_at) filed_at,max(filing_url) filing_url,sum(value_usd) value_usd,sum(shares_or_principal) shares_or_principal
    from raw_mapped group by manager_cik,report_period,period_rank,cusip
  ), current_rows as (select * from mapped where period_rank=1), prior_rows as (select * from mapped where period_rank=2)
  select im.display_name,c.manager_cik,c.report_period,c.filed_at,c.issuer_name,c.cusip,c.value_usd,
    c.shares_or_principal,p.shares_or_principal,c.shares_or_principal-coalesce(p.shares_or_principal,0),
    case when p.shares_or_principal is null then 'new' when c.shares_or_principal>p.shares_or_principal then 'increased'
         when c.shares_or_principal<p.shares_or_principal then 'decreased' else 'unchanged' end,
    c.match_method,c.filing_url
  from current_rows c left join prior_rows p on p.manager_cik=c.manager_cik and p.cusip=c.cusip
  join public.institutional_managers im on im.cik=c.manager_cik order by c.value_usd desc;
$$;
revoke all on function public.institutional_signal_for_ticker(text) from public,anon;
grant execute on function public.institutional_signal_for_ticker(text) to authenticated,service_role;

create or replace function public.institutional_13f_poll_targets(batch_size integer default 5)
returns table(cik text,display_name text,last_checked_at timestamptz)
language sql security definer set search_path='' as $$
  select im.cik,im.display_name,im.last_checked_at from public.institutional_managers im where im.active order by im.last_checked_at
  limit least(greatest(batch_size,1),25);
$$;
revoke all on function public.institutional_13f_poll_targets(integer) from public,anon,authenticated;
grant execute on function public.institutional_13f_poll_targets(integer) to service_role;

create or replace function public.poll_institutional_13f_tick() returns void language plpgsql security definer set search_path='' as $$
declare functions_url text; dispatch_secret text; api_key text;
begin
  select decrypted_secret into functions_url from vault.decrypted_secrets where name='supabase_functions_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name='notification_dispatch_secret';
  select decrypted_secret into api_key from vault.decrypted_secrets where name='supabase_anon_key';
  if functions_url is null or dispatch_secret is null or api_key is null then return; end if;
  perform net.http_post(url:=functions_url||'/poll-institutional-13f',headers:=jsonb_build_object('Content-Type','application/json','apikey',api_key,'Authorization','Bearer '||api_key,'x-dispatch-secret',dispatch_secret),body:='{"batch_size":5}'::jsonb);
end; $$;
revoke all on function public.poll_institutional_13f_tick() from public,anon,authenticated;
do $$ begin perform cron.unschedule('poll-institutional-13f'); exception when others then null; end $$;
select cron.schedule('poll-institutional-13f','17 */6 * * *',$$select public.poll_institutional_13f_tick()$$);
