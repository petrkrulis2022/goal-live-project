-- Migration 008: Dedicated live-odds columns on matches
-- These are written by sync-odds on every pg_cron tick (every 60s during live matches).
-- Having dedicated columns (not buried in odds_api_config JSONB) means:
--   1. Supabase Realtime payload.new carries them directly → no extra DB query needed
--   2. Queries can filter/index on them

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS odds_home        numeric(10, 4),
  ADD COLUMN IF NOT EXISTS odds_draw        numeric(10, 4),
  ADD COLUMN IF NOT EXISTS odds_away        numeric(10, 4),
  ADD COLUMN IF NOT EXISTS exact_goals_odds jsonb;

COMMENT ON COLUMN matches.odds_home  IS 'Latest H2H home-win decimal odds (The Odds API h2h market)';
COMMENT ON COLUMN matches.odds_draw  IS 'Latest H2H draw decimal odds';
COMMENT ON COLUMN matches.odds_away  IS 'Latest H2H away-win decimal odds';
COMMENT ON COLUMN matches.exact_goals_odds IS
  'Latest exact-goals odds map derived from totals market. Format: {"0":12.0,"1":7.5,"2":4.5,"3":5.5,"4":9.0,"5":15.0}';
