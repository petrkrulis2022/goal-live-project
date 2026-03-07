/**
 * settle-match — Finalise all bets for a completed match and settle on-chain.
 *
 * Called by:
 *  - Chainlink CRE HTTP job (automated, Phase 4)
 *  - Admin panel (manual fallback, Phase 3)
 *
 * POST body:
 * {
 *   match_id:              string,   // Supabase UUID of the match row
 *   goal_scorer_player_ids: string[], // Goalserve external_player_id integers
 *   winner:               "home" | "draw" | "away",
 *   home_goals:           number,
 *   away_goals:           number
 * }
 *
 * Logic:
 *  1. Validates match exists and is not already finished.
 *  2. Settles all bet types correctly:
 *     NGS         → player ID in goal_scorer_player_ids
 *     MATCH_WINNER → predicted outcome matches winner
 *     EXACT_GOALS  → goalsTarget === home_goals + away_goals
 *  3. Calls settleMatch() on the singleton GoalLiveBetting contract.
 *  4. Calls settleUserBalances() so users can withdraw() their USDC.
 *  5. Upserts provisional_credits for winners.
 *  6. Marks match status = 'finished', writes blockchain_settle_tx.
 *
 * Returns: { success, match_id, scorers[], bets_settled, winners, total_payout, blockchain_settle_tx, blockchain_balances_tx, settled[] }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Minimal ABI: only the functions this edge function calls ────────────────
const GLB_ABI = [
  "function settleMatch(string calldata matchId, uint256[] calldata goalScorers, uint8 winner, uint8 homeGoals, uint8 awayGoals) external",
  "function settleUserBalances(string calldata matchId, address[] calldata users, uint256[] calldata payouts) external",
];

// Match winner outcome → uint8 (must match contract enum: HOME=0, DRAW=1, AWAY=2)
const WINNER_TO_UINT: Record<string, number> = {
  home: 0,
  draw: 1,
  away: 2,
};

interface BetRow {
  id: string;
  bettor_wallet: string;
  bet_type: "NEXT_GOAL_SCORER" | "MATCH_WINNER" | "EXACT_GOALS";
  current_player_id: string; // Goalserve integer string for NGS; numeric string for EXACT_GOALS (goal count target)
  outcome: "home" | "away" | "draw" | null; // for MATCH_WINNER
  current_amount: string | number;
  total_penalties: string | number;
  odds: string | number;
  status: string;
  change_count: number;
}

interface SettledResult {
  bet_id: string;
  bettor: string;
  bet_type: string;
  status: "settled_won" | "settled_lost";
  payout: number;
}

/** Determine if a bet won given settlement data. */
function didBetWin(
  bet: BetRow,
  scorerSet: Set<string>,
  winner: string,
  totalGoals: number,
): boolean {
  switch (bet.bet_type) {
    case "NEXT_GOAL_SCORER":
      return scorerSet.has(bet.current_player_id);
    case "MATCH_WINNER":
      return bet.outcome === winner;
    case "EXACT_GOALS":
      // current_player_id stores the goals target count as a numeric string
      return parseInt(bet.current_player_id, 10) === totalGoals;
    default:
      return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return json("ok", 200);
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const {
      match_id,
      goal_scorer_player_ids,
      winner,
      home_goals,
      away_goals,
      force,
    } = await req.json();

    // ── Validate input ────────────────────────────────────────────────────
    if (!match_id) return json({ error: "match_id is required" }, 400);
    if (!winner || !(winner in WINNER_TO_UINT))
      return json({ error: "winner must be 'home', 'draw', or 'away'" }, 400);
    if (typeof home_goals !== "number" || typeof away_goals !== "number")
      return json(
        { error: "home_goals and away_goals (numbers) are required" },
        400,
      );

    const scorerIds: string[] = Array.isArray(goal_scorer_player_ids)
      ? goal_scorer_player_ids.map(String)
      : [];

    // Reject UUID-like IDs (those cause on-chain BigInt issues) but allow:
    //  - Numeric Goalserve IDs (e.g. "123456")    → on-chain + Supabase matching
    //  - Synthetic gs_xxx IDs (e.g. "gs_budimir") → Supabase matching only
    for (const id of scorerIds) {
      if (id.includes("-")) {
        return json(
          {
            error: `goal_scorer_player_ids must not be UUIDs; got "${id}"`,
          },
          400,
        );
      }
    }

    // On-chain: only send numeric IDs (contract expects uint256)
    const onChainScorerIds = scorerIds.filter((id) => /^\d+$/.test(id));
    // Supabase matching: use all IDs (numeric + gs_xxx synthetic IDs)
    const scorerSet = new Set<string>(scorerIds);
    const totalGoals = home_goals + away_goals;

    // ── Verify match exists ───────────────────────────────────────────────
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select(
        "id, status, home_team, away_team, contract_address, external_match_id",
      )
      .eq("id", match_id)
      .single();

    if (matchErr || !match) return json({ error: "Match not found" }, 404);
    if (match.status === "finished" && !force)
      return json({ error: "Match already settled" }, 409);

    // ── Get all unsettled bets for this match ─────────────────────────────
    const { data: bets, error: betsErr } = await supabase
      .from("bets")
      .select(
        "id, bettor_wallet, bet_type, current_player_id, outcome, current_amount, total_penalties, odds, status, change_count",
      )
      .eq("match_id", match_id)
      .in(
        "status",
        force
          ? [
              "active",
              "provisional_win",
              "provisional_loss",
              "settled_won",
              "settled_lost",
            ]
          : ["active", "provisional_win", "provisional_loss"],
      );

    if (betsErr)
      return json({ error: `bets query failed: ${betsErr.message}` }, 500);

    const settled: SettledResult[] = [];

    for (const bet of (bets ?? []) as BetRow[]) {
      const won = didBetWin(bet, scorerSet, winner, totalGoals);
      const newStatus: "settled_won" | "settled_lost" = won
        ? "settled_won"
        : "settled_lost";

      const currentAmount = Number(bet.current_amount);
      const payout = won
        ? Math.round(currentAmount * Number(bet.odds) * 1_000_000) / 1_000_000
        : 0;

      await supabase
        .from("bets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", bet.id);

      if (won) {
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
        bet_type: bet.bet_type,
        status: newStatus,
        payout,
      });
    }

    // ── Settle on-chain via singleton GoalLiveBetting contract ────────────
    let settleTxHash: string | null = null;
    let balanceTxHash: string | null = null;
    const contractAddress =
      match.contract_address ?? Deno.env.get("CONTRACT_ADDRESS") ?? null;
    const rpcUrl =
      Deno.env.get("SEPOLIA_RPC_URL") ?? "https://sepolia.drpc.org";
    const oraclePrivateKey = Deno.env.get("ORACLE_PRIVATE_KEY") ?? null;

    if (contractAddress && oraclePrivateKey) {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(oraclePrivateKey, provider);
      const contract = new ethers.Contract(contractAddress, GLB_ABI, wallet);
      const onChainMatchId = match.external_match_id ?? match_id;

      // ── Step A: settleMatch() — records outcome on-chain ──────────────────
      try {
        const scorersBigInt = onChainScorerIds.map((id) => BigInt(id));
        const winnerUint = WINNER_TO_UINT[winner];

        const tx = await contract.settleMatch(
          onChainMatchId,
          scorersBigInt,
          winnerUint,
          home_goals,
          away_goals,
        );
        await tx.wait();
        settleTxHash = tx.hash;
        console.log("[settle-match] settleMatch on-chain:", settleTxHash);

        // Write settle tx hash to all settled bets
        await supabase
          .from("bets")
          .update({ blockchain_settle_tx: settleTxHash })
          .eq("match_id", match_id)
          .in("status", ["settled_won", "settled_lost"]);
      } catch (onChainErr) {
        const msg = String(onChainErr);
        if (msg.includes("already settled")) {
          console.log(
            "[settle-match] settleMatch: already settled on-chain, continuing to settleUserBalances",
          );
          settleTxHash = "already_settled";
        } else {
          console.error("[settle-match] settleMatch failed:", msg);
          settleTxHash = `ERROR: ${msg}`;
        }
      }

      // ── Step B: settleUserBalances() — distribute per-user USDC balances ──
      // oracle wallet = relayer wallet (same key), so this works with ORACLE_PRIVATE_KEY.
      // Required so users can call withdraw(). Losers get 0, winners get payout.
      // Must be called after settleMatch(). Safe to retry (reverts if already done).
      try {
        // Build user → total payout map (in USDC micro-units, 6 decimals)
        const userPayoutMap = new Map<string, bigint>();
        for (const s of settled) {
          const prev = userPayoutMap.get(s.bettor) ?? 0n;
          // Convert dollar amount to USDC micro-units (× 1_000_000)
          const microUsdc = BigInt(Math.round(s.payout * 1_000_000));
          userPayoutMap.set(s.bettor, prev + microUsdc);
        }
        // Include losers with 0 payout so their deposit balance is overwritten to 0
        for (const bet of (bets ?? []) as BetRow[]) {
          if (!userPayoutMap.has(bet.bettor_wallet)) {
            userPayoutMap.set(bet.bettor_wallet, 0n);
          }
        }

        const users = [...userPayoutMap.keys()];
        const payouts = users.map((u) => userPayoutMap.get(u)!);

        if (users.length > 0) {
          const tx2 = await contract.settleUserBalances(
            onChainMatchId,
            users,
            payouts,
          );
          await tx2.wait();
          balanceTxHash = tx2.hash;
          console.log(
            "[settle-match] settleUserBalances on-chain:",
            balanceTxHash,
          );
        }
      } catch (balanceErr) {
        const msg = String(balanceErr);
        if (msg.includes("balances already settled")) {
          console.log("[settle-match] settleUserBalances: already done");
          balanceTxHash = "already_settled";
        } else {
          console.error("[settle-match] settleUserBalances failed:", msg);
          balanceTxHash = `ERROR: ${msg}`;
        }
      }
    } else {
      console.warn(
        "[settle-match] skipping on-chain: missing contract_address or ORACLE_PRIVATE_KEY.",
        "Set ORACLE_PRIVATE_KEY and CONTRACT_ADDRESS in Supabase secrets.",
      );
    }

    // ── Update match status + final score ────────────────────────────────
    await supabase
      .from("matches")
      .update({
        status: "finished",
        score_home: home_goals,
        score_away: away_goals,
        updated_at: new Date().toISOString(),
      })
      .eq("id", match_id);

    const winners = settled.filter((b) => b.status === "settled_won");

    return json({
      success: true,
      match_id,
      match: {
        home: match.home_team,
        away: match.away_team,
        score: `${home_goals}-${away_goals}`,
        winner,
      },
      scorers: scorerIds,
      bets_settled: settled.length,
      winners: winners.length,
      total_payout: winners.reduce((acc, b) => acc + b.payout, 0),
      blockchain_settle_tx: settleTxHash,
      blockchain_balances_tx: balanceTxHash,
      settled,
    });
  } catch (err) {
    console.error("[settle-match] unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
