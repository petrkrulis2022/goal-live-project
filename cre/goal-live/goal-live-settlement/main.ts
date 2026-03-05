/**
 * goal.live — Match Settlement Workflow
 *
 * Cron Trigger (every 60 s):
 *   1. HTTP → Supabase REST  : fetch matches with status IN ('live','halftime')
 *   2. HTTP → Goalserve feed : check each match for 'FT' status
 *   3. HTTP → Goalserve commentary : get goal scorer IDs for first FT match
 *   4. EVM Write (onReport) : settle the match on-chain via GoalLiveBetting
 *
 * EVM Log Trigger (MatchCreated event on GoalLiveBetting):
 *   - Fires when a new match is registered on-chain
 *   - Logs the event details (matchId hash + timestamp)
 *
 * Settlement payload uses encodeAbiParameters mirroring the Solidity
 * abi.decode in GoalLiveBetting.onReport():
 *   abi.encode(matchId, goalScorers[], winner, homeGoals, awayGoals)
 *
 * KeystoneForwarder on Sepolia: 0x15fc6ae953e024d975e77382eeec56a9101f9f88
 * (Deployer sets keystoneForwarder = oracle initially so CRE simulation works
 *  out-of-the-box; call setKeystoneForwarder() in production.)
 */

import {
  bytesToHex,
  ConsensusAggregationByFields,
  type CronPayload,
  cre,
  type EVMLog,
  getNetwork,
  hexToBase64,
  identical,
  type HTTPSendRequester,
  median,
  Runner,
  type Runtime,
  TxStatus,
} from "@chainlink/cre-sdk";
import { type Address, encodeAbiParameters } from "viem";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────
//  Config schema (validated by CRE runtime from config.staging.json)
// ─────────────────────────────────────────────────────────────────────

const configSchema = z.object({
  // Cron schedule, e.g. "*/60 * * * * *"
  schedule: z.string(),
  /** Supabase project URL, e.g. https://xyz.supabase.co */
  supabaseUrl: z.string(),
  /** Supabase anon (public) key for read-only REST queries */
  supabaseAnonKey: z.string(),
  /** Goalserve API key */
  goalserveApiKey: z.string(),
  /** GoalLiveBetting singleton contract address on Sepolia */
  contractAddress: z.string(),
  /** Chainlink chain selector name, e.g. "ethereum-testnet-sepolia" */
  chainSelectorName: z.string(),
  /** Gas limit for onReport EVM write */
  gasLimit: z.string(),
});

type Config = z.infer<typeof configSchema>;

// ─────────────────────────────────────────────────────────────────────
//  ABI parameters for settlement payload
//  Must mirror GoalLiveBetting.onReport abi.decode(report, (string, uint256[], uint8, uint8, uint8))
// ─────────────────────────────────────────────────────────────────────

const SETTLE_ABI_PARAMS = [
  { type: "string", name: "matchId" },
  { type: "uint256[]", name: "goalScorers" },
  { type: "uint8", name: "winner" },
  { type: "uint8", name: "homeGoals" },
  { type: "uint8", name: "awayGoals" },
] as const;

// ─────────────────────────────────────────────────────────────────────
//  Consensus helpers
// ─────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────
//  Data shapes
// ─────────────────────────────────────────────────────────────────────

interface SupabaseMatch {
  id: string;
  external_match_id: string;
  goalserve_static_id: string;
  contract_address: string | null;
}

/**
 * Consensus-aggregatable settlement payload.
 * `found = 1` and the rest is populated only when a FT match is ready.
 * `found = 0` means nothing to settle this cycle.
 */
interface SettlementData {
  found: number;
  externalMatchId: string;
  /** 0 = HOME, 1 = DRAW, 2 = AWAY */
  winner: number;
  homeGoals: number;
  awayGoals: number;
  /** Comma-separated Goalserve player IDs, e.g. "1234,5678" */
  scorerIdsStr: string;
  contractAddress: string;
}

// ─────────────────────────────────────────────────────────────────────
//  HTTP fetch function (runs on each DON node, results are aggregated)
// ─────────────────────────────────────────────────────────────────────

/** Normalise Goalserve arrays/objects to always-array. */
function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (val == null) return [];
  return Array.isArray(val) ? val : [val];
}

/**
 * Called by cre.capabilities.HTTPClient.sendRequest() on each DON node.
 * Queries Supabase for live matches, checks Goalserve for FT status,
 * fetches goal scorers from commentary, and returns structured settlement data.
 */
const fetchSettlementData = (
  sendRequester: HTTPSendRequester,
  config: Config,
): SettlementData => {
  const empty: SettlementData = {
    found: 0,
    externalMatchId: "",
    winner: 1,
    homeGoals: 0,
    awayGoals: 0,
    scorerIdsStr: "",
    contractAddress: config.contractAddress,
  };

  // ── Step 1: Supabase — get live/halftime matches ────────────────────────
  const sbResp = sendRequester
    .sendRequest({
      method: "GET",
      url: `${config.supabaseUrl}/rest/v1/matches?status=in.(live,halftime)&select=id,external_match_id,goalserve_static_id,contract_address`,
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
      },
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

      return {
        found: 1,
        externalMatchId: dbMatch.external_match_id,
        winner,
        homeGoals,
        awayGoals,
        scorerIdsStr,
        contractAddress: dbMatch.contract_address ?? config.contractAddress,
      };
    }
  }

  return empty;
};

