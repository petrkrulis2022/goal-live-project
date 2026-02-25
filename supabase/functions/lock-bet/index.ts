/**
 * lock-bet — Place a new bet for a live match.
 *
 * POST body:
 *   {
 *     bettor_wallet: string,        // 0x-prefixed wallet address
 *     match_id:      string,        // UUID of the match row
 *     player_id:     string,        // external_player_id (e.g. "city_1")
 *     amount:        number,        // USDC amount (e.g. 10.0)
 *     odds:          number,        // decimal odds (e.g. 4.5)
 *     current_minute?: number       // override; defaults to match.current_minute
 *   }
 *
 * Returns: { success: true, bet: BetRow }
 *
 * Phase 3 note: After this runs, call lockBet() on-chain and write the
 * returned tx hash back with PATCH /bets/{id} → blockchain_lock_tx.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { bettor_wallet, match_id, player_id, amount, odds, current_minute } =
      await req.json();

    // ── Validate required fields ──────────────────────────────────────────
    if (
      !bettor_wallet ||
      !match_id ||
      !player_id ||
      amount == null ||
      odds == null
    ) {
      return json(
        {
          error:
            "Missing required fields: bettor_wallet, match_id, player_id, amount, odds",
        },
        400,
      );
    }

    if (amount <= 0) return json({ error: "amount must be > 0" }, 400);
    if (odds <= 1) return json({ error: "odds must be > 1" }, 400);

    // ── Verify match is live ──────────────────────────────────────────────
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, status, current_minute, contract_address")
      .eq("id", match_id)
      .single();

    if (matchErr || !match) {
      return json({ error: "Match not found" }, 404);
    }
    if (!["live", "halftime"].includes(match.status)) {
      return json(
        { error: `Match is not accepting bets (status: ${match.status})` },
        409,
      );
    }

    // ── Verify player exists in this match ────────────────────────────────
    const { data: player, error: playerErr } = await supabase
      .from("players")
      .select("id, name, team, odds")
      .eq("match_id", match_id)
      .eq("external_player_id", player_id)
      .single();

    if (playerErr || !player) {
      return json(
        { error: `Player "${player_id}" not found in match ${match_id}` },
        404,
      );
    }

    // ── Generate a deterministic blockchain_bet_id (bytes32 hex) ─────────
    // Phase 3: real lockBet() will use this as the on-chain key.
    const raw = crypto.randomUUID().replace(/-/g, "");
    const betId = "0x" + (raw + raw).slice(0, 64); // 32 bytes = 64 hex chars

    // ── Insert bet row ────────────────────────────────────────────────────
    const { data: bet, error: betErr } = await supabase
      .from("bets")
      .insert({
        bettor_wallet: bettor_wallet.toLowerCase(),
        match_id,
        bet_type: "NEXT_GOAL_SCORER",
        original_player_id: player_id,
        current_player_id: player_id,
        original_amount: amount,
        current_amount: amount,
        total_penalties: 0,
        change_count: 0,
        odds,
        status: "active",
        placed_at_minute: current_minute ?? match.current_minute,
        blockchain_bet_id: betId,
      })
      .select()
      .single();

    if (betErr) {
      return json({ error: betErr.message }, 500);
    }

    return json({ success: true, bet }, 201);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
