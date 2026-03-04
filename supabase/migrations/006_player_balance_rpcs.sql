-- ── Migration 006: RPC helpers for player_balances upsert ───────────────
-- Used by walletService to persist deposits/withdrawals so in-app balance
-- survives page reloads and extension restarts.

-- Upsert a deposit: insert row if new, otherwise increment total_deposited.
CREATE OR REPLACE FUNCTION increment_player_deposit(
  p_wallet  TEXT,
  p_amount  NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO player_balances (wallet_address, total_deposited, total_withdrawn, updated_at)
  VALUES (LOWER(p_wallet), p_amount, 0, NOW())
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_deposited = player_balances.total_deposited + p_amount,
    updated_at      = NOW();
END;
$$;

-- Upsert a withdrawal: insert row if new, otherwise increment total_withdrawn.
CREATE OR REPLACE FUNCTION increment_player_withdrawal(
  p_wallet  TEXT,
  p_amount  NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO player_balances (wallet_address, total_deposited, total_withdrawn, updated_at)
  VALUES (LOWER(p_wallet), 0, p_amount, NOW())
  ON CONFLICT (wallet_address)
  DO UPDATE SET
    total_withdrawn = player_balances.total_withdrawn + p_amount,
    updated_at      = NOW();
END;
$$;
