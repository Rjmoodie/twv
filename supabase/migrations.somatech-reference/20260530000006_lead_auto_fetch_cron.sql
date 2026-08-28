-- Scheduled auto-fetch for real estate leads
-- Runs daily at 3am UTC via pg_cron (available on Supabase Pro).
-- Calls fetch-real-estate-leads then enrich-real-estate-leads back-to-back.
--
-- Requires:
--   FETCH_TRIGGER_SECRET set in Supabase Edge Function secrets
--   pg_cron extension enabled (Dashboard → Database → Extensions)

-- Enable pg_cron if not already on
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Daily fetch at 3:00 AM UTC
SELECT cron.schedule(
  'real-estate-daily-fetch',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/fetch-real-estate-leads',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || current_setting('app.fetch_trigger_secret')
      ),
      body    := '{"sources":["chicago_violations","nyc_hpd","sf_violations","la_violations","austin_violations","seattle_violations","hud_reo","philly_violations","boston_violations"]}'::jsonb
    );
  $$
);

-- Enrichment 30 minutes after fetch at 3:30 AM UTC
SELECT cron.schedule(
  'real-estate-daily-enrich',
  '30 3 * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/enrich-real-estate-leads',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || current_setting('app.fetch_trigger_secret')
      ),
      body    := '{"sources":["nyc_hpd","philly_violations","chicago_violations","sf_violations","boston_violations"]}'::jsonb
    );
  $$
);

-- Geocoding 60 minutes after fetch at 4:00 AM UTC (after enrich fills owner data)
SELECT cron.schedule(
  'real-estate-daily-geocode',
  '0 4 * * *',
  $$
    SELECT net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/geocode-real-estate-leads',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || current_setting('app.fetch_trigger_secret')
      ),
      body    := '{"sources":["la_violations","hud_reo"]}'::jsonb
    );
  $$
);
