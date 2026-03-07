/**
 * goal.live — Match Settlement Workflow
 *
 * Cron Trigger (every 60 s):
 *   1. HTTP → Supabase REST       : fetch matches with status IN ('live','halftime')
 *   2. HTTP → Goalserve feed      : check each match for 'FT' status
 *   3. HTTP → Goalserve commentary: get goal scorer IDs for first FT match
 *   4. HTTP → settle-match edge fn: POST result → updates Supabase bets + calls
 *                                   GoalLiveBetting.settleMatch() on-chain
 *
 * Each DON node independently runs steps 1–4 during the consensus phase.
 * settle-match is idempotent: the first node to succeed settles the match
 * (status → finished, bets → settled_won/lost). Subsequent nodes receive
 * HTTP 409 "Match already settled" and return `settled = 0` — no-op.
 *
 * Why HTTP → settle-match instead of EVM write → onReport():
 *   The settle-match Supabase Edge Function is the single source of truth for
 *   settlement. It handles both Supabase (bets, provisional_credits, match
 *   status) and the on-chain call (GoalLiveBetting.settleMatch via oracle key).
 *   Writing directly to onReport() bypasses Supabase entirely, leaving bets
 *   and match status in an inconsistent state.
 *
 * settle-match endpoint:
 *   POST {supabaseUrl}/functions/v1/settle-match
 *   Headers: apikey, Authorization: Bearer <anonKey>
 *   Body: { match_id, winner, home_goals, away_goals, goal_scorer_player_ids }
 */

import {
  ConsensusAggregationByFields,
  type CronPayload,
  cre,
  identical,
  type HTTPSendRequester,
  median,
  Runner,
  type Runtime,
} from "@chainlink/cre-sdk";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
//  Config schema (validated by CRE runtime from config.staging.json)
// ─────────────────────────────────────────────────────────────────────

const configSchema = z.object({
  /** Cron schedule, e.g. "*/60 * * * * *" */
  schedule: z.string(),
  /** Supabase project URL, e.g. https://xyz.supabase.co */
  supabaseUrl: z.string(),
  /** Supabase anon key — used as apikey header for both REST and edge fn calls */
  supabaseAnonKey: z.string(),
  /** Goalserve API key */
  goalserveApiKey: z.string(),
});

type Config = z.infer<typeof configSchema>;

// ─────────────────────────────────────────────────────────────────────
//  Data shapes
// ─────────────────────────────────────────────────────────────────────

interface SupabaseMatch {
  id: string;               // Supabase UUID — used as match_id in settle-match POST
  external_match_id: string;
  goalserve_static_id: string;
}

/**
 * Consensus-aggregatable settlement payload.
 * `found = 1` when a FT match is ready; `found = 0` means nothing this cycle.
 * `settled = 1` when settle-match returned 200 (settled now) or 409 (already settled).
 */
interface SettlementData {
  found: number;
  /** Supabase UUID used in the settle-match POST body */
  supabaseMatchId: string;
  externalMatchId: string;
  /** 0 = HOME, 1 = DRAW, 2 = AWAY */
  winner: number;
  homeGoals: number;
  awayGoals: number;
  /** Comma-separated Goalserve numeric player IDs, e.g. "1234,5678" */
  scorerIdsStr: string;
  /** 1 if settle-match returned 200 or 409 (both mean settlement is done) */
  settled: number;
}

// ─────────────────────────────────────────────────────────────────────
//  HTTP fetch + settle function (runs on each DON node, results aggregated)
// ─────────────────────────────────────────────────────────────────────

/** Normalise Goalserve arrays/objects to always-array. */
function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Called by cre.capabilities.HTTPClient.sendRequest() on each DON node.
 *
 * Steps:
 *  1. Query Supabase for live/halftime matches.
 *  2. Query Goalserve livescores to find FT status.
 *  3. Fetch goal scorer IDs from Goalserve commentary.
 *  4. POST to settle-match edge function.
 *     - 200: match settled now (bets updated + on-chain settleMatch() called)
 *     - 409: match already settled by an earlier node — idempotent no-op
 *     - other: error, return settled=0
 *
 * Returns SettlementData for consensus aggregation.
 */
