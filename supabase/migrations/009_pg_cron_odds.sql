-- Migration 009: pg_cron + pg_net — server-side live odds polling
--
-- Fires sync-odds edge function every 60 s for every live match.
-- Works 24/7 regardless of whether anyone has the extension open.
-- Supabase Realtime then pushes updated odds_home/draw/away/exact_goals_odds
-- to the extension immediately via the existing matches channel.
--
-- Run this in Supabase SQL editor (Dashboard → SQL Editor → Run).
-- pg_cron and pg_net are pre-installed in Supabase; just need enabling.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove old job if re-running this migration
SELECT cron.unschedule('sync-live-odds') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-live-odds'
);

-- Schedule: every minute, one HTTP POST per live match
SELECT cron.schedule(
  'sync-live-odds',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://weryswulejhjkrmervnf.supabase.co/functions/v1/sync-odds',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc',
        'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc'
      ),
      body    := jsonb_build_object('match_id', id)
    )
    FROM matches
    WHERE status = 'live';
  $$
);

-- Verify:
-- SELECT * FROM cron.job;
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
