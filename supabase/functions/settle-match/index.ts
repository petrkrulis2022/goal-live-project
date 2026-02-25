/**
 * settle-match — Finalize all bets for a completed match.
 *
 * POST body:
 *   { match_id: string }   // UUID of the match row
 *
 * Logic:
 *  1. Reads all confirmed GOAL goal_events (ignores VAR_OVERTURNED).
 *  2. For every active/provisional bet:
 *     - winner  → status = 'settled_won',  payout = (current_amount - total_penalties) × odds
 *     - loser   → status = 'settled_lost', payout = 0
 *  3. Inserts/upserts a final provisional_credit row for each winner.
 *  4. Marks match status = 'finished'.
 *
 * Returns summary: { success, match_id, scorers[], bets_settled, winners, settled[] }
 *
 * Phase 3 note: After this runs, call settleMatch() on-chain with the scorer
 * list and write the returned tx hash to bets.blockchain_settle_tx.
 *
 * Penalty formula (must match frontend penaltyCalculator.ts):
 *   penalty = base[changeCount] × (1 − minute / 90)
 *   base[]  = [3%, 5%, 8%, 12%, 15%]
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Must match frontend src/utils/penaltyCalculator.ts
const PENALTY_BASE = [0.03, 0.05, 0.08, 0.12, 0.15];

/** Returns the penalty percentage for a given change index + minute. */
function penaltyPct(changeIndex: number, minute: number): number {
  const base = PENALTY_BASE[Math.min(changeIndex, PENALTY_BASE.length - 1)];
  const timeFactor = Math.max(0, 1 - minute / 90);
  return base * timeFactor;
}

interface BetRow {
  id: string;
  bettor_wallet: string;
  current_player_id: string;
  current_amount: string | number;
  total_penalties: string | number;
  odds: string | number;
  status: string;
  change_count: number;
}

interface SettledResult {
  bet_id: string;
  bettor: string;
  player_id: string;
  status: "settled_won" | "settled_lost";
  payout: number; // 0 for losers
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { match_id } = await req.json();

    if (!match_id) {
      return json({ error: "match_id is required" }, 400);
    }

    // ── Verify match exists ───────────────────────────────────────────────
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, status, home_team, away_team, score_home, score_away")
      .eq("id", match_id)
      .single();

    if (matchErr || !match) {
      return json({ error: "Match not found" }, 404);
    }
    if (match.status === "finished") {
      return json({ error: "Match already settled" }, 409);
    }

    // ── Get all confirmed goal scorers (exclude VAR_OVERTURNED) ──────────
    const { data: goalEvents, error: goalsErr } = await supabase
      .from("goal_events")
      .select("id, player_id, player_name, team, minute, event_type")
      .eq("match_id", match_id)
      .eq("confirmed", true)
      .neq("event_type", "VAR_OVERTURNED")
      .order("minute", { ascending: true });

    if (goalsErr) {
      return json(
        { error: `goal_events query failed: ${goalsErr.message}` },
        500,
      );
    }

    const scoringPlayerIds = new Set<string>(
      (goalEvents ?? []).map((g) => g.player_id),
    );
    const scorersList = [...scoringPlayerIds];

    // ── Get all unsettled bets for this match ─────────────────────────────
    const { data: bets, error: betsErr } = await supabase
      .from("bets")
      .select(
        "id, bettor_wallet, current_player_id, current_amount, total_penalties, odds, status, change_count",
      )
      .eq("match_id", match_id)
      .in("status", ["active", "provisional_win", "provisional_loss"]);

    if (betsErr) {
      return json({ error: `bets query failed: ${betsErr.message}` }, 500);
    }

    const settled: SettledResult[] = [];

    for (const bet of (bets ?? []) as BetRow[]) {
      const isWinner = scoringPlayerIds.has(bet.current_player_id);
      const newStatus: "settled_won" | "settled_lost" = isWinner
        ? "settled_won"
        : "settled_lost";

      // Net stake = what the bettor risked after all penalties
      const currentAmount = Number(bet.current_amount);
      const totalPenalties = Number(bet.total_penalties);
      const netStake = Math.max(0, currentAmount - totalPenalties);
      const payout = isWinner
        ? Math.round(netStake * Number(bet.odds) * 1_000_000) / 1_000_000
        : 0;

      // Update bet status
      const { error: updateErr } = await supabase
        .from("bets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", bet.id);

      if (updateErr) {
        console.error(`Failed to update bet ${bet.id}:`, updateErr.message);
        continue;
      }

      // Insert/upsert final provisional_credit for winners
      if (isWinner) {
        await supabase
          .from("provisional_credits")
          .upsert(
            { bet_id: bet.id, amount: payout, is_final: true },
            { onConflict: "bet_id" },
          );
      }

      settled.push({
        bet_id: bet.id,
        bettor: bet.bettor_wallet,
        player_id: bet.current_player_id,
        status: newStatus,
        payout,
      });
    }

    // ── Mark match as finished ────────────────────────────────────────────
    await supabase
      .from("matches")
      .update({ status: "finished", updated_at: new Date().toISOString() })
      .eq("id", match_id);

    const winners = settled.filter((b) => b.status === "settled_won");

    return json({
      success: true,
      match_id,
      match: {
        home: match.home_team,
        away: match.away_team,
        score: `${match.score_home}-${match.score_away}`,
      },
      scorers: scorersList,
      bets_settled: settled.length,
      winners: winners.length,
      total_payout: winners.reduce((acc, b) => acc + b.payout, 0),
      settled,
    });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