const fetchAndSettle = (
  sendRequester: HTTPSendRequester,
  config: Config,
): SettlementData => {
  const empty: SettlementData = {
    found: 0,
    supabaseMatchId: "",
    externalMatchId: "",
    winner: 1,
    homeGoals: 0,
    awayGoals: 0,
    scorerIdsStr: "",
    settled: 0,
  };

  const authHeaders = {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
  };

  // ── Step 1: Supabase — get live/halftime matches ────────────────────
  const sbResp = sendRequester
    .sendRequest({
      method: "GET",
      url: `${config.supabaseUrl}/rest/v1/matches?status=in.(live,halftime)&select=id,external_match_id,goalserve_static_id`,
      headers: authHeaders,
    })
    .result();

  if (sbResp.statusCode !== 200) return empty;

  const liveMatches: SupabaseMatch[] = JSON.parse(
    Buffer.from(sbResp.body).toString("utf-8"),
  );
  if (!liveMatches.length) return empty;

  // Build lookup: goalserve_static_id → Supabase match row
  const matchMap = new Map<string, SupabaseMatch>();
  for (const m of liveMatches) {
    if (m.goalserve_static_id) {
      matchMap.set(m.goalserve_static_id, m);
    }
  }

  // ── Step 2: Goalserve — livescores home feed ────────────────────────────
  const gsBase = "https://www.goalserve.com/getfeed";
  const gsResp = sendRequester
    .sendRequest({
      method: "GET",
      url: `${gsBase}/${config.goalserveApiKey}/soccernew/home?json=1`,
    })
    .result();

  if (gsResp.statusCode !== 200) return empty;

  // deno-lint-ignore no-explicit-any
  const gsData: any = JSON.parse(Buffer.from(gsResp.body).toString("utf-8"));
  // deno-lint-ignore no-explicit-any
  const categories: any[] = toArray(gsData?.scores?.category);

  // ── Step 3: Find the first FT match we track ────────────────────────────
  for (const cat of categories) {
    // deno-lint-ignore no-explicit-any
    const catMatches: any[] = toArray(cat?.matches?.match);
    for (const m of catMatches) {
      const staticId: string = m["@static_id"];
      if (!staticId || !matchMap.has(staticId)) continue;

      const status: string = m["@status"] ?? "";
      if (status !== "FT" && status !== "AET" && status !== "After ET")
        continue;

      // Found a finished match that we track
      const dbMatch = matchMap.get(staticId)!;
      const homeGoals = parseInt(m?.localteam?.["@goals"] ?? "0", 10) || 0;
      const awayGoals = parseInt(m?.visitorteam?.["@goals"] ?? "0", 10) || 0;

      const winner = homeGoals > awayGoals ? 0 : awayGoals > homeGoals ? 2 : 1;

      // ── Step 4: Goalserve commentary — goal scorer IDs ─────────────────
      let scorerIdsStr = "";
      const leagueId: string = cat["@id"] ?? "";

      if (leagueId && staticId) {
        const commResp = sendRequester
          .sendRequest({
            method: "GET",
            url: `${gsBase}/${config.goalserveApiKey}/commentaries/match?id=${staticId}&league=${leagueId}&json=1`,
          })
          .result();

        if (commResp.statusCode === 200) {
          // deno-lint-ignore no-explicit-any
          const commData: any = JSON.parse(
            Buffer.from(commResp.body).toString("utf-8"),
          );
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
            const extractIds = (node: any): string[] =>
              toArray(node?.player)
                // deno-lint-ignore no-explicit-any
                .filter((p: any) => (p["@type"] ?? "").toLowerCase() !== "own")
                // deno-lint-ignore no-explicit-any
                .map((p: any) => p["@id"] ?? p["@player_id"] ?? "")
                .filter(Boolean);

            scorerIdsStr = [
              ...extractIds(gs?.localteam),
              ...extractIds(gs?.visitorteam),
            ].join(",");
          }
        }
      }

      // ── Step 4: POST to settle-match edge function ──────────────────
      const winnerStr = winner === 0 ? "home" : winner === 1 ? "draw" : "away";
      const scorerIds = scorerIdsStr
        ? scorerIdsStr.split(",").filter(Boolean)
        : [];

      const settleResp = sendRequester
        .sendRequest({
          method: "POST",
          url: `${config.supabaseUrl}/functions/v1/settle-match`,
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            match_id: dbMatch.id,
            winner: winnerStr,
            home_goals: homeGoals,
            away_goals: awayGoals,
            goal_scorer_player_ids: scorerIds,
          }),
        })
        .result();

      // 200 = settled now; 409 = already settled by another node — both are success
      const settled =
        settleResp.statusCode === 200 || settleResp.statusCode === 409 ? 1 : 0;

      return {
        found: 1,
        supabaseMatchId: dbMatch.id,
        externalMatchId: dbMatch.external_match_id,
        winner,
        homeGoals,
        awayGoals,
        scorerIdsStr,
        settled,
      };
    }
  }

  return empty;
};

