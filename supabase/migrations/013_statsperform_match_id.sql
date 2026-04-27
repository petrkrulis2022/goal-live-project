-- Migration 013: Add StatsPerform match ID support
-- Adds statsperform_match_id to matches table for the StatsPerform feed integration.
-- goalserve_static_id is kept as nullable for backward compatibility.

ALTER TABLE matches ADD COLUMN IF NOT EXISTS statsperform_match_id text;
CREATE INDEX IF NOT EXISTS matches_statsperform_match_id_idx ON matches(statsperform_match_id);
