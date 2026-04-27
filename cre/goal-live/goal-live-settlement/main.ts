/**
 * goal.live — Match Settlement Workflow (StatsPerform edition)
 *
 * Cron Trigger (every 60 s):
 *   1. HTTP → Supabase REST       : fetch matches with status IN ('live','halftime')
 *                                    WHERE statsperform_match_id IS NOT NULL
 *   2. HTTP → StatsPerform OAuth   : POST client_credentials → bearer token
 *   3. HTTP → StatsPerform MA1     : per-match live status check (FullTime detection)
 *   4. HTTP → StatsPerform MA3     : goal scorer IDs for the first FT match
 *   5. HTTP → settle-match edge fn : POST result → updates Supabase bets + calls
 *                                    GoalLiveBetting.settleMatch() on-chain
 *
 * Each DON node independently runs steps 1–5 during the consensus phase.
 * settle-match is idempotent: the first node to succeed settles the match
 * (status → finished, bets → settled_won/lost). Subsequent nodes receive
 * HTTP 409 "Match already settled" and return `settled = 0` — no-op.
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

// ───────────────────────────────────────────────────────────────────
//  Config schema (validated by CRE runtime from config.staging.json)
// ───────────────────────────────────────────────────────────────────

const configSchema = z.object({
  /** Cron schedule, e.g. "*/60 * * * * *" */
  schedule: z.string(),
  /** Supabase project URL */
  supabaseUrl: z.string(),
  /** Supabase anon key — used as apikey header for REST and edge fn calls */
  supabaseAnonKey: z.string(),
  /** StatsPerform trial API key */
  spApiKey: z.string(),
  /** StatsPerform OAuth client_id */
  spClientId: z.string(),
  /** StatsPerform OAuth client_secret */
  spClientSecret: z.string(),
  /** StatsPerform OAuth URL (default provided) */
  spOauthUrl: z
    .string()
    .default(
      "https://api.statsperform.com/realms/apigw/protocol/openid-connect/token",
    ),
  /** StatsPerform API base URL (default provided) */
  spBaseUrl: z.string().default("https://api.statsperform.com/sdapi/v1"),
});

type Config = z.infer<typeof configSchema>;

// ───────────────────────────────────────────────────────────────────
//  Data shapes
// ───────────────────────────────────────────────────────────────────

interface SupabaseMatch {
  id: string;               // Supabase UUID
  external_match_id: string;
  statsperform_match_id: string;
}

/**
 * Consensus-aggregatable settlement payload.
 * `found = 1` when a FullTime match is ready; `found = 0` means nothing this cycle.
 * `settled = 1` when settle-match returned 200 (settled now) or 409 (already settled).
 */
interface SettlementData {
  found: number;
  supabaseMatchId: string;
  externalMatchId: string;
  /** 0 = HOME, 1 = DRAW, 2 = AWAY */
  winner: number;
  homeGoals: number;
  awayGoals: number;
  /** Comma-separated StatsPerform player IDs, e.g. "abc123,xyz456" */
  scorerIdsStr: string;
  /** 1 if settle-match returned 200 or 409 */
  settled: number;
}

