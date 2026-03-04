-- ── Migration 005: Player balances (persisted in-app USDC balance) ───────────
-- Tracks total deposited / withdrawn per wallet so in-app balance
-- survives page refreshes. Available balance is derived dynamically:
--   available = total_deposited - total_withdrawn - SUM(active bet amounts)

CREATE TABLE IF NOT EXISTS player_balances (
  wallet_address  TEXT PRIMARY KEY,
  total_deposited NUMERIC(18,6) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(18,6) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- View: per-wallet in-app balance + total locked across all games + available
CREATE OR REPLACE VIEW player_available_balance AS
SELECT
  pb.wallet_address,
  pb.total_deposited - pb.total_withdrawn                                          AS in_app_balance,
  COALESCE(SUM(b.current_amount) FILTER (WHERE b.status = 'active'), 0)           AS total_locked,
  pb.total_deposited - pb.total_withdrawn
    - COALESCE(SUM(b.current_amount) FILTER (WHERE b.status = 'active'), 0)       AS available
FROM player_balances pb
LEFT JOIN bets b ON LOWER(b.bettor_wallet) = LOWER(pb.wallet_address)
GROUP BY pb.wallet_address, pb.total_deposited, pb.total_withdrawn;
