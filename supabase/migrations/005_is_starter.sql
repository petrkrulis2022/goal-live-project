-- Add is_starter column to players table
-- Marks players as starting lineup (true) vs substitutes (false)
-- Populated by admin Goalserve lineup fetch; defaults to false

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS is_starter boolean NOT NULL DEFAULT false;