// ───────────────────────────────────────────────────────────────────
//  HTTP fetch + settle function (runs on each DON node, results aggregated)
// ───────────────────────────────────────────────────────────────────

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Called by cre.capabilities.HTTPClient.sendRequest() on each DON node.
 *
 * Steps:
 *  1. Query Supabase for live/halftime matches with statsperform_match_id.
 *  2. POST StatsPerform OAuth to get bearer token.
 *  3. MA1 call per match to detect FullTime.
 *  4. MA3 call for goal scorer IDs on the first FT match.
 *  5. POST to settle-match edge function.
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

  // ── Step 1: Supabase — get live/halftime matches with StatsPerform IDs ─────
  const sbResp = sendRequester
    .sendRequest({
      method: "GET",
      url:
        `${config.supabaseUrl}/rest/v1/matches` +
        `?status=in.(live,halftime)` +
        `&statsperform_match_id=not.is.null` +
        `&select=id,external_match_id,statsperform_match_id`,
      headers: authHeaders,
    })
    .result();

  if (sbResp.statusCode !== 200) return empty;

  const liveMatches: SupabaseMatch[] = JSON.parse(
    Buffer.from(sbResp.body).toString("utf-8"),
  );
  if (!liveMatches.length) return empty;

  // ── Step 2: StatsPerform OAuth ─────────────────────────────────────────
  const oauthBody =
    `grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(config.spClientId)}` +
    `&client_secret=${encodeURIComponent(config.spClientSecret)}`;

  const oauthResp = sendRequester
    .sendRequest({
      method: "POST",
      url: `${config.spOauthUrl}?apikey=${config.spApiKey}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: oauthBody,
    })
    .result();

  if (oauthResp.statusCode !== 200) return empty;

  // deno-lint-ignore no-explicit-any
  const oauthData: any = JSON.parse(
    Buffer.from(oauthResp.body).toString("utf-8"),
  );
  const spToken: string = oauthData.access_token ?? "";
  if (!spToken) return empty;

  const spAuthHeader = { Authorization: `Bearer ${spToken}` };

  // ── Steps 3–4: For each match, MA1 → find FullTime → MA3 for scorers ─────
  for (const dbMatch of liveMatches) {
    const spMatchId = dbMatch.statsperform_match_id;
    if (!spMatchId) continue;

    // MA1: single-match live data
    const ma1Resp = sendRequester
      .sendRequest({
        method: "GET",
        url: `${config.spBaseUrl}/soccerdata/match/${spMatchId}?live=yes&_fmt=json`,
        headers: spAuthHeader,
      })
      .result();

    if (ma1Resp.statusCode !== 200) continue;

    // deno-lint-ignore no-explicit-any
    const ma1Data: any = JSON.parse(
      Buffer.from(ma1Resp.body).toString("utf-8"),
    );
    const matches = toArray(ma1Data?.match);
    if (matches.length === 0) continue;

    // deno-lint-ignore no-explicit-any
    const m: any = matches[0];
    const details = m?.liveData?.matchDetails ?? {};
    const matchStatus: string = details?.matchStatus ?? "Fixture";
    const periodId: number =
      parseInt(String(details?.periodId ?? "0"), 10) || 0;

    const isFullTime =
      matchStatus === "FullTime" ||
      matchStatus === "Full-time" ||
      periodId >= 5;

    if (!isFullTime) continue;

    // Found a FullTime match — extract score
    const scoreNode =
      details?.scores?.total ?? details?.scores?.ft ?? details?.score ?? null;
    const homeGoals: number =
      scoreNode?.home != null ? parseInt(String(scoreNode.home), 10) : 0;
    const awayGoals: number =
      scoreNode?.away != null ? parseInt(String(scoreNode.away), 10) : 0;
    const winner = homeGoals > awayGoals ? 0 : awayGoals > homeGoals ? 2 : 1;

    // Extract home contestant ID for MA3 team attribution
    const contestants = toArray(m?.matchInfo?.contestant ?? []);
    // deno-lint-ignore no-explicit-any
    const homeContestant = contestants.find((c: any) => c.position === "home");
    // deno-lint-ignore no-explicit-any
    const homeContestantId: string = (homeContestant as any)?.id ?? "";

    // ── Step 4: MA3 — goal scorer IDs ─────────────────────────────────
    let scorerIdsStr = "";

    const ma3Resp = sendRequester
      .sendRequest({
        method: "GET",
        url: `${config.spBaseUrl}/soccerdata/matchevent/?fx=${spMatchId}&_fmt=json`,
        headers: spAuthHeader,
      })
      .result();

    if (ma3Resp.statusCode === 200) {
      // deno-lint-ignore no-explicit-any
      const ma3Data: any = JSON.parse(
        Buffer.from(ma3Resp.body).toString("utf-8"),
      );
      const events = toArray(
        ma3Data?.matchEventFeed?.event ?? ma3Data?.liveData?.event ?? [],
      );

      const scorerIds: string[] = [];
      for (const ev of events) {
        const typeId: number = parseInt(String(ev?.typeId ?? "0"), 10);
        if (typeId !== 16) continue; // only Goals

        // Check for own goal (qualifierId 55)
        const quals = toArray(ev?.qualifier ?? []);
        // deno-lint-ignore no-explicit-any
        const isOwnGoal = quals.some((q: any) => String(q?.qualifierId) === "55");
        if (isOwnGoal) continue;

        // Attribute to scoring team (not own-goal side)
        const contestantId: string = ev?.contestantId ?? "";
        const team = contestantId === homeContestantId ? "home" : "away";

        // Only include if scoring team matches expected side
        // (own goals by away team count for home — already excluded above)
        const playerId: string = String(ev?.playerId ?? "");
        if (playerId && playerId !== "unknown") scorerIds.push(playerId);
        void team; // used for future filtering
      }
      scorerIdsStr = scorerIds.join(",");
    }

    // ── Step 5: POST to settle-match edge function ────────────────────
    const winnerStr = winner === 0 ? "home" : winner === 1 ? "draw" : "away";
    const scorerIds = scorerIdsStr ? scorerIdsStr.split(",").filter(Boolean) : [];

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

// ───────────────────────────────────────────────────────────────────
//  Trigger handler
// ───────────────────────────────────────────────────────────────────

/**
 * Runs on every cron tick. Each DON node independently queries Supabase +
 * StatsPerform, finds any FullTime match, and POSTs to the settle-match
 * edge function. First node to succeed settles; the rest receive 409.
 */
const runSettlement = (runtime: Runtime<Config>, label: string): string => {
  runtime.log("═════════════════════════════════════════════════");
  runtime.log(`goal.live CRE (StatsPerform): ${label}`);
  runtime.log("═════════════════════════════════════════════════");

  const httpClient = new cre.capabilities.HTTPClient();
  const result = httpClient
    .sendRequest(runtime, fetchAndSettle, settlementAggregation)(runtime.config)
    .result();

  if (!result.found) {
    runtime.log("No FullTime matches found — nothing to settle this cycle");
    return "no-op";
  }

  const winnerLabel = (["HOME", "DRAW", "AWAY"] as const)[result.winner];
  runtime.log(`FullTime match: ${result.externalMatchId}`);
  runtime.log(
    `Score: ${result.homeGoals}–${result.awayGoals}  Winner: ${winnerLabel}`,
  );
  runtime.log(`Scorers: ${result.scorerIdsStr || "(none recorded)"}`);

  if (result.settled) {
    runtime.log(
      `✓ settle-match succeeded (supabaseMatchId: ${result.supabaseMatchId})`,
    );
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

// ───────────────────────────────────────────────────────────────────
//  Workflow initialisation
// ───────────────────────────────────────────────────────────────────

const initWorkflow = (config: Config) => {
  const cronTrigger = new cre.capabilities.CronCapability();

  return [
    // Polls StatsPerform every `config.schedule` seconds.
    // When a tracked match shows FullTime, POSTs to settle-match edge function.
    cre.handler(
      cronTrigger.trigger({ schedule: config.schedule }),
      onCronTrigger,
    ),
  ];
};

// ───────────────────────────────────────────────────────────────────
//  Entry point
// ───────────────────────────────────────────────────────────────────

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