const settlementAggregation = ConsensusAggregationByFields<SettlementData>({
  found: median,
  supabaseMatchId: identical,
  externalMatchId: identical,
  winner: median,
  homeGoals: median,
  awayGoals: median,
  scorerIdsStr: identical,
  settled: median,
});

// ─────────────────────────────────────────────────────────────────────
//  Trigger handler
// ─────────────────────────────────────────────────────────────────────

/**
 * Runs on every cron tick. Each DON node independently queries Supabase +
 * Goalserve, finds any FT match, and POSTs to the settle-match edge function.
 * First node to succeed settles; the rest receive 409 and return settled=0.
 */
const runSettlement = (runtime: Runtime<Config>, label: string): string => {
  runtime.log("═════════════════════════════════════════════════");
  runtime.log(`goal.live CRE: ${label}`);
  runtime.log("═════════════════════════════════════════════════");

  const httpClient = new cre.capabilities.HTTPClient();
  const result = httpClient
    .sendRequest(runtime, fetchAndSettle, settlementAggregation)(runtime.config)
    .result();

  if (!result.found) {
    runtime.log("No FT matches found — nothing to settle this cycle");
    return "no-op";
  }

  const winnerLabel = (["HOME", "DRAW", "AWAY"] as const)[result.winner];
  runtime.log(`FT match: ${result.externalMatchId}`);
  runtime.log(`Score: ${result.homeGoals}–${result.awayGoals}  Winner: ${winnerLabel}`);
  runtime.log(`Scorers: ${result.scorerIdsStr || "(none recorded)"}`);

  if (result.settled) {
    runtime.log(`✓ settle-match succeeded (supabaseMatchId: ${result.supabaseMatchId})`);
  } else {
    runtime.log(
      "settle-match returned an unexpected status — check edge function logs",
    );
  }

  runtime.log("═════════════════════════════════════════════════");
  return result.settled ? "settled" : "error";
};

const onCronTrigger = (
  runtime: Runtime<Config>,
  _payload: CronPayload,
): string => runSettlement(runtime, "Settlement Check (cron)");

// ─────────────────────────────────────────────────────────────────────
//  Workflow initialisation
// ─────────────────────────────────────────────────────────────────────

const initWorkflow = (config: Config) => {
  const cronTrigger = new cre.capabilities.CronCapability();

  return [
    // Polls Goalserve every `config.schedule` seconds.
    // When a tracked match shows FT, POSTs to settle-match edge function.
    cre.handler(
      cronTrigger.trigger({ schedule: config.schedule }),
      onCronTrigger,
    ),
  ];
};

// ─────────────────────────────────────────────────────────────────────
//  Entry point
// ─────────────────────────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
