-- ── Migration 011: NEXT_CORNER bet type + corner tracking columns ─────────────
-- Adds the NEXT_CORNER bet type to the enum and three columns to the matches
-- table so sync-match-status can track corner counts and settle corner bets live.
--
-- Corner bets semantics:
--   bet.current_player_id  = target corner number (e.g. "7" = bet on who gets corner #7)
--   bet.outcome            = 'home' | 'away'  (which team the bettor thinks will score it)
--
-- sync-match-status compares corners_home + corners_away vs the new Goalserve read.
-- When the total increases it determines which team scored the corner and settles all
-- active NEXT_CORNER bets whose current_player_id matches that corner number.
-- Any NEXT_CORNER bets still active at FT are settled_lost by settle-match.

ALTER TYPE bet_type ADD VALUE IF NOT EXISTS 'NEXT_CORNER';

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS corners_home          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corners_away          integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS corners_last_settled  integer NOT NULL DEFAULT 0;
