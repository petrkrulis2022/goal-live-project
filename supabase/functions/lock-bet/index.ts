/**
 * lock-bet — Place a new bet for a match.
 *
 * Supports all three bet types:
 *   NEXT_GOAL_SCORER  — player_id required (Goalserve external_player_id)
 *   MATCH_WINNER      — outcome required ("home" | "draw" | "away")
 *   EXACT_GOALS       — goals_target required (integer total goals)
 *
 * POST body:
 *   {
 *     bettor_wallet:  string,   // 0x-prefixed wallet address
 *     match_id:       string,   // UUID of the match row
 *     bet_type?:      string,   // "NEXT_GOAL_SCORER" (default) | "MATCH_WINNER" | "EXACT_GOALS"
 *     player_id?:     string,   // required for NEXT_GOAL_SCORER (external_player_id)
 *     outcome?:       string,   // required for MATCH_WINNER ("home"|"draw"|"away")
 *     goals_target?:  number,   // required for EXACT_GOALS
 *     amount:         number,   // USDC amount (e.g. 10.0)
 *     odds:           number,   // decimal odds (e.g. 4.5)
 *     current_minute?: number   // override; defaults to match.current_minute
 *   }
 *
 * Returns: { success: true, bet: BetRow }
 *
 * Phase 3 note: After this runs, call the appropriate on-chain lockBet*()
 * and write the tx hash back with PATCH /bets/{id} → blockchain_lock_tx.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_STATUSES = ["pre-match", "live", "halftime"];
const VALID_OUTCOMES = new Set(["home", "draw", "away"]);
const VALID_BET_TYPES = new Set([
  "NEXT_GOAL_SCORER",
  "MATCH_WINNER",
  "EXACT_GOALS",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      bettor_wallet,
      match_id,
      bet_type = "NEXT_GOAL_SCORER",
      player_id,
      outcome,
      goals_target,
      amount,
      odds,
      current_minute,
    } = await req.json();

    // ── Validate required fields ──────────────────────────────────────────
    if (!bettor_wallet || !match_id || amount == null || odds == null) {
      return json(
        {
          error:
            "Missing required fields: bettor_wallet, match_id, amount, odds",
        },
        400,
      );
    }
    if (!VALID_BET_TYPES.has(bet_type)) {
      return json(
        {
          error: `Invalid bet_type "${bet_type}". Must be NEXT_GOAL_SCORER, MATCH_WINNER, or EXACT_GOALS`,
        },
        400,
      );
    }
    if (bet_type === "NEXT_GOAL_SCORER" && !player_id) {
      return json(
        { error: "player_id is required for NEXT_GOAL_SCORER bets" },
        400,
      );
    }
    if (bet_type === "MATCH_WINNER") {
      if (!outcome || !VALID_OUTCOMES.has(outcome)) {
        return json(
          {
            error:
              "outcome must be 'home', 'draw', or 'away' for MATCH_WINNER bets",
          },
          400,
        );
      }
    }
    if (bet_type === "EXACT_GOALS") {
      if (
        goals_target == null ||
        !Number.isInteger(goals_target) ||
        goals_target < 0
      ) {
        return json(
          {
            error:
              "goals_target must be a non-negative integer for EXACT_GOALS bets",
          },
          400,
        );
      }
    }
    if (amount <= 0) return json({ error: "amount must be > 0" }, 400);
    if (odds <= 1) return json({ error: "odds must be > 1" }, 400);

    const wallet = bettor_wallet.toLowerCase();

    // ── Verify match exists and is accepting bets ─────────────────────────
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, status, current_minute, contract_address")
      .eq("id", match_id)
      .single();

    if (matchErr || !match) return json({ error: "Match not found" }, 404);
    if (!ALLOWED_STATUSES.includes(match.status)) {
      return json(
        { error: `Match is not accepting bets (status: ${match.status})` },
        409,
      );
    }

    // ── Check available balance ───────────────────────────────────────────
    const { data: balRow } = await supabase
      .from("player_available_balance")
      .select("available")
      .eq("wallet_address", wallet)
      .maybeSingle();

    const available = balRow ? Number(balRow.available) : 0;
    if (available < amount) {
      return json(
        {
          error: `Insufficient balance. Available: ${available.toFixed(6)}, requested: ${amount}`,
        },
        409,
      );
    }

    // ── Prevent duplicate active bets (one per type per wallet per match) ──
    if (bet_type === "NEXT_GOAL_SCORER" || bet_type === "MATCH_WINNER") {
      const { data: existing } = await supabase
        .from("bets")
        .select("id")
        .eq("bettor_wallet", wallet)
        .eq("match_id", match_id)
        .eq("bet_type", bet_type)
        .eq("status", "active")
        .maybeSingle();
      if (existing) {
        const code =
          bet_type === "NEXT_GOAL_SCORER"
            ? "EXISTING_NGS_BET"
            : "EXISTING_MW_BET";
        return json({ error: `${code}:${existing.id}` }, 409);
      }
    }

    // ── For NGS: verify player exists in this match ───────────────────────
    if (bet_type === "NEXT_GOAL_SCORER") {
      const { data: playerRow, error: playerErr } = await supabase
        .from("players")
        .select("id")
        .eq("match_id", match_id)
        .eq("external_player_id", player_id)
        .maybeSingle();
      if (playerErr || !playerRow) {
        return json(
          { error: `Player "${player_id}" not found in match ${match_id}` },
          404,
        );
      }
    }

    // ── Resolve player_id/outcome/goals_target into the player_id columns ──
    // Schema: original_player_id / current_player_id are NOT NULL.
    // Convention (mirrors frontend bettingService.ts):
    //   NGS         → external_player_id string
    //   MATCH_WINNER → outcome string ("home"|"draw"|"away")
    //   EXACT_GOALS  → goals_target as string ("3")
    const playerIdValue: string =
      bet_type === "NEXT_GOAL_SCORER"
        ? String(player_id)
        : bet_type === "MATCH_WINNER"
          ? String(outcome)
          : String(goals_target);

    // ── Generate a deterministic blockchain_bet_id (bytes32 hex) ─────────
    const raw = crypto.randomUUID().replace(/-/g, "");
    const betId = "0x" + (raw + raw).slice(0, 64);

    // ── Insert bet row ────────────────────────────────────────────────────
    const { data: bet, error: betErr } = await supabase
      .from("bets")
      .insert({
        bettor_wallet: wallet,
        match_id,
        bet_type,
        original_player_id: playerIdValue,
        current_player_id: playerIdValue,
        outcome: bet_type === "MATCH_WINNER" ? outcome : null,
        original_amount: amount,
        current_amount: amount,
        total_penalties: 0,
        change_count: 0,
        odds,
        status: "active",
        placed_at_minute: current_minute ?? match.current_minute ?? 0,
        blockchain_bet_id: betId,
      })
      .select()
      .single();

    if (betErr) return json({ error: betErr.message }, 500);

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
