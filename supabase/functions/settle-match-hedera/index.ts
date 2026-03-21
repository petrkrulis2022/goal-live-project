/**
 * settle-match-hedera — Finalise all bets for a completed match and settle on-chain (Hedera Testnet).
 *
 * This is the Hedera-specific version of settle-match. Uses:
 *   - HEDERA_RPC_URL  (env var, fallback: https://testnet.hashio.io/api)
 *   - HEDERA_CONTRACT_ADDRESS  (env var fallback; primary source is match.contract_address in DB)
 *
 * Called by:
 *  - sync-match-status edge function  (auto-triggered on FT — fire-and-forget)
 *  - Admin panel "Settle Match" button (auto-fetch mode — no body params needed)
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
        "id, status, home_team, away_team, contract_address, external_match_id, goalserve_static_id, odds_api_config",
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
      const staticId: string | null = match.goalserve_static_id ?? null;
      if (!staticId) {
        return json(
          {
            error:
              "Cannot auto-fetch: match has no goalserve_static_id. Pass winner + home_goals + away_goals explicitly.",
          },
          422,
        );
      }

      const gsKey =
        Deno.env.get("GOALSERVE_API_KEY") ?? "5dc9cf20aca34682682708de71344f52";
      const gsBase = `https://www.goalserve.com/getfeed/${gsKey}`;

      // Fetch livescores/results feed
      const liveRes = await fetch(`${gsBase}/soccernew/home?json=1`);
      if (!liveRes.ok) {
        return json(
          { error: `Goalserve livescores fetch failed: ${liveRes.status}` },
          502,
        );
      }
      // deno-lint-ignore no-explicit-any
      const liveData: any = await liveRes.json();
      // deno-lint-ignore no-explicit-any
      const categories: any[] = Array.isArray(liveData?.scores?.category)
        ? liveData.scores.category
        : liveData?.scores?.category
          ? [liveData.scores.category]
          : [];

      // deno-lint-ignore no-explicit-any
      let foundMatch: any = null;
      let foundLeagueId = "";
      outer: for (const cat of categories) {
        // deno-lint-ignore no-explicit-any
        const catMatches: any[] = Array.isArray(cat?.matches?.match)
          ? cat.matches.match
          : cat?.matches?.match
            ? [cat.matches.match]
            : [];
        for (const m of catMatches) {
          if (String(m["@static_id"]) === String(staticId)) {
            foundMatch = m;
            foundLeagueId = cat["@id"] ?? "";
            break outer;
          }
        }
      }

      // ── Fallback: if match not in livescores, try commentary feed directly ──
      // The /home livescores feed only covers today. For yesterday's or older
      // finished matches, the commentary feed is the source of truth.
      if (!foundMatch) {
        // deno-lint-ignore no-explicit-any
        const cfg = (match.odds_api_config ?? {}) as Record<string, any>;
        const leagueFromConfig: string = cfg?.goalserve_league ?? "";
        if (!leagueFromConfig) {
          return json(
            {
              error: `Match ${staticId} not found in today's Goalserve feed and no goalserve_league in odds_api_config to fall back to commentary. Pass winner + home_goals + away_goals explicitly.`,
            },
            422,
          );
        }
        foundLeagueId = leagueFromConfig;
        try {
          const commRes = await fetch(
            `${gsBase}/commentaries/match?id=${staticId}&league=${foundLeagueId}&json=1`,
          );
          if (!commRes.ok) {
            return json(
              {
                error: `Match ${staticId} not found in Goalserve feed and commentary fetch failed (${commRes.status}).`,
              },
              422,
            );
          }
          // deno-lint-ignore no-explicit-any
          const commData: any = await commRes.json();
          const rawMatch =
            commData?.commentaries?.tournament?.match ??
            commData?.commentaries?.match ??
            null;
          // deno-lint-ignore no-explicit-any
          const matchNode: any = Array.isArray(rawMatch)
            ? rawMatch[0]
            : rawMatch;
          if (!matchNode) {
            return json(
              {
                error: `Match ${staticId} not found in Goalserve livescores or commentary feed.`,
              },
              422,
            );
          }
          const commStatus: string = matchNode["@status"] ?? "";
          const FT_STATUSES = [
            "FT",
            "AET",
            "After ET",
            "Full-time",
            "full-time",
          ];
          if (!FT_STATUSES.includes(commStatus)) {
            return json(
              {
                error: `Match is not finished on Goalserve yet. Commentary status: "${commStatus}". Settle only at FT.`,
              },
              422,
            );
          }
          home_goals =
            parseInt(matchNode?.localteam?.["@goals"] ?? "0", 10) || 0;
          away_goals =
            parseInt(matchNode?.visitorteam?.["@goals"] ?? "0", 10) || 0;
          winner =
            home_goals > away_goals
              ? "home"
              : away_goals > home_goals
                ? "away"
                : "draw";
          // Extract scorers from this same commentary node
          const gs = matchNode?.goalscorer ?? {};
          // deno-lint-ignore no-explicit-any
          const extractIdsComm = (node: any): string[] => {
            const players = Array.isArray(node?.player)
              ? node.player
              : node?.player
                ? [node.player]
                : [];
            return (
              players
                // deno-lint-ignore no-explicit-any
                .filter((p: any) => (p["@type"] ?? "").toLowerCase() !== "own")
                // deno-lint-ignore no-explicit-any
                .map((p: any) => p["@id"] ?? p["@player_id"] ?? "")
                .filter(Boolean)
            );
          };
          goal_scorer_player_ids = [
            ...extractIdsComm(gs?.localteam),
            ...extractIdsComm(gs?.visitorteam),
          ];
          console.log(
            `[settle-match] commentary fallback: ${match.home_team} ${home_goals}-${away_goals} ${match.away_team}, ` +
              `winner=${winner}, scorers=[${goal_scorer_player_ids.join(",")}]`,
          );
          // Skip the second commentary fetch below since we already have scorers
          foundLeagueId = ""; // sentinel: already fetched
        } catch (commErr) {
          return json(
            {
              error: `Match ${staticId} not in today's feed and commentary fetch threw: ${commErr}`,
            },
            422,
          );
        }
      }

      // ── If found in livescores, validate status and get score ─────────────
      if (foundMatch) {
        const gsStatus: string = foundMatch["@status"] ?? "";
        const FT_STATUSES = ["FT", "AET", "After ET", "Full-time", "full-time"];
        if (!FT_STATUSES.includes(gsStatus)) {
          return json(
            {
              error: `Match is not finished on Goalserve yet. Current status: "${gsStatus}". Settle only at FT.`,
            },
            422,
          );
        }
        home_goals =
          parseInt(foundMatch?.localteam?.["@goals"] ?? "0", 10) || 0;
        away_goals =
          parseInt(foundMatch?.visitorteam?.["@goals"] ?? "0", 10) || 0;
        winner =
          home_goals > away_goals
            ? "home"
            : away_goals > home_goals
              ? "away"
              : "draw";
      }

      // Fetch goal scorers from commentary feed (only if not already done in fallback path)
      goal_scorer_player_ids = goal_scorer_player_ids ?? [];
      if (foundLeagueId) {
        try {
          const commRes = await fetch(
            `${gsBase}/commentaries/match?id=${staticId}&league=${foundLeagueId}&json=1`,
          );
          if (commRes.ok) {
            // deno-lint-ignore no-explicit-any
            const commData: any = await commRes.json();
            const rawMatch =
              commData?.commentaries?.tournament?.match ??
              commData?.commentaries?.match ??
              null;
            // deno-lint-ignore no-explicit-any
            const matchNode: any = Array.isArray(rawMatch)
              ? rawMatch[0]
              : rawMatch;
            if (matchNode) {
              const gs = matchNode?.goalscorer ?? {};
              // deno-lint-ignore no-explicit-any
              const extractIds = (node: any): string[] => {
                const players = Array.isArray(node?.player)
                  ? node.player
                  : node?.player
                    ? [node.player]
                    : [];
                return (
                  players
                    // deno-lint-ignore no-explicit-any
                    .filter(
                      (p: any) => (p["@type"] ?? "").toLowerCase() !== "own",
                    )
                    // deno-lint-ignore no-explicit-any
                    .map((p: any) => p["@id"] ?? p["@player_id"] ?? "")
                    .filter(Boolean)
                );
              };
              goal_scorer_player_ids = [
                ...extractIds(gs?.localteam),
                ...extractIds(gs?.visitorteam),
              ];
            }
          }
        } catch (commErr) {
          console.warn(
            "[settle-match] commentary fetch failed (non-fatal):",
            commErr,
          );
        }
      }

      if (foundLeagueId !== "") {
        // Only log here if livescores path was used (commentary path logs its own line)
        console.log(
          `[settle-match] auto-fetch (livescores): ${match.home_team} ${home_goals}-${away_goals} ${match.away_team}, ` +
            `winner=${winner}, scorers=[${(goal_scorer_player_ids ?? []).join(",")}]`,
        );
      }
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
      match.contract_address ?? Deno.env.get("HEDERA_CONTRACT_ADDRESS") ?? null;
    const rpcUrl =
      Deno.env.get("HEDERA_RPC_URL") ?? "https://testnet.hashio.io/api";
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
        console.log(
          "[settle-match-hedera] settleMatch on-chain:",
          settleTxHash,
        );

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
            "[settle-match-hedera] settleMatch: already settled on-chain (match inactive), continuing to settleUserBalances",
          );
          settleTxHash = "already_settled";
        } else {
          console.error("[settle-match-hedera] settleMatch failed:", msg);
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
          "[settle-match-hedera] skipping settleUserBalances — settleMatch had an error:",
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
              "[settle-match-hedera] settleUserBalances on-chain:",
              balanceTxHash,
            );
          }
        } catch (balanceErr) {
          const msg = String(balanceErr);
          if (msg.includes("balances already settled")) {
            console.log(
              "[settle-match-hedera] settleUserBalances: already done",
            );
            balanceTxHash = "already_settled";
          } else {
            console.error(
              "[settle-match-hedera] settleUserBalances failed:",
              msg,
            );
            balanceTxHash = `ERROR: ${msg}`;
          }
        }
    } else {
      console.warn(
        "[settle-match-hedera] skipping on-chain: missing contract_address or ORACLE_PRIVATE_KEY.",
        "Set ORACLE_PRIVATE_KEY and HEDERA_CONTRACT_ADDRESS in Supabase secrets.",
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
    console.error("[settle-match-hedera] unhandled error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
