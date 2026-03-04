-- Migration 010: Auto match-status transitions via pg_cron
--
-- Three jobs:
--
-- ① kickoff-to-live  — SQL SAFETY NET: flips pre-match → live at kickoff_at
--   Fires every minute. Only activates when Goalserve feed is unavailable.
--
-- ② live-to-finished — SQL SAFETY NET: flips live → finished ~115 min after kickoff
--   Only activates as a fallback when Goalserve feed is unavailable.
--
-- ③ sync-match-status — PRIMARY: calls the sync-match-status Edge Function every minute
--   Reads Goalserve soccernew/home feed and applies accurate status (HT, FT, live
--   minute), plus live score_home / score_away from localteam/@goals & visitorteam/@goals.
--   Jobs ① and ② are safety nets for when Goalserve is down or has no match data.
--
-- Run in Supabase Dashboard → SQL Editor.
-- pg_cron + pg_net must already be enabled (done in migration 009).

-- ── Remove old jobs if re-running (idempotency) ────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kickoff-to-live') THEN
    PERFORM cron.unschedule('kickoff-to-live');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'live-to-finished') THEN
    PERFORM cron.unschedule('live-to-finished');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sync-match-status') THEN
    PERFORM cron.unschedule('sync-match-status');
  END IF;
END $$;

-- ── Job ①: pre-match → live ────────────────────────────────────────────────
-- Fires every minute. Sets status='live' when kickoff_at has passed.
-- The 4-hour back-window prevents touching stale rows if cron was paused.
SELECT cron.schedule(
  'kickoff-to-live',
  '* * * * *',
  $$
    UPDATE matches
    SET    status     = 'live',
           updated_at = now()
    WHERE  status     = 'pre-match'
      AND  kickoff_at IS NOT NULL
      AND  kickoff_at <= now()
      AND  kickoff_at >  now() - INTERVAL '4 hours';
  $$
);

-- ── Job ②: live → finished ────────────────────────────────────────────────
-- Fires every minute. Marks a match finished once kickoff_at + 115 min has passed.
--
-- 115 min breakdown:
--   45 min  first half
--   15 min  half-time break
--   45 min  second half
--   10 min  average stoppage time buffer
--   ──────
--  115 min  total threshold
--
-- Extra-time matches will be marked finished ~30-35 min late; this is acceptable
-- for MVP since NGS/EG bets lock at half-time & FT whistle via lock-bet anyway.
SELECT cron.schedule(
  'live-to-finished',
  '* * * * *',
  $$
    UPDATE matches
    SET    status     = 'finished',
           updated_at = now()
    WHERE  status     = 'live'
      AND  kickoff_at IS NOT NULL
      AND  kickoff_at < now() - INTERVAL '115 minutes';
  $$
);

-- ── Job ③: sync-match-status (PRIMARY — accurate Goalserve data) ───────────
-- Calls the sync-match-status Edge Function every minute.
-- The function reads soccernew/home?json=1 from Goalserve and updates:
--   status          (pre-match | live | halftime | finished | cancelled)
--   current_minute  (parsed from numeric @status e.g. "45", "67+2")
--   score_home      (localteam/@goals)
--   score_away      (visitorteam/@goals)
-- Status changes trigger Supabase Realtime → extension updates without reload.
-- Jobs ① and ② above serve as safety nets if Goalserve is unavailable.
SELECT cron.schedule(
  'sync-match-status',
  '* * * * *',
  $$
    SELECT net.http_post(
      url     := 'https://weryswulejhjkrmervnf.supabase.co/functions/v1/sync-match-status',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc',
        'apikey',        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc'
      ),
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $$
);

-- ── Verification queries ───────────────────────────────────────────────────
-- SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
-- SELECT jobname, start_time, status FROM cron.job_run_details
--   WHERE jobname IN ('kickoff-to-live','live-to-finished','sync-match-status')
--   ORDER BY start_time DESC LIMIT 20;