const settlementAggregation = ConsensusAggregationByFields<SettlementData>({
  found: median,
  externalMatchId: identical,
  winner: median,
  homeGoals: median,
  awayGoals: median,
  scorerIdsStr: identical,
  contractAddress: identical,
});

// ─────────────────────────────────────────────────────────────────────
//  Trigger handlers
// ─────────────────────────────────────────────────────────────────────

/**
 * Cron trigger handler — runs every `config.schedule` interval.
 * Fetches match data, checks for FT status, and writes settlement reports.
 */
const onCronTrigger = (
  runtime: Runtime<Config>,
  _payload: CronPayload,
): string => {
  runtime.log("═════════════════════════════════════════════════");
  runtime.log("goal.live CRE: Settlement Check");
  runtime.log("═════════════════════════════════════════════════");

  // Run decentralised HTTP consensus across DON nodes
  const httpClient = new cre.capabilities.HTTPClient();
  const settlementData = httpClient
    .sendRequest(runtime, fetchSettlementData, settlementAggregation)(
      runtime.config,
    )
    .result();

  if (!settlementData.found) {
    runtime.log("No FT matches found — nothing to settle this cycle");
    return "no-op";
  }

  runtime.log(`FT match detected: ${settlementData.externalMatchId}`);
  runtime.log(
    `Final score: ${settlementData.homeGoals}–${settlementData.awayGoals}`,
  );
  const winnerLabel = (["HOME", "DRAW", "AWAY"] as const)[
    settlementData.winner
  ];
  runtime.log(`Winner: ${winnerLabel}`);
  runtime.log(
    `Goal scorers: ${settlementData.scorerIdsStr || "(none recorded)"}`,
  );

  // Parse scorer IDs (Goalserve integer IDs → uint256)
  const scorerIds = settlementData.scorerIdsStr
    ? settlementData.scorerIdsStr
        .split(",")
        .filter(Boolean)
        .map((id) => BigInt(id))
    : [];

  // Get EVM network descriptor
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.chainSelectorName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(
      `Network not found for selector: ${runtime.config.chainSelectorName}`,
    );
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector,
  );

  // Encode settlement payload — mirrors GoalLiveBetting.onReport abi.decode
  const reportData = encodeAbiParameters(SETTLE_ABI_PARAMS, [
    settlementData.externalMatchId,
    scorerIds,
    settlementData.winner,
    settlementData.homeGoals,
    settlementData.awayGoals,
  ]);

  runtime.log("Generating signed CRE report...");

  // Generate cryptographically signed report (DON consensus + ECDSA)
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  runtime.log(
    `Writing settlement report to contract: ${settlementData.contractAddress}`,
  );

  // Submit via CRE EVM Write → Chainlink KeystoneForwarder → GoalLiveBetting.onReport()
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: settlementData.contractAddress as Address,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.gasLimit,
      },
    })
    .result();

  if (writeResult.txStatus !== TxStatus.SUCCESS) {
    throw new Error(
      `EVM write failed: ${writeResult.errorMessage ?? writeResult.txStatus}`,
    );
  }

  const txHash = bytesToHex(writeResult.txHash ?? new Uint8Array(32));
  runtime.log(`✓ Match settled on-chain! txHash: ${txHash}`);
  runtime.log("═════════════════════════════════════════════════");

  return txHash;
};

/**
 * EVM Log trigger handler — fires when MatchCreated is emitted by GoalLiveBetting.
 * Used to track newly registered matches and prepare the settlement pipeline.
 *
 * MatchCreated(string indexed matchId, uint256 timestamp)
 *   topics[0] = keccak256("MatchCreated(string,uint256)")
 *   topics[1] = keccak256(matchId)     ← indexed string is hashed by Solidity
 *   data       = abi.encode(timestamp) ← non-indexed fields
 */
const onLogTrigger = (runtime: Runtime<Config>, payload: EVMLog): string => {
  runtime.log("═════════════════════════════════════════════════");
  runtime.log("goal.live CRE: MatchCreated Log Trigger");
  runtime.log("═════════════════════════════════════════════════");

  const topics = payload.topics;
  if (topics.length < 2) {
    runtime.log("Unexpected log — insufficient topics");
    return "skip";
  }

  // topics[1] is keccak256(matchId) — Solidity hashes indexed strings
  const matchIdHash = bytesToHex(topics[1]);
  runtime.log(`New match created on-chain — matchId hash: ${matchIdHash}`);
  runtime.log("CRE settlement pipeline is now active for this match");
  runtime.log("═════════════════════════════════════════════════");

  return matchIdHash;
};

// ─────────────────────────────────────────────────────────────────────
//  Workflow initialisation
// ─────────────────────────────────────────────────────────────────────

const initWorkflow = (config: Config) => {
  const cronTrigger = new cre.capabilities.CronCapability();

  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.chainSelectorName,
    isTestnet: true,
  });
  if (!network) {
    throw new Error(`Chain selector not found: ${config.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector,
  );

  return [
    // Polls Goalserve every minute — settles any FT matches on-chain
    cre.handler(
      cronTrigger.trigger({ schedule: config.schedule }),
      onCronTrigger,
    ),
    // Listens for MatchCreated events from the GoalLiveBetting contract
    cre.handler(
      evmClient.logTrigger({
        addresses: [hexToBase64(config.contractAddress)],
      }),
      onLogTrigger,
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
