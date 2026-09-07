begin;

-- A bare text[] of URLs cannot carry the caption that gives a photo its meaning
-- ("Facade Before", "12 Ft Rear Exterior After"). Move to an ordered array of
-- objects so a case study can tell a before/after story.
create or replace function private.portfolio_gallery_is_valid(gallery jsonb)
returns boolean language sql immutable as $$
  select jsonb_typeof(gallery) = 'array'
    and jsonb_array_length(gallery) <= 24
    and not exists (
      select 1 from jsonb_array_elements(gallery) as item
      where jsonb_typeof(item) <> 'object'
        or item->>'url' is null
        or length(item->>'url') > 2048
        or length(coalesce(item->>'caption', '')) > 160
        or length(coalesce(item->>'alt', '')) > 300
    );
$$;

alter table public.pm_portfolio_entries
  add column gallery jsonb not null default '[]'::jsonb,
  add column latitude double precision,
  add column longitude double precision;

update public.pm_portfolio_entries
set gallery = coalesce(
  (select jsonb_agg(jsonb_build_object('url', url, 'caption', null, 'alt', null))
   from unnest(gallery_urls) as url),
  '[]'::jsonb)
where cardinality(gallery_urls) > 0;

alter table public.pm_portfolio_entries drop column gallery_urls;

alter table public.pm_portfolio_entries
  add constraint pm_portfolio_entries_gallery_valid check (private.portfolio_gallery_is_valid(gallery)),
  add constraint pm_portfolio_entries_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint pm_portfolio_entries_longitude_range check (longitude is null or longitude between -180 and 180),
  add constraint pm_portfolio_entries_coordinates_paired check ((latitude is null) = (longitude is null));

-- The public project map reads only published entries that have been geocoded.
create index pm_portfolio_entries_geo_idx on public.pm_portfolio_entries (latitude, longitude)
  where status = 'published' and latitude is not null;

commit;
