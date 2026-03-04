-- Migration 007: Append-only odds history for post-match bet resolution
-- Every time sync-odds runs, it INSERTs (never UPDATEs) a row here.
-- This lets us look up exactly what odds were offered at any given minute
-- for auditing winning bets after the match finishes.

CREATE TABLE IF NOT EXISTS odds_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id     uuid        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id    uuid        REFERENCES players(id) ON DELETE SET NULL,
  bet_type     text        NOT NULL CHECK (bet_type IN ('NGS', 'MW', 'EG')),
  odds_value   jsonb       NOT NULL,
  -- For NGS: {"odds": 8.0}
  -- For MW:  {"home": 1.74, "draw": 4.2, "away": 5.0}
  -- For EG:  {"0": 12.0, "1": 7.5, "2": 4.5, ...}
  minute       integer,    -- match minute at time of capture (null = pre-match)
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS odds_history_match_time
  ON odds_history (match_id, recorded_at);

CREATE INDEX IF NOT EXISTS odds_history_player
  ON odds_history (player_id, recorded_at)
  WHERE player_id IS NOT NULL;

COMMENT ON TABLE odds_history IS
  'Append-only log of all odds snapshots. Used to award bets at the odds locked at time of scoring.';
