/**
 * settle-match — Finalise all bets for a completed match and settle on-chain.
 *
 * Called by:
 *  - Admin panel "Settle Match" button  (auto-fetch mode — no body params needed)
 *  - Chainlink CRE HTTP job             (explicit mode — passes winner + goals)
 *
 * POST body:
 * {
 *   match_id:               string,     // Supabase UUID — REQUIRED
 *
 *   // --- AUTO-FETCH MODE (omit all four below) ----------------------------
 *   // Edge fn fetches final score + scorers from Goalserve using
 *   // the match's goalserve_static_id. Returns 422 if not FT yet.
 *
 *   // --- EXPLICIT MODE (CRE / manual override) ----------------------------
 *   winner:                "home" | "draw" | "away",  // optional
 *   home_goals:            number,                     // optional
 *   away_goals:            number,                     // optional
 *   goal_scorer_player_ids: string[],                  // optional
 *
 *   force?:                boolean  // re-settle already-finished match
 * }
 *
 * Logic:
 *  1. Validates match exists; 409 if finished + !force.
 *  2. Auto-fetch or explicit winner/goals/scorers resolution.
 *  3. Settles all bet types (NGS, MATCH_WINNER, EXACT_GOALS, NEXT_CORNER).
 *  4. Calls settleMatch() on-chain via ORACLE_PRIVATE_KEY.
 *  5. Calls settleUserBalances() so users can withdraw() USDC.
 *  6. Upserts provisional_credits, marks match finished.
 *
 * Returns: { success, match_id, match, scorers[], bets_settled, winners,
 *            total_payout, blockchain_settle_tx, blockchain_balances_tx, settled[] }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@6.13.2";
import {
  getSpToken,
  getSpMatchLive,
  getSpMatchEvents,
} from "../_shared/statsperform.ts";

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
  bet_type: "NEXT_GOAL_SCORER" | "MATCH_WINNER" | "EXACT_GOALS" | "NEXT_CORNER";
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
    case "NEXT_CORNER":
      // Corner bets are settled live by sync-match-status.
      // Any still-active NEXT_CORNER bets at FT are treated as lost
      // (the corner they were waiting for never came).
      return false;
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

    const body = await req.json();
    const { match_id, force } = body;
    // winner / home_goals / away_goals / goal_scorer_player_ids are optional
    // — omit all three to trigger Goalserve auto-fetch mode.
    let winner: string | undefined = body.winner;
    let home_goals: number | undefined = body.home_goals;
    let away_goals: number | undefined = body.away_goals;
    let goal_scorer_player_ids: string[] | undefined =
      body.goal_scorer_player_ids;

    // ── Validate required fields ──────────────────────────────────────────
    if (!match_id) return json({ error: "match_id is required" }, 400);

    // ── Verify match exists ───────────────────────────────────────────────
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select(
        "id, status, home_team, away_team, contract_address, external_match_id, statsperform_match_id, odds_api_config",
      )
      .eq("id", match_id)
      .single();

    if (matchErr || !match) return json({ error: "Match not found" }, 404);
    if (match.status === "finished" && !force)
      return json({ error: "Match already settled" }, 409);

    // ── AUTO-FETCH MODE: pull final result from Goalserve ─────────────────
    // Triggered when winner / home_goals / away_goals are not supplied.
    const autoFetch =
      winner === undefined ||
      home_goals === undefined ||
      away_goals === undefined;
    if (autoFetch) {
      const spMatchId: string | null = match.statsperform_match_id ?? null;
      if (!spMatchId) {
        return json(
          {
            error:
              "Cannot auto-fetch: match has no statsperform_match_id. Pass winner + home_goals + away_goals explicitly.",
          },
          422,
        );
      }

      // ── StatsPerform OAuth token ──────────────────────────────────────────
      let spToken: string;
      try {
        spToken = await getSpToken();
      } catch (tokenErr) {
        return json({ error: `StatsPerform OAuth failed: ${tokenErr}` }, 502);
      }

      // ── MA1: verify FullTime and get final score ──────────────────────────
      const spMatch = await getSpMatchLive(spMatchId, spToken);
      if (!spMatch) {
        return json(
          { error: `StatsPerform MA1 fetch failed for match ${spMatchId}` },
          502,
        );
      }
      if (!spMatch.isFullTime) {
        return json(
          {
            error: `Match is not FullTime yet on StatsPerform. Current status: "${spMatch.status}". Settle only at FullTime.`,
          },
          422,
        );
      }
      home_goals = spMatch.scoreHome ?? 0;
      away_goals = spMatch.scoreAway ?? 0;
      winner =
        home_goals > away_goals
          ? "home"
          : away_goals > home_goals
            ? "away"
            : "draw";

      // ── MA3: get goal scorer IDs ──────────────────────────────────────────
      const spEvents = await getSpMatchEvents(
        spMatchId,
        spToken,
        spMatch.homeContestantId,
      );
      // Own goals excluded — credit goes to the defending team, not the scorer
      goal_scorer_player_ids = spEvents.goals
        .filter((g) => !g.isOwnGoal)
        .map((g) => g.playerId);

      console.log(
        `[settle-match] auto-fetch (StatsPerform): ${match.home_team} ${home_goals}-${away_goals} ${match.away_team}, ` +
          `winner=${winner}, scorers=[${goal_scorer_player_ids.join(",")}]`,
      );
    }

    // ── At this point winner / home_goals / away_goals are always set ─────
    if (!winner || !(winner in WINNER_TO_UINT))
      return json({ error: "winner must be 'home', 'draw', or 'away'" }, 400);
    if (typeof home_goals !== "number" || typeof away_goals !== "number")
      return json(
        { error: "home_goals and away_goals (numbers) are required" },
        400,
      );

    const scorerIds: string[] = Array.isArray(goal_scorer_player_ids)
      ? (goal_scorer_player_ids as string[]).map(String)
      : [];

    // Reject UUID-like IDs (those cause on-chain BigInt issues) but allow:
    //  - Numeric Goalserve IDs (e.g. "123456")    → on-chain + Supabase matching
    //  - Synthetic gs_xxx IDs (e.g. "gs_budimir") → Supabase matching only
    for (const id of scorerIds) {
      if (id.includes("-")) {
        return json(
          { error: `goal_scorer_player_ids must not be UUIDs; got "${id}"` },
          400,
        );
      }
    }

    // On-chain: only send numeric IDs (contract expects uint256)
    const onChainScorerIds = scorerIds.filter((id) => /^\d+$/.test(id));
    // Supabase matching: use all IDs (numeric + gs_xxx synthetic IDs)
    const scorerSet = new Set<string>(scorerIds);
    const totalGoals = home_goals + away_goals;

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
      Deno.env.get("SEPOLIA_RPC_URL") ??
      "https://ethereum-sepolia-rpc.publicnode.com";
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
        settleTxHash = tx.hash;
        // Wait up to 60s for receipt; if it times out, we still have the hash
        // and the tx was submitted — proceed to settleUserBalances after a delay.
        const receiptTimeout = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 60_000),
        );
        const receipt = await Promise.race([tx.wait(), receiptTimeout]);
        if (!receipt) {
          console.warn(
            "[settle-match] settleMatch receipt timed out — tx submitted, waiting 15s before balances step",
            settleTxHash,
          );
          // Give the chain time to mine it before settleUserBalances
          await new Promise((r) => setTimeout(r, 15_000));
        }
        console.log("[settle-match] settleMatch on-chain:", settleTxHash);

        // Write settle tx hash to all settled bets
        await supabase
          .from("bets")
          .update({ blockchain_settle_tx: settleTxHash })
          .eq("match_id", match_id)
          .in("status", ["settled_won", "settled_lost"]);
      } catch (onChainErr) {
        const msg = String(onChainErr);
        // "already settled" OR "not active" both mean the match outcome is already
        // recorded on-chain — safe to proceed to settleUserBalances.
        if (msg.includes("already settled") || msg.includes("not active")) {
          console.log(
            "[settle-match] settleMatch: already settled on-chain (match inactive), continuing to settleUserBalances",
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
      // Skip if settleMatch itself failed (no point — contract will revert "not settled by CRE")
      if (settleTxHash?.startsWith("ERROR:")) {
        console.warn(
          "[settle-match] skipping settleUserBalances — settleMatch had an error:",
          settleTxHash,
        );
        balanceTxHash = "SKIPPED: settleMatch failed";
      } else
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

          // If no bets were placed, call settleUserBalances with the oracle address
          // as a sentinel (0 payout). This ensures poolSize - 0 = poolSize flows
          // into collectedFees so the admin can call withdrawFees() to reclaim
          // the admin-funded pool liquidity.
          const finalUsers = users.length > 0 ? users : [wallet.address];
          const finalPayouts = users.length > 0 ? payouts : [0n];

          if (finalUsers.length > 0) {
            const tx2 = await contract.settleUserBalances(
              onChainMatchId,
              finalUsers,
              finalPayouts,
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
