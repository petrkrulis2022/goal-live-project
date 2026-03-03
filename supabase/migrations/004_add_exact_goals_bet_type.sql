-- ── Migration 004: Add EXACT_GOALS to bet_type enum ─────────────────────────
-- The contract (GoalLiveBetting.sol) has BetType.EXACT_GOALS and the frontend
-- supports it, but the Postgres enum was missing this value. Adding it here.

ALTER TYPE bet_type ADD VALUE IF NOT EXISTS 'EXACT_GOALS';
