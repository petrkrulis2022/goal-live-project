import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import type {
  DbMatch,
  DbPlayer,
  DbBet,
  DbGoalEvent,
} from "@shared/lib/supabase";
import { contractService } from "../services/contractService";
import { MATCH_REGISTRY } from "@shared/data/matchRegistry";
import { CREWorkflowPanel } from "../components/CREWorkflowPanel";

const ODDS_API_KEY = "8d90e1a5fa443922e69844377834c0ab";
// Note: Goalserve key is baked into the Vite proxy rewrite (vite.admin.config.ts)

// Goalserve league ID ↔ Odds-API sport key (used as bidirectional fallback)
const GS_LEAGUE_TO_SPORT: Record<string, string> = {
  "1204": "soccer_epl",
  "1399": "soccer_spain_la_liga",
  "1269": "soccer_italy_serie_a",
  "1221": "soccer_france_ligue_one",
  "1005": "soccer_uefa_champs_league",
  "1007": "soccer_uefa_europa_league",
  "1009": "soccer_uefa_europa_conference_league",
  "18853": "soccer_uefa_europa_conference_league",
};

// Last-resort: goalserve static_id → Odds-API sport (for old rows with no odds_api_config)
const STATIC_ID_TO_ODDSAPI_SPORT: Record<string, string> = {
  "3693262": "soccer_spain_la_liga", // Osasuna vs Mallorca
};

/** Resolve Odds-API sport string from a DB match row */
function resolveOddsApiSport(m: {
  goalserve_static_id?: string | null;
  odds_api_config?: unknown;
}): string {
  const cfg = m.odds_api_config as Record<string, string> | undefined;
  return (
    cfg?.sport ??
    (cfg?.goalserve_league
      ? GS_LEAGUE_TO_SPORT[cfg.goalserve_league]
      : undefined) ??
    (m.goalserve_static_id
      ? STATIC_ID_TO_ODDSAPI_SPORT[m.goalserve_static_id]
      : undefined) ??
    "soccer_epl"
  );
}

// Sepolia on-chain constants
const SEPOLIA_RPC = "https://sepolia.drpc.org";
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const HEDERA_RPC = "https://testnet.hashio.io/api";
const USDC_HEDERA = "0x00000000000000000000000000000000006e169c"; // USDd

/** Detect which chain a match runs on from odds_api_config.network */
function getMatchNetwork(m: {
  odds_api_config?: unknown;
}): "hedera" | "sepolia" {
  const cfg = m.odds_api_config as Record<string, string> | undefined;
  return cfg?.network === "hedera" ? "hedera" : "sepolia";
}

/** Returns stablecoin balance (6 decimals) of the contract on its network */
async function fetchUsdcBalance(
  address: string,
  network: "hedera" | "sepolia" = "sepolia",
): Promise<number> {
  const rpc = network === "hedera" ? HEDERA_RPC : SEPOLIA_RPC;
  const token = network === "hedera" ? USDC_HEDERA : USDC_SEPOLIA;
  const data = "0x70a08231" + address.slice(2).padStart(64, "0");
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_call",
      params: [{ to: token, data }, "latest"],
      id: 1,
    }),
  });
  const json = await res.json();
  if (!json.result || json.result === "0x") return 0;
  return parseInt(json.result, 16) / 1_000_000;
}

type Tab = "overview" | "players" | "bets" | "goals" | "oracle";

// ── Lineup types ──────────────────────────────────────────────────────────────
export interface LineupPlayer {
  num: string;
  name: string;
  pos: string;
}
export interface TeamLineup {
  starters: LineupPlayer[];
  subs: LineupPlayer[];
}
export interface MatchLineup {
  home: TeamLineup;
  away: TeamLineup;
}

function toArr<T>(x: T | T[] | null | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function parseLineupPlayers(teamNode: any): LineupPlayer[] {
  if (!teamNode) return [];
  return toArr(teamNode.player as any)
    .filter((p: any) => p && p["@name"])
    .map((p: any) => ({
      num: p["@number"] ?? p["@num"] ?? "",
      name: p["@name"] ?? "",
      pos: p["@pos"] ?? "",
    }));
}

// ── Players tab: two sub-tabs (home / away), lineup + scorer odds ─────────────
function PlayersTab({
  players,
  lineup,
  match,
}: {
  players: DbPlayer[];
  lineup: MatchLineup | null;
  match: DbMatch | null;
}) {
  const [side, setSide] = useState<"home" | "away">("home");
  const homeLabel = match?.home_team ?? "Home";
  const awayLabel = match?.away_team ?? "Away";

  const lineupSide: TeamLineup = lineup
    ? side === "home"
      ? lineup.home
      : lineup.away
    : { starters: [], subs: [] };

  const oddsPlayers = players.filter((p) => p.team === side);

  function PlayerRow({ p }: { p: LineupPlayer }) {
    const oddsMatch = players.find(
      (op) =>
        op.name
          .toLowerCase()
          .includes(p.name.split(" ").slice(-1)[0].toLowerCase()) ||
        p.name
          .toLowerCase()
          .includes(op.name.split(" ").slice(-1)[0].toLowerCase()),
    );
    return (
      <tr className="hover:bg-white/2 transition-colors">
        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs w-10">
          {p.num || "—"}
        </td>
        <td className="px-4 py-2.5 font-medium text-gray-200">{p.name}</td>
        <td className="px-4 py-2.5 text-gray-500 text-xs">{p.pos || "—"}</td>
        <td className="px-4 py-2.5 font-mono font-bold text-green-400">
          {oddsMatch && oddsMatch.odds > 1 ? (
            `${oddsMatch.odds}×`
          ) : (
            <span className="text-gray-700">—</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {(["home", "away"] as const).map((s) => {
          const label = s === "home" ? homeLabel : awayLabel;
          const stCount = lineup
            ? (s === "home" ? lineup.home : lineup.away).starters.length
            : 0;
          const active = side === s;
          return (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
                active
                  ? s === "home"
                    ? "bg-blue-500/15 text-blue-300 border-blue-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
                  : "bg-gray-900/40 text-gray-500 border-white/5 hover:text-gray-300"
              }`}
            >
              {label}
              {stCount > 0 && (
                <span className="ml-2 text-[11px] opacity-60">
                  ({stCount} XI)
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lineup table */}
      {lineupSide.starters.length > 0 ? (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5 bg-gray-950/40 font-semibold">
            Starting XI
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Pos</th>
                <th className="px-4 py-2 font-medium">Odds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {lineupSide.starters.map((p, i) => (
                <PlayerRow key={i} p={p} />
              ))}
            </tbody>
          </table>
          {lineupSide.subs.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-t border-b border-white/5 bg-gray-950/40 font-semibold">
                Substitutes
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/4">
                  {lineupSide.subs.map((p, i) => (
                    <PlayerRow key={i} p={p} />
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ) : oddsPlayers.length > 0 ? (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5 bg-gray-950/40 font-semibold">
            Squad (from DB — Goalserve lineup pending)
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5">
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Pos</th>
                <th className="px-4 py-2 font-medium">Odds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {oddsPlayers.map((p) => (
                <tr key={p.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-2.5 text-gray-500 font-mono text-xs w-10">
                    {p.jersey_number ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-200">
                    {p.name}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {p.position ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono font-bold text-green-400">
                    {p.odds > 1 ? (
                      `${p.odds}×`
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl px-4 py-4 text-gray-600 text-xs text-center">
          {lineup === null
            ? "Fetching Goalserve lineup…"
            : "Lineup not confirmed yet — will appear when Goalserve publishes it"}
        </div>
      )}

      {/* Scorer odds from Odds API */}
      {oddsPlayers.length > 0 &&
        (() => {
          const withOdds = oddsPlayers.filter((p) => p.odds > 1);
          return (
            <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
              <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5 bg-gray-950/40 font-semibold">
                Scorer Odds (Odds API) — {withOdds.length} players
              </div>
              {withOdds.length === 0 ? (
                <div className="px-4 py-4 text-gray-600 text-xs text-center">
                  No scorer odds available from Odds API (market may not be open
                  yet)
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5">
                      <th className="px-4 py-2 font-medium">#</th>
                      <th className="px-4 py-2 font-medium">Name</th>
                      <th className="px-4 py-2 font-medium">Pos</th>
                      <th className="px-4 py-2 font-medium">Odds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {withOdds.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-white/2 transition-colors"
                      >
                        <td className="px-4 py-2.5 text-gray-500 font-mono text-xs w-10">
                          {p.jersey_number ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-gray-200">
                          {p.name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {p.position ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-green-400">
                          {p.odds}×
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })()}
    </div>
  );
}

export default function EventDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const nav = useNavigate();

  const [match, setMatch] = useState<DbMatch | null>(null);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [bets, setBets] = useState<DbBet[]>([]);
  const [goals, setGoals] = useState<DbGoalEvent[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [lineup, setLineup] = useState<MatchLineup | null>(null);
  const goalserveDiscoveredId = useRef<string>("0");

  // Oracle panel state
  const [goalForm, setGoalForm] = useState({
    playerId: "",
    playerName: "",
    team: "home" as "home" | "away",
    minute: 1,
  });
  const [oracleBusy, setOracleBusy] = useState(false);
  const [oracleTx, setOracleTx] = useState<string | null>(null);
  const [oracleBalancesTx, setOracleBalancesTx] = useState<string | null>(null);
  const [oracleError, setOracleError] = useState<string | null>(null);
  const [withdrawFeesBusy, setWithdrawFeesBusy] = useState(false);
  const [withdrawFeesTx, setWithdrawFeesTx] = useState<string | null>(null);
  const [withdrawFeesError, setWithdrawFeesError] = useState<string | null>(
    null,
  );
  const [settleData, setSettleData] = useState<{
    settled?: Array<{
      bettor: string;
      bet_type: string;
      status: string;
      payout: number;
    }>;
    total_payout?: number;
    match?: { score: string; winner: string; home: string; away: string };
  } | null>(null);
  const [contractUsdcBalance, setContractUsdcBalance] = useState<number | null>(
    null,
  );
  const [contractBalanceLoading, setContractBalanceLoading] = useState(false);

  const [h2h, setH2h] = useState<{
    home: number;
    draw: number;
    away: number;
    bookmaker: string;
  } | null>(null);

  const [cornerOddsHome, setCornerOddsHome] = useState<number>(1.9);
  const [cornerOddsAway, setCornerOddsAway] = useState<number>(1.9);
  const [cornerOddsSaving, setCornerOddsSaving] = useState(false);
  const [cornerOddsSavedMsg, setCornerOddsSavedMsg] = useState<string | null>(
    null,
  );

  async function fetchMatchOdds(m: DbMatch) {
    try {
      const sport = resolveOddsApiSport(m);
      const res = await fetch(
        `/api/odds/sports/${sport}/events/${m.external_match_id}/odds?apiKey=${ODDS_API_KEY}&markets=h2h&bookmakers=betfair_ex_eu&oddsFormat=decimal`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.message) return; // quota error
      const bm = data.bookmakers?.[0];
      if (!bm) return;
      const mkt = bm.markets?.find((mk: { key: string }) => mk.key === "h2h");
      if (!mkt) return;
      const newH2h = {
        home:
          mkt.outcomes.find((o: { name: string }) => o.name === data.home_team)
            ?.price ?? 0,
        draw:
          mkt.outcomes.find((o: { name: string }) => o.name === "Draw")
            ?.price ?? 0,
        away:
          mkt.outcomes.find((o: { name: string }) => o.name === data.away_team)
            ?.price ?? 0,
      };
      setH2h({ ...newH2h, bookmaker: bm.title });
      // Write back to Supabase — update BOTH dedicated columns (triggers Realtime
      // to extension instantly) and legacy JSON blob for backward compat.
      const existingCfg = (m.odds_api_config ?? {}) as Record<string, unknown>;
      await supabase
        .from("matches")
        .update({
          odds_api_config: { ...existingCfg, match_winner_odds: newH2h },
          odds_home: newH2h.home,
          odds_draw: newH2h.draw,
          odds_away: newH2h.away,
        })
        .eq("id", m.id);
    } catch {
      // silent
    }
  }

  async function saveCornerOdds(m: DbMatch) {
    setCornerOddsSaving(true);
    setCornerOddsSavedMsg(null);
    try {
      const existingCfg = (m.odds_api_config ?? {}) as Record<string, unknown>;
      await supabase
        .from("matches")
        .update({
          odds_api_config: {
            ...existingCfg,
            corner_odds: { home: cornerOddsHome, away: cornerOddsAway },
          },
        })
        .eq("id", m.id);
      setCornerOddsSavedMsg(
        `Saved: ${cornerOddsHome.toFixed(2)}× / ${cornerOddsAway.toFixed(2)}×`,
      );
    } catch {
      setCornerOddsSavedMsg("Save failed");
    } finally {
      setCornerOddsSaving(false);
    }
  }

  async function reseedPlayers(m: DbMatch) {
    if (
      !window.confirm(
        "Delete all players for this match and re-seed from Odds API?",
      )
    )
      return;
    await supabase.from("players").delete().eq("match_id", m.id);
    setPlayers([]);
    const lu = await fetchGoalserveLineup(m);
    await fetchNGSOdds(m, [], lu);
  }

  async function fetchGoalserveLineup(m: DbMatch): Promise<MatchLineup | null> {
    try {
      // Find goalserve config from match registry
      const cfg = Object.values(MATCH_REGISTRY).find(
        (c) => c.matchId === m.external_match_id,
      );

      // Determine correct Goalserve league: registry first, then from odds_api_config sport key
      const SPORT_TO_GS_LEAGUE: Record<string, string> = {
        soccer_epl: "1204",
        soccer_spain_la_liga: "1399",
        soccer_italy_serie_a: "1269",
        soccer_france_ligue_one: "1221",
        soccer_uefa_champs_league: "1005",
        soccer_uefa_europa_league: "1007",
        soccer_uefa_europa_conference_league: "18853",
      };
      // Fallback map: static_id → league, for matches not in MATCH_REGISTRY
      const STATIC_ID_TO_LEAGUE: Record<string, string> = {
        "3693262": "1399", // Osasuna vs Mallorca (La Liga)
      };
      const sport = (m.odds_api_config as Record<string, string>)?.sport ?? "";
      const gsLeagueFromDb = (m.odds_api_config as Record<string, string>)
        ?.goalserve_league;
      const staticIdForLeague =
        m.goalserve_static_id ?? cfg?.goalserveStaticId ?? "0";
      const league =
        cfg?.goalserveLeague ??
        gsLeagueFromDb ??
        SPORT_TO_GS_LEAGUE[sport] ??
        STATIC_ID_TO_LEAGUE[staticIdForLeague] ??
        "1204";
      // Use persisted static_id from DB first (most reliable)
      let staticId = m.goalserve_static_id ?? cfg?.goalserveStaticId ?? "0";

      // Auto-discover static_id if not set
      if (staticId === "0") {
        if (goalserveDiscoveredId.current !== "0") {
          staticId = goalserveDiscoveredId.current;
        } else {
          const liveRes = await fetch(`/api/goalserve/soccernew/home?json=1`);
          if (!liveRes.ok) return null;
          const liveData = await liveRes.json();
          const homeWord = m.home_team.split(" ")[0].toLowerCase();
          const awayWord = m.away_team.split(" ")[0].toLowerCase();
          const cats: any[] =
            liveData?.newscores?.category ??
            liveData?.scores?.category ??
            (Array.isArray(liveData?.scores) ? liveData.scores : []);
          let foundMatch: any = null;
          for (const cat of cats) {
            const matches: any[] = Array.isArray(cat.match)
              ? cat.match
              : cat.match
                ? [cat.match]
                : [];
            foundMatch = matches.find((mm: any) => {
              const lt = (
                mm.localteam?.["@name"] ??
                mm["@localteam"] ??
                ""
              ).toLowerCase();
              const vt = (
                mm.visitorteam?.["@name"] ??
                mm["@visitorteam"] ??
                ""
              ).toLowerCase();
              return lt.includes(homeWord) || vt.includes(awayWord);
            });
            if (foundMatch) break;
          }
          // Fallback: search commentaries league feed (covers pre-match)
          if (!foundMatch) {
            try {
              const comRes = await fetch(
                `/api/goalserve/commentaries/${league}.xml?json=1`,
              );
              if (comRes.ok) {
                const comData = await comRes.json();
                const tourney = comData?.commentaries?.tournament;
                const comMatches: any[] = tourney
                  ? Array.isArray(tourney.match)
                    ? tourney.match
                    : tourney.match
                      ? [tourney.match]
                      : []
                  : [];
                foundMatch = comMatches.find((mm: any) => {
                  const lt = (
                    mm.localteam?.["@name"] ??
                    mm["@localteam"] ??
                    ""
                  ).toLowerCase();
                  const vt = (
                    mm.visitorteam?.["@name"] ??
                    mm["@visitorteam"] ??
                    ""
                  ).toLowerCase();
                  return lt.includes(homeWord) || vt.includes(awayWord);
                });
              }
            } catch {
              // ignore
            }
          }
          if (!foundMatch) return null;
          const sid = foundMatch["@static_id"] ?? foundMatch["@id"] ?? "";
          if (!sid) return null;
          goalserveDiscoveredId.current = sid;
          staticId = sid;
          // Persist for future loads (fire-and-forget)
          supabase
            .from("matches")
            .update({ goalserve_static_id: sid })
            .eq("id", m.id)
            .then(() => {});
        }
      }

      const res = await fetch(
        `/api/goalserve/commentaries/match?id=${staticId}&league=${league}&json=1`,
      );
      if (!res.ok) return null;
      const data = await res.json();

      const raw: any =
        data?.commentaries?.tournament?.match ??
        data?.commentaries?.match ??
        null;
      if (!raw) return null;
      const matchNode = Array.isArray(raw) ? raw[0] : raw;

      const teamsNode = matchNode.lineup ?? matchNode.teams ?? {};
      const subsNode = matchNode.substitutes ?? {};
      const statsNode = matchNode.player_stats ?? {};

      let homeStarters: LineupPlayer[];
      let awayStarters: LineupPlayer[];
      let homeSubs: LineupPlayer[];
      let awaySubs: LineupPlayer[];

      // Always prefer teamsNode + subsNode — they carry jersey numbers.
      // player_stats (live) omits jersey numbers so we only fall back to it
      // when teamsNode is genuinely empty.
      const hasTeams =
        teamsNode.localteam?.player || teamsNode.visitorteam?.player;
      if (hasTeams) {
        homeStarters = parseLineupPlayers(teamsNode.localteam);
        awayStarters = parseLineupPlayers(teamsNode.visitorteam);
        homeSubs = parseLineupPlayers(subsNode.localteam);
        awaySubs = parseLineupPlayers(subsNode.visitorteam);
      } else if (statsNode?.localteam?.player) {
        // Fallback: live player_stats (no jersey numbers available)
        const allHome = toArr(statsNode.localteam.player)
          .filter((p: any) => p?.["@name"])
          .map((p: any) => ({
            num: p["@number"] ?? p["@num"] ?? "",
            name: p["@name"] ?? "",
            pos: p["@pos"] ?? "",
            isSubst: p["@isSubst"] === "True" || p["@isSubst"] === "true",
          }));
        const allAway = toArr(statsNode.visitorteam?.player)
          .filter((p: any) => p?.["@name"])
          .map((p: any) => ({
            num: p["@number"] ?? p["@num"] ?? "",
            name: p["@name"] ?? "",
            pos: p["@pos"] ?? "",
            isSubst: p["@isSubst"] === "True" || p["@isSubst"] === "true",
          }));
        homeStarters = allHome
          .filter((p) => !p.isSubst)
          .map(({ num, name, pos }) => ({ num, name, pos }));
        homeSubs = allHome
          .filter((p) => p.isSubst)
          .map(({ num, name, pos }) => ({ num, name, pos }));
        awayStarters = allAway
          .filter((p) => !p.isSubst)
          .map(({ num, name, pos }) => ({ num, name, pos }));
        awaySubs = allAway
          .filter((p) => p.isSubst)
          .map(({ num, name, pos }) => ({ num, name, pos }));
      } else {
        homeStarters = [];
        awayStarters = [];
        homeSubs = [];
        awaySubs = [];
      }

      const result: MatchLineup = {
        home: { starters: homeStarters, subs: homeSubs },
        away: { starters: awayStarters, subs: awaySubs },
      };
      setLineup(result);
      return result;
    } catch {
      return null;
    }
  }

  async function fetchNGSOdds(
    m: DbMatch,
    p: DbPlayer[],
    lineupData?: MatchLineup | null,
  ) {
    try {
      const sport = resolveOddsApiSport(m);
      const eventId = m.external_match_id;
      const res = await fetch(
        `/api/odds/sports/${sport}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&markets=player_first_goal_scorer&regions=us,uk,eu&oddsFormat=decimal`,
      );
      // Odds fetch is non-fatal — continue seeding with odds=1 if unavailable
      const data = res.ok ? await res.json() : { bookmakers: [] };

      // Collect best price per player across all bookmakers.
      // Also capture team assignment: some bookmakers set outcome.name = team name
      // and outcome.description = player name. When they differ we can infer team.
      const priceMap = new Map<string, number>();
      const teamMap = new Map<string, "home" | "away">();
      const normHome = (m.home_team ?? "").toLowerCase();
      const normAway = (m.away_team ?? "").toLowerCase();
      for (const bm of data.bookmakers ?? []) {
        const mkt = (bm.markets ?? []).find(
          (mk: { key: string }) => mk.key === "player_first_goal_scorer",
        );
        if (!mkt) continue;
        for (const o of mkt.outcomes ?? []) {
          const pName: string = (o.description ?? o.name ?? "").trim();
          if (pName && o.price && pName.toLowerCase() !== "no scorer") {
            if (!priceMap.has(pName)) priceMap.set(pName, o.price);
            // outcome.name ≠ player name → it's the team name
            if (!teamMap.has(pName) && o.name && o.name !== pName) {
              const tNorm = (o.name as string).toLowerCase();
              if (normHome && tNorm.includes(normHome.split(" ")[0]))
                teamMap.set(pName, "home");
              else if (normAway && tNorm.includes(normAway.split(" ")[0]))
                teamMap.set(pName, "away");
            }
          }
        }
      }

      // Strip accents + lowercase — used in both update and seed paths
      function norm(s: string): string {
        return s
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();
      }

      // ── If players already exist: just UPDATE odds ────────────────────────
      if (p.length > 0) {
        if (priceMap.size === 0) {
          showToast(
            "Odds API: no scorer market open for this event yet",
            "red",
          );
          return;
        }
        // Build normalised price map for fast lookup
        const normPriceMap = new Map<string, number>();
        for (const [n, price] of priceMap) normPriceMap.set(norm(n), price);

        // Iterate DB players and find best Odds API price match
        function findOddsForPlayer(dbName: string): number | null {
          const n = norm(dbName);
          const words = n.split(/\s+/);
          const surname = words[words.length - 1];
          const firstName = words[0];
          // 1. exact normalised full name
          if (normPriceMap.has(n)) return normPriceMap.get(n)!;
          // 2. surname match (last word, min 4 chars)
          if (surname.length >= 4) {
            for (const [oddsNorm, price] of normPriceMap) {
              const oddsSurname = oddsNorm.split(/\s+/).pop() ?? "";
              if (
                oddsSurname === surname ||
                oddsNorm.includes(surname) ||
                n.includes(oddsSurname)
              )
                return price;
            }
          }
          // 3. first-name prefix (handles nicknames: Savinho ↔ Savio…)
          if (firstName.length >= 4) {
            for (const [oddsNorm, price] of normPriceMap) {
              const oddsFirst = oddsNorm.split(/\s+/)[0];
              if (
                oddsFirst.startsWith(firstName.slice(0, 5)) ||
                firstName.startsWith(oddsFirst.slice(0, 5))
              )
                return price;
            }
          }
          return null;
        }

        const toUpdate: { id: string; price: number }[] = [];
        for (const pl of p) {
          const price = findOddsForPlayer(pl.name);
          if (price !== null) toUpdate.push({ id: pl.id, price });
        }
        if (toUpdate.length === 0) {
          showToast(
            `Odds API has ${priceMap.size} names but none matched DB players`,
            "red",
          );
          return;
        }
        await Promise.all(
          toUpdate.map(({ id, price }) =>
            supabase.from("players").update({ odds: price }).eq("id", id),
          ),
        );
        const { data: fresh } = await supabase
          .from("players")
          .select("*")
          .eq("match_id", m.id)
          .order("odds");
        if (fresh) setPlayers(fresh as DbPlayer[]);
        showToast(
          `NGS odds synced — ${toUpdate.length} / ${p.length} players updated`,
          "green",
        );
        return;
      }

      // ── Goalserve-first seeding ─────────────────────────────────────────
      // Goalserve is source of truth for the squad (20 players).
      // Odds API odds are matched to each Goalserve player by name.
      // Players not in the Goalserve squad (Odds API ghosts) are discarded.

      const lu = lineupData ?? lineup;
      const hasLineup =
        lu &&
        (lu.home.starters.length > 0 ||
          lu.away.starters.length > 0 ||
          lu.home.subs.length > 0 ||
          lu.away.subs.length > 0);

      if (!hasLineup) {
        // ── Odds-API-direct fallback ────────────────────────────────────────
        // Goalserve has no lineup data for this competition (e.g. UECL league
        // 18853 has live_lineups=False). Seed directly from the Odds API scorer
        // market outcomes. Names are an exact match by definition — no fuzzy
        // matching needed. Team assignment comes from outcome.name when available.
        if (priceMap.size === 0) {
          showToast(
            "No Goalserve lineup + no Odds API scorer market — cannot seed players",
            "red",
          );
          return;
        }
        const normPriceMap2 = new Map<string, number>();
        for (const [n, price] of priceMap) normPriceMap2.set(norm(n), price);
        const oddsRows = [...priceMap.entries()].map(([playerName, price]) => ({
          match_id: m.id,
          external_player_id:
            "odds_" + norm(playerName).replace(/[^a-z0-9]/g, "_"),
          name: playerName,
          team: teamMap.get(playerName) ?? "home",
          jersey_number: null,
          position: null,
          is_starter: true,
          odds: price,
        }));
        const { error: oddsInsErr } = await supabase
          .from("players")
          .upsert(oddsRows, { onConflict: "match_id,external_player_id" });
        if (oddsInsErr) {
          showToast(`Seed error: ${oddsInsErr.message}`, "red");
          return;
        }
        const { data: fresh } = await supabase
          .from("players")
          .select("*")
          .eq("match_id", m.id)
          .order("odds");
        if (fresh) setPlayers(fresh as DbPlayer[]);
        showToast(
          `Seeded ${oddsRows.length} players from Odds API scorer market (no Goalserve lineup available)`,
          "green",
        );
        return;
      }

      // Build normalised odds lookup: norm(oddsApiName) → price
      const normPriceMap = new Map<string, number>();
      for (const [n, price] of priceMap) {
        normPriceMap.set(norm(n), price);
      }

      function oddsForPlayer(gsName: string): number | null {
        const n = norm(gsName);
        const words = n.split(/\s+/);
        const surname = words[words.length - 1];
        const firstName = words[0];
        // 1. exact normalised full name
        if (normPriceMap.has(n)) return normPriceMap.get(n)!;
        // 2. surname match (last word, min 4 chars)
        if (surname.length >= 4) {
          for (const [oddsNorm, price] of normPriceMap) {
            const oddsSurname = oddsNorm.split(/\s+/).pop() ?? "";
            if (oddsSurname === surname) return price;
            if (oddsNorm.includes(surname) || n.includes(oddsSurname))
              return price;
          }
        }
        // 3. first-name prefix match (handles nicknames: Savinho ↔ Savio…)
        if (firstName.length >= 4) {
          for (const [oddsNorm, price] of normPriceMap) {
            const oddsFirst = oddsNorm.split(/\s+/)[0];
            if (
              oddsFirst.startsWith(firstName.slice(0, 5)) ||
              firstName.startsWith(oddsFirst.slice(0, 5))
            )
              return price;
          }
        }
        return null;
      }

      const allSquad: {
        lp: LineupPlayer;
        team: "home" | "away";
        isStarter: boolean;
      }[] = [
        ...lu.home.starters.map((lp) => ({
          lp,
          team: "home" as const,
          isStarter: true,
        })),
        ...lu.home.subs.map((lp) => ({
          lp,
          team: "home" as const,
          isStarter: false,
        })),
        ...lu.away.starters.map((lp) => ({
          lp,
          team: "away" as const,
          isStarter: true,
        })),
        ...lu.away.subs.map((lp) => ({
          lp,
          team: "away" as const,
          isStarter: false,
        })),
      ];

      const rows = allSquad.map(({ lp, team, isStarter }) => {
        // odds column is NOT NULL DEFAULT 1 — use 1 as sentinel when no odds available
        const odds = oddsForPlayer(lp.name) ?? 1;
        const jersey = lp.num ? parseInt(lp.num, 10) || null : null;
        return {
          match_id: m.id,
          external_player_id:
            "gs_" + lp.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
          name: lp.name,
          team,
          jersey_number: jersey,
          position: lp.pos || null,
          is_starter: isStarter,
          odds,
        };
      });

      const { error: insErr } = await supabase
        .from("players")
        .upsert(rows, { onConflict: "match_id,external_player_id" });
      if (insErr) {
        showToast(`Seed error: ${insErr.message}`, "red");
        return;
      }

      const { data: fresh } = await supabase
        .from("players")
        .select("*")
        .eq("match_id", m.id)
        .order("odds");
      if (fresh) setPlayers(fresh as DbPlayer[]);
      const withOdds = rows.filter((r) => r.odds > 1).length;
      showToast(
        `Players seeded — ${rows.length} from Goalserve squad, ${withOdds} with odds`,
        "green",
      );
    } catch {
      // silent fail
    }
  }
  // Toast notifications
  const [toasts, setToasts] = useState<
    { id: number; msg: string; color: string }[]
  >([]);
  const toastIdRef = useRef(0);
  function showToast(msg: string, color = "green") {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, msg, color }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }

  // Goal flash alert (big overlay for ~3 s)
  const [goalFlash, setGoalFlash] = useState<{
    name: string;
    minute: number;
    team: string;
  } | null>(null);
  function flashGoal(name: string, minute: number, team: string) {
    setGoalFlash({ name, minute, team });
    setTimeout(() => setGoalFlash(null), 3500);
  }

  useEffect(() => {
    if (!matchId) return;
    Promise.all([
      supabase
        .from("matches")
        .select("*")
        .eq("external_match_id", matchId)
        .single(),
    ]).then(([{ data: m, error }]) => {
      if (error || !m) {
        setLoading(false);
        return;
      }
      setMatch(m);
      // Initialize corner odds from stored config
      const cfg = (m.odds_api_config ?? {}) as Record<string, unknown>;
      const storedCorner = cfg.corner_odds as
        | { home?: number; away?: number }
        | undefined;
      if (storedCorner) {
        setCornerOddsHome(storedCorner.home ?? 1.9);
        setCornerOddsAway(storedCorner.away ?? 1.9);
      }

      Promise.all([
        supabase.from("players").select("*").eq("match_id", m.id).order("odds"),
        supabase
          .from("bets")
          .select("*")
          .eq("match_id", m.id)
          .order("placed_at", { ascending: false }),
        supabase
          .from("goal_events")
          .select("*")
          .eq("match_id", m.id)
          .order("minute"),
      ]).then(([{ data: p }, { data: b }, { data: g }]) => {
        const players = (p ?? []) as DbPlayer[];
        setPlayers(players);
        setBets(b ?? []);
        setGoals(g ?? []);
        setLoading(false);

        // Auto-fetch match odds + Goalserve lineup + NGS scorer odds
        fetchMatchOdds(m as DbMatch);
        fetchGoalserveLineup(m as DbMatch).then((lu) => {
          fetchNGSOdds(m as DbMatch, players, lu);
        });

        // Real-time subscription — goal_events + matches live updates
        const matchId = m.id;
        const ch = supabase
          .channel(`match-${matchId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "goal_events",
              filter: `match_id=eq.${matchId}`,
            },
            (payload) => {
              const g = payload.new as DbGoalEvent;
              setGoals((gs) => {
                if (gs.find((x) => x.id === g.id)) return gs;
                return [...gs, g].sort((a, b) => a.minute - b.minute);
              });
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "goal_events",
              filter: `match_id=eq.${matchId}`,
            },
            (payload) => {
              setGoals((gs) =>
                gs.map((x) =>
                  x.id === payload.new.id ? (payload.new as DbGoalEvent) : x,
                ),
              );
            },
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "matches",
              filter: `id=eq.${matchId}`,
            },
            (payload) => {
              const updated = payload.new as DbMatch;
              setMatch(updated);
              // Keep h2h display in sync with DB — pg_cron or extension may have
              // written newer odds since this page loaded.
              if (updated.odds_home || updated.odds_draw || updated.odds_away) {
                setH2h((prev) => ({
                  home: updated.odds_home ?? prev?.home ?? 0,
                  draw: updated.odds_draw ?? prev?.draw ?? 0,
                  away: updated.odds_away ?? prev?.away ?? 0,
                  bookmaker: prev?.bookmaker ?? "DB",
                }));
              }
            },
          )
          .subscribe();
        return () => {
          supabase.removeChannel(ch);
        };
      });
    });
  }, [matchId]);

  async function updateStatus(status: DbMatch["status"]) {
    if (!match) return;
    await supabase.from("matches").update({ status }).eq("id", match.id);
    setMatch((m) => (m ? { ...m, status } : m));
  }

  async function updateScore(home: number, away: number) {
    if (!match) return;
    await supabase
      .from("matches")
      .update({ score_home: home, score_away: away })
      .eq("id", match.id);
    setMatch((m) => (m ? { ...m, score_home: home, score_away: away } : m));
  }

  async function updateMinute(minute: number) {
    if (!match) return;
    await supabase
      .from("matches")
      .update({ current_minute: minute })
      .eq("id", match.id);
    setMatch((m) => (m ? { ...m, current_minute: minute } : m));
  }

  async function refreshGoals() {
    if (!match) return;
    const { data } = await supabase
      .from("goal_events")
      .select("*")
      .eq("match_id", match.id)
      .order("minute");
    setGoals(data ?? []);
  }

  async function handleEmitGoal() {
    if (!match || !goalForm.playerId) return;
    setOracleBusy(true);
    setOracleError(null);
    setOracleTx(null);
    try {
      // Write goal_event to Supabase — no on-chain call needed.
      // Settlement happens at FT via settleMatch() with confirmed scorers.
      const { error } = await supabase.from("goal_events").insert({
        match_id: match.id,
        player_id: goalForm.playerId,
        player_name: goalForm.playerName,
        team: goalForm.team,
        minute: goalForm.minute,
        event_type: "GOAL",
        confirmed: false, // admin confirms via toggle below
        source: "manual",
        raw_payload: {},
      });
      if (error) throw new Error(error.message);
      await refreshGoals();
      // Bump score in DB + local state
      const newHome =
        goalForm.team === "home"
          ? (match.score_home ?? 0) + 1
          : (match.score_home ?? 0);
      const newAway =
        goalForm.team === "away"
          ? (match.score_away ?? 0) + 1
          : (match.score_away ?? 0);
      await updateScore(newHome, newAway);
      setOracleTx("saved");
      // Flash the goal alert
      flashGoal(goalForm.playerName, goalForm.minute, goalForm.team);
      showToast(`⚽ GOAL! ${goalForm.playerName} ${goalForm.minute}'`, "green");
    } catch (e) {
      setOracleError(String(e));
    } finally {
      setOracleBusy(false);
    }
  }

  async function handleConfirmGoal(goalId: string, confirmed: boolean) {
    await supabase.from("goal_events").update({ confirmed }).eq("id", goalId);
    setGoals((gs) =>
      gs.map((g) => (g.id === goalId ? { ...g, confirmed } : g)),
    );
  }

  async function refreshContractBalance() {
    if (!match?.contract_address) return;
    setContractBalanceLoading(true);
    try {
      const bal = await fetchUsdcBalance(
        match.contract_address,
        getMatchNetwork(match),
      );
      setContractUsdcBalance(bal);
    } catch {
      setContractUsdcBalance(null);
    } finally {
      setContractBalanceLoading(false);
    }
  }

  async function handleSettleMatch(force = false) {
    if (!match) return;
    setOracleBusy(true);
    setOracleError(null);
    setOracleTx(null);
    setOracleBalancesTx(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      // Route to the correct edge function based on which chain the match is on
      const matchNetwork = getMatchNetwork(match);
      const settleFn =
        matchNetwork === "hedera" ? "settle-match-hedera" : "settle-match";
      // POST only match_id — edge fn auto-fetches result from Goalserve
      const res = await fetch(`${supabaseUrl}/functions/v1/${settleFn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ match_id: match.id, force }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 409 = already settled (CRE auto-settled before admin clicked) — treat as success
        if (
          res.status === 409 &&
          (data.error ?? "").toLowerCase().includes("already settled")
        ) {
          setMatch((m) => (m ? { ...m, status: "finished" } : m));
          showToast(
            "✅ Match was already settled by the CRE oracle — refreshing view.",
            "orange",
          );
          // Refresh bets so settlement breakdown appears
          const { data: freshBets } = await supabase
            .from("bets")
            .select("*")
            .eq("match_id", match.id)
            .order("placed_at", { ascending: true });
          if (freshBets) setBets(freshBets as DbBet[]);
          return;
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // Refresh local match state and bets
      setMatch((m) => (m ? { ...m, status: "finished" } : m));
      if (data.blockchain_settle_tx) setOracleTx(data.blockchain_settle_tx);
      if (data.blockchain_balances_tx)
        setOracleBalancesTx(data.blockchain_balances_tx);
      setSettleData({
        settled: data.settled,
        total_payout: data.total_payout,
        match: data.match,
      });
      // Refresh bets from DB so breakdown is accurate
      const { data: freshBets } = await supabase
        .from("bets")
        .select("*")
        .eq("match_id", match.id)
        .order("placed_at", { ascending: true });
      if (freshBets) setBets(freshBets as DbBet[]);
      showToast(
        `🏁 Settled: ${data.winners} won · ${data.bets_settled} bets · ${data.match?.score ?? ""}`,
        "orange",
      );
    } catch (e) {
      setOracleError(String(e));
    } finally {
      setOracleBusy(false);
    }
  }

  async function handleWithdrawFees() {
    if (!match?.contract_address) return;
    if (!window.ethereum) {
      setWithdrawFeesError(
        "MetaMask not detected. Install the MetaMask browser extension.",
      );
      return;
    }
    setWithdrawFeesBusy(true);
    setWithdrawFeesError(null);
    setWithdrawFeesTx(null);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      const to = accounts[0];
      if (!to)
        throw new Error(
          "No MetaMask account connected — click Connect in the header first.",
        );

      // Pre-check: read collectedFees() — selector 0x9003adfe
      const feesHex = (await window.ethereum.request({
        method: "eth_call",
        params: [{ to: match.contract_address, data: "0x9003adfe" }, "latest"],
      })) as string;
      const feesWei = BigInt(feesHex ?? "0x0");
      if (feesWei === 0n) {
        throw new Error(
          "No fees to withdraw — collectedFees is 0 on the contract.",
        );
      }

      // ABI encode: withdrawFees(address to)
      // selector: 0x164e68de, address padded to 32 bytes
      const data = "0x164e68de" + to.slice(2).toLowerCase().padStart(64, "0");
      const txHash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from: to, to: match.contract_address, data }],
      })) as string;
      setWithdrawFeesTx(txHash);
      showToast("💰 withdrawFees tx sent!", "green");
    } catch (e: unknown) {
      // MetaMask errors are plain objects {code, message}, not Error instances
      const msg =
        e instanceof Error
          ? e.message
          : ((e as { data?: { message?: string }; message?: string })?.data
              ?.message ??
            (e as { message?: string })?.message ??
            JSON.stringify(e));
      setWithdrawFeesError(msg);
    } finally {
      setWithdrawFeesBusy(false);
    }
  }

  if (loading)
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900/50 border border-white/5 rounded-xl h-16 animate-pulse"
          />
        ))}
      </div>
    );
  if (!match)
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
        <span>⚠</span> Event not found.
      </div>
    );

  const totalLocked = bets
    .filter((b) => b.status === "active")
    .reduce((s, b) => s + Number(b.current_amount), 0);
  const totalBets = bets.length;
  const activeBets = bets.filter((b) => b.status === "active").length;

  return (
    <div className="relative">
      {/* ── Goal flash overlay ─────────────────────────────────────────── */}
      {goalFlash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className={`animate-bounce-in px-12 py-8 rounded-3xl shadow-2xl border-2 text-center ${
              goalFlash.team === "home"
                ? "bg-blue-950 border-blue-400 shadow-blue-500/30"
                : "bg-red-950 border-red-400 shadow-red-500/30"
            }`}
          >
            <div className="text-6xl mb-2">⚽</div>
            <div className="text-3xl font-black text-white tracking-tight">
              {goalFlash.name}
            </div>
            <div
              className={`text-lg font-bold mt-1 ${
                goalFlash.team === "home" ? "text-blue-300" : "text-red-300"
              }`}
            >
              {goalFlash.minute}' —{" "}
              {goalFlash.team === "home" ? match?.home_team : match?.away_team}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast stack (top-right) ────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-40 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold border shadow-lg ${
              t.color === "green"
                ? "bg-green-950 border-green-500/40 text-green-300"
                : t.color === "orange"
                  ? "bg-orange-950 border-orange-500/40 text-orange-300"
                  : "bg-gray-900 border-white/10 text-gray-300"
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors mb-3"
          >
            ← Events
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {match.home_team}{" "}
            <span className="text-gray-600 font-normal">vs</span>{" "}
            {match.away_team}
          </h1>
          <p className="text-xs text-gray-600 mt-1 font-mono">
            {new Date(match.kickoff_at).toLocaleString()} ·{" "}
            {match.external_match_id}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <StatusBadge status={match.status} />
          <Link
            to={`/events/${matchId}/fund`}
            className="text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            Fund Pool →
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Score",
            value: `${match.score_home ?? 0}–${match.score_away ?? 0}`,
            accent: match.status === "live",
          },
          { label: "Total Bets", value: String(totalBets), accent: false },
          { label: "Active Bets", value: String(activeBets), accent: false },
          {
            label: "Locked",
            value: `$${totalLocked.toFixed(2)}`,
            accent: false,
          },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={`bg-gray-900 border rounded-xl p-4 text-center transition-colors ${
              accent
                ? "border-green-500/30 shadow-sm shadow-green-500/10"
                : "border-white/5"
            }`}
          >
            <div
              className={`text-2xl font-bold tabular-nums ${accent ? "text-green-400" : "text-white"}`}
            >
              {value}
            </div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {(match.status === "pre-match" || match.status === "halftime") && (
          <Btn onClick={() => updateStatus("live")} color="green">
            ▶ Set Live
          </Btn>
        )}
        {match.status === "finished" && (
          <Btn onClick={() => updateStatus("live")} color="blue">
            ↺ Reopen (set Live)
          </Btn>
        )}
        {(match.status === "live" || match.status === "finished") && (
          <>
            {match.status === "live" && (
              <Btn onClick={() => updateStatus("finished")} color="gray">
                ■ Set Finished
              </Btn>
            )}
            <Btn
              onClick={() =>
                updateScore((match.score_home ?? 0) + 1, match.score_away ?? 0)
              }
              color="green"
            >
              +1 Home
            </Btn>
            <Btn
              onClick={() =>
                updateScore(match.score_home ?? 0, (match.score_away ?? 0) + 1)
              }
              color="green"
            >
              +1 Away
            </Btn>
          </>
        )}
        {/* Minute control */}
        <div className="flex items-center gap-2 ml-2">
          <span className="text-[11px] text-gray-600 uppercase tracking-wider">
            Min:
          </span>
          <input
            type="number"
            min={0}
            max={120}
            value={match.current_minute ?? 0}
            onChange={(e) => updateMinute(Number(e.target.value))}
            className="w-14 bg-gray-800 border border-white/8 rounded-lg px-2 py-1 text-sm text-gray-200 text-center focus:outline-none focus:border-green-500/40 tabular-nums"
          />
        </div>
        <div className="ml-auto">
          {match.contract_address ? (
            <span className="px-3 py-1.5 text-[11px] bg-gray-900 border border-white/5 text-gray-500 rounded-lg font-mono">
              {match.contract_address.slice(0, 10)}…
              {match.contract_address.slice(-4)}
            </span>
          ) : (
            <span className="px-3 py-1.5 text-[11px] bg-yellow-500/8 border border-yellow-500/20 text-yellow-500 rounded-lg">
              No contract assigned
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/60 border border-white/5 rounded-xl p-1 mb-6 w-fit">
        {(["overview", "players", "bets", "goals", "oracle"] as Tab[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
                tab === t
                  ? "bg-gray-800 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {t}
            </button>
          ),
        )}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* ── 1X2 odds strip ── */}
          {h2h && (
            <div className="bg-gray-900/70 border border-white/5 rounded-xl px-4 py-3">
              <div className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-3">
                Match Odds · {h2h.bookmaker}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: `1 · ${match.home_team.split(" ")[0]}`,
                    val: h2h.home,
                  },
                  { label: "X · Draw", val: h2h.draw },
                  {
                    label: `2 · ${match.away_team.split(" ")[0]}`,
                    val: h2h.away,
                  },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 bg-gray-950/60 rounded-lg py-3 px-2"
                  >
                    <span className="text-[11px] text-gray-500 font-medium">
                      {label}
                    </span>
                    <span className="text-xl font-black tabular-nums text-blue-400">
                      {val > 0 ? val.toFixed(2) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* ── Corner bet odds ── */}
          <div className="bg-gray-900/70 border border-white/5 rounded-xl px-4 py-3">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-3">
              Corner Bet Odds
            </div>
            <div className="flex flex-wrap gap-4 items-end">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">
                  {match.home_team.split(" ")[0]} (Home)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={cornerOddsHome}
                  onChange={(e) => setCornerOddsHome(Number(e.target.value))}
                  className="bg-gray-950/60 text-white rounded-lg px-3 py-2 w-24 text-sm border border-white/5 focus:outline-none focus:border-yellow-500/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">
                  {match.away_team.split(" ")[0]} (Away)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={cornerOddsAway}
                  onChange={(e) => setCornerOddsAway(Number(e.target.value))}
                  className="bg-gray-950/60 text-white rounded-lg px-3 py-2 w-24 text-sm border border-white/5 focus:outline-none focus:border-yellow-500/50"
                />
              </label>
              <button
                onClick={() => saveCornerOdds(match)}
                disabled={cornerOddsSaving}
                className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors text-xs font-medium disabled:opacity-50"
              >
                {cornerOddsSaving ? "Saving…" : "Save Corner Odds"}
              </button>
              {cornerOddsSavedMsg && (
                <span className="text-emerald-400 text-xs">
                  {cornerOddsSavedMsg}
                </span>
              )}
            </div>
            <p className="text-gray-600 text-[10px] mt-2">
              Stored in odds_api_config.corner_odds · Default 1.9× if not set
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {[
              ["External ID", match.external_match_id],
              ["Status", match.status],
              ["Kickoff", new Date(match.kickoff_at).toLocaleString()],
              ["Half", String(match.half)],
              ["Minute", String(match.current_minute)],
              ["Demo", match.is_demo ? "Yes" : "No"],
              ["Oracle", match.oracle_address ?? "—"],
              ["Contract", match.contract_address ?? "—"],
            ].map(([k, v]) => (
              <div
                key={k}
                className="bg-gray-900/70 border border-white/5 rounded-xl px-4 py-3"
              >
                <div className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-1">
                  {k}
                </div>
                <div className="font-mono text-xs text-gray-300 break-all">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "players" && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <button
              onClick={() => match && fetchGoalserveLineup(match)}
              className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              ↺ Refresh Lineup
            </button>
            <button
              onClick={() => match && reseedPlayers(match)}
              className="text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors"
            >
              ↺ Re-seed Players
            </button>
          </div>
          <PlayersTab players={players} lineup={lineup} match={match} />
        </div>
      )}

      {tab === "bets" && (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5 bg-gray-950/40">
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Odds</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {bets.map((b) => (
                <tr key={b.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {b.bettor_wallet.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {b.current_player_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-200">
                    ${Number(b.current_amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-green-400 font-bold">
                    {b.odds}x
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                        b.status === "active"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : b.status === "settled_won"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : b.status === "settled_lost"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : b.status === "provisional_win"
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                : "bg-gray-800 text-gray-400 border-white/5"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "goals" && (
        <div className="space-y-2">
          {goals.length === 0 && (
            <div className="text-center py-12 border border-dashed border-white/8 rounded-xl text-sm text-gray-600">
              No goal events recorded yet.
            </div>
          )}
          {goals.map((g) => (
            <div
              key={g.id}
              className="group bg-gray-900/70 border border-white/5 hover:border-green-500/15 rounded-xl px-4 py-3.5 flex items-center justify-between text-sm transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">⚽</span>
                <div>
                  <span className="font-semibold text-white">
                    {g.player_name}
                  </span>
                  <span className="mx-2 text-gray-700">·</span>
                  <span
                    className={
                      g.team === "home" ? "text-blue-400" : "text-red-400"
                    }
                  >
                    {g.team}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tabular-nums text-gray-400">
                  {g.minute}'
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                    g.confirmed
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  }`}
                >
                  {g.confirmed ? "confirmed" : "pending"}
                </span>
                <span className="text-[11px] text-gray-600 font-mono">
                  {g.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "oracle" && (
        <div className="space-y-5">
          {/* CRE Workflow live tracker */}
          <CREWorkflowPanel match={match} bets={bets} goals={goals} />

          {/* Note banner */}
          <div className="flex items-start gap-3 bg-blue-500/6 border border-blue-500/15 rounded-xl px-4 py-3 text-sm">
            <span className="text-blue-400 mt-0.5">ℹ️</span>
            <div className="text-gray-400">
              Goals are recorded in{" "}
              <span className="text-blue-400 font-medium">Supabase only</span> —
              no on-chain call. Live odds update in the frontend (off-chain).
              Settlement happens <span className="text-white">once at FT</span>{" "}
              via{" "}
              <code className="text-green-400 text-[11px]">settleMatch()</code>{" "}
              below, passing confirmed scorers + final score.
              {match.oracle_address && (
                <span className="block mt-1 font-mono text-[11px] text-gray-600">
                  Oracle address (settleMatch signer): {match.oracle_address}
                </span>
              )}
            </div>
          </div>

          {/* Match Escrow Contract */}
          {match.contract_address ? (
            <div className="bg-indigo-950/30 border border-indigo-500/25 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  🔐 Match Escrow Contract
                </h3>
                <button
                  onClick={refreshContractBalance}
                  disabled={contractBalanceLoading}
                  className="text-xs px-3 py-1 rounded-lg bg-indigo-700/40 text-indigo-300 hover:bg-indigo-700/70 transition-colors disabled:opacity-50"
                >
                  {contractBalanceLoading ? "Loading…" : "↺ Refresh Balance"}
                </button>
              </div>

              {/* Contract address */}
              <div className="bg-gray-900/60 border border-white/8 rounded-lg px-4 py-3">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-1">
                  Contract Address (Sepolia)
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-white font-mono text-xs break-all flex-1">
                    {match.contract_address}
                  </p>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        match.contract_address ?? "",
                      )
                    }
                    className="flex-shrink-0 text-[10px] px-2 py-1 rounded bg-indigo-700/50 text-indigo-200 hover:bg-indigo-600/70 transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <a
                  href={
                    getMatchNetwork(match) === "hedera"
                      ? `https://hashscan.io/testnet/contract/${match.contract_address}`
                      : `https://sepolia.etherscan.io/address/${match.contract_address}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 text-[10px] hover:text-indigo-200 mt-1 inline-block"
                >
                  {getMatchNetwork(match) === "hedera"
                    ? "View on HashScan ↗"
                    : "View on Etherscan ↗"}
                </a>
              </div>

              {/* USDC balance */}
              <div className="bg-gray-900/60 border border-white/8 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold mb-0.5">
                    On-Chain USDC Balance
                  </p>
                  <p className="text-xs text-gray-500">
                    (Sepolia USDC held in escrow)
                  </p>
                </div>
                <div className="text-right">
                  {contractBalanceLoading ? (
                    <div className="w-4 h-4 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
                  ) : contractUsdcBalance !== null ? (
                    <p
                      className={`font-bold text-lg ${contractUsdcBalance > 0 ? "text-emerald-400" : "text-gray-500"}`}
                    >
                      ${contractUsdcBalance.toFixed(2)}
                    </p>
                  ) : (
                    <p className="text-gray-600 text-xs">Click ↺ to load</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-4 py-3 text-sm text-yellow-500">
              ⚠ No contract deployed for this match yet.
            </div>
          )}

          {/* Settlement Breakdown (shown when bets are settled) */}
          {bets.some(
            (b) => b.status === "settled_won" || b.status === "settled_lost",
          ) &&
            (() => {
              // Helper: human-readable bet selection label
              const betLabel = (b: (typeof bets)[0]): string => {
                if (b.bet_type === "MATCH_WINNER") {
                  const o = b.outcome ?? b.current_player_id;
                  if (o === "home") return `Home Win — ${match.home_team}`;
                  if (o === "away") return `Away Win — ${match.away_team}`;
                  return "Draw";
                }
                if (b.bet_type === "EXACT_GOALS") {
                  return `Exactly ${b.current_player_id} Goals`;
                }
                if (b.bet_type === "NEXT_GOAL_SCORER") {
                  // "gs_alexander_s_rloth" → "Alexander S Rloth"
                  const raw = b.current_player_id.replace(/^gs_/, "");
                  const readable = raw
                    .split("_")
                    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ");
                  return `NGS — ${readable}`;
                }
                return b.current_player_id;
              };

              // Why a bet might have lost
              const lostReason = (b: (typeof bets)[0]): string | null => {
                if (b.status !== "settled_lost") return null;
                if (b.bet_type === "NEXT_GOAL_SCORER")
                  return "No scorer data from Goalserve after match day";
                if (b.bet_type === "EXACT_GOALS") {
                  const actual =
                    match.score_home !== null && match.score_away !== null
                      ? match.score_home + match.score_away
                      : null;
                  const predicted = parseInt(b.current_player_id, 10);
                  if (actual !== null && !isNaN(predicted))
                    return `Predicted ${predicted} goals, actual total was ${actual}`;
                }
                return null;
              };

              const settledBets = bets.filter(
                (b) =>
                  b.status === "settled_won" || b.status === "settled_lost",
              );

              // Group by wallet for summary
              const byWallet: Record<
                string,
                { won: number; lost: number; staked: number; payout: number }
              > = {};
              for (const b of settledBets) {
                if (!byWallet[b.bettor_wallet])
                  byWallet[b.bettor_wallet] = {
                    won: 0,
                    lost: 0,
                    staked: 0,
                    payout: 0,
                  };
                byWallet[b.bettor_wallet].staked += b.current_amount;
                if (b.status === "settled_won") {
                  byWallet[b.bettor_wallet].won++;
                  byWallet[b.bettor_wallet].payout += b.current_amount * b.odds;
                } else {
                  byWallet[b.bettor_wallet].lost++;
                }
              }
              const totalPlayerPayout = Object.values(byWallet).reduce(
                (s, v) => s + v.payout,
                0,
              );
              const totalUserStaked = Object.values(byWallet).reduce(
                (s, v) => s + v.staked,
                0,
              );
              const platformRevenue = Math.max(
                0,
                totalUserStaked - totalPlayerPayout,
              );
              const settleScore =
                settleData?.match?.score ??
                (match.score_home !== null && match.score_away !== null
                  ? `${match.score_home}-${match.score_away}`
                  : null);
              return (
                <div className="bg-gray-900/70 border border-white/5 rounded-xl p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">
                      📊 Settlement Results
                    </h3>
                    {settleScore && (
                      <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                        FT {settleScore}
                      </span>
                    )}
                  </div>

                  {/* ── Per-bet breakdown ── */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium">
                      Individual Bets
                    </p>
                    <div className="space-y-2">
                      {settledBets.map((b, i) => {
                        const won = b.status === "settled_won";
                        const payout = won ? b.current_amount * b.odds : 0;
                        const reason = lostReason(b);
                        return (
                          <div
                            key={b.id}
                            className={`rounded-lg border px-3 py-2.5 text-xs ${
                              won
                                ? "bg-green-500/5 border-green-500/20"
                                : "bg-red-500/5 border-red-500/15"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                      won
                                        ? "bg-green-500/20 text-green-400"
                                        : "bg-red-500/15 text-red-400"
                                    }`}
                                  >
                                    {won ? "✓ WON" : "✗ LOST"}
                                  </span>
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">
                                    {b.bet_type.replace(/_/g, " ")}
                                  </span>
                                </div>
                                <p className="text-white font-medium truncate">
                                  {betLabel(b)}
                                </p>
                                <div className="flex items-center gap-2 mt-1 text-gray-500">
                                  <span className="font-mono">
                                    <a
                                      href={`https://sepolia.etherscan.io/address/${b.bettor_wallet}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hover:text-gray-300 transition-colors"
                                    >
                                      {b.bettor_wallet.slice(0, 6)}…
                                      {b.bettor_wallet.slice(-4)}
                                    </a>
                                  </span>
                                  {b.blockchain_settle_tx && (
                                    <a
                                      href={`https://sepolia.etherscan.io/tx/${b.blockchain_settle_tx}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[10px] text-blue-500 hover:text-blue-300 transition-colors"
                                    >
                                      tx ↗
                                    </a>
                                  )}
                                </div>
                                {reason && (
                                  <p className="text-[10px] text-amber-600/80 mt-1 italic">
                                    ⚠ {reason}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-gray-400 text-[11px]">
                                  ${b.current_amount.toFixed(2)}{" "}
                                  <span className="text-gray-600">
                                    @ {b.odds}x
                                  </span>
                                </div>
                                <div
                                  className={`font-bold mt-0.5 ${
                                    won ? "text-green-400" : "text-gray-600"
                                  }`}
                                >
                                  {won ? `$${payout.toFixed(2)}` : "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ── Per-wallet summary ── */}
                  {Object.keys(byWallet).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium">
                        By Wallet
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-widest text-gray-600 border-b border-white/5">
                              <th className="text-left pb-2 font-medium">
                                Wallet
                              </th>
                              <th className="text-center pb-2 font-medium">
                                Won
                              </th>
                              <th className="text-center pb-2 font-medium">
                                Lost
                              </th>
                              <th className="text-right pb-2 font-medium">
                                Staked
                              </th>
                              <th className="text-right pb-2 font-medium">
                                Payout
                              </th>
                              <th className="text-right pb-2 font-medium">
                                P&amp;L
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {Object.entries(byWallet).map(([wallet, v]) => {
                              const pnl = v.payout - v.staked;
                              return (
                                <tr key={wallet} className="group">
                                  <td className="py-2 font-mono text-gray-400 group-hover:text-gray-200 transition-colors">
                                    <a
                                      href={`https://sepolia.etherscan.io/address/${wallet}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="hover:underline"
                                    >
                                      {wallet.slice(0, 6)}…{wallet.slice(-4)}
                                    </a>
                                  </td>
                                  <td className="py-2 text-center">
                                    {v.won > 0 ? (
                                      <span className="text-green-400 font-semibold">
                                        {v.won}
                                      </span>
                                    ) : (
                                      <span className="text-gray-600">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-center">
                                    {v.lost > 0 ? (
                                      <span className="text-red-400">
                                        {v.lost}
                                      </span>
                                    ) : (
                                      <span className="text-gray-600">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-right text-gray-300">
                                    ${v.staked.toFixed(2)}
                                  </td>
                                  <td className="py-2 text-right">
                                    {v.payout > 0 ? (
                                      <span className="text-green-400 font-semibold">
                                        ${v.payout.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-gray-600">
                                        $0.00
                                      </span>
                                    )}
                                  </td>
                                  <td
                                    className={`py-2 text-right font-semibold ${
                                      pnl >= 0
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }`}
                                  >
                                    {pnl >= 0 ? "+" : ""}
                                    {pnl.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Summary grid ── */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                    <div className="bg-gray-800/60 rounded-lg px-3 py-2 text-center">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                        User Staked
                      </div>
                      <div className="text-sm font-bold text-white">
                        ${totalUserStaked.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-gray-600 mt-0.5">
                        off-chain bets
                      </div>
                    </div>
                    <div className="bg-green-500/6 border border-green-500/15 rounded-lg px-3 py-2 text-center">
                      <div className="text-[10px] text-green-600 uppercase tracking-wide mb-0.5">
                        To Players
                      </div>
                      <div className="text-sm font-bold text-green-400">
                        ${totalPlayerPayout.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-green-800 mt-0.5">
                        via withdraw()
                      </div>
                    </div>
                    <div className="bg-orange-500/6 border border-orange-500/15 rounded-lg px-3 py-2 text-center">
                      <div className="text-[10px] text-orange-600 uppercase tracking-wide mb-0.5">
                        Platform
                      </div>
                      <div className="text-sm font-bold text-orange-400">
                        ${platformRevenue.toFixed(2)}
                      </div>
                      <div className="text-[9px] text-orange-800 mt-0.5">
                        via withdrawFees()
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-gray-600 space-y-1 border-t border-white/5 pt-2">
                    <p>
                      Winners call{" "}
                      <code className="text-gray-500">withdraw(matchId)</code>{" "}
                      on the contract to claim their payout. Platform claims{" "}
                      <code className="text-gray-500">withdrawFees()</code> once
                      per contract.
                    </p>
                    <p className="text-amber-700/70">
                      ⓘ The total USDC balance shown on the contract covers{" "}
                      <strong>all matches</strong> using this singleton — not
                      just this match.
                    </p>
                  </div>
                </div>
              );
            })()}

          {/* Settle Match */}
          <div className="bg-gray-900/70 border border-white/5 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              🏁 Settle Match
            </h3>
            <p className="text-xs text-gray-500">
              Calls the{" "}
              <span className="font-mono text-gray-400">settle-match</span> edge
              function which automatically fetches the official result from
              Goalserve, settles all bets in Supabase, then calls{" "}
              <span className="font-mono text-gray-400">settleMatch()</span> and{" "}
              <span className="font-mono text-gray-400">
                settleUserBalances()
              </span>{" "}
              on-chain via the oracle key. No MetaMask needed.
            </p>
            {oracleError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono break-all">
                {oracleError}
              </div>
            )}
            {oracleTx && oracleTx !== "done" && (
              <div className="text-[11px] text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-lg px-3 py-2 font-mono break-all">
                ✅ settle tx:{" "}
                <a
                  href={`https://sepolia.etherscan.io/tx/${oracleTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-emerald-200 transition-colors"
                >
                  {oracleTx}
                </a>
              </div>
            )}
            {oracleBalancesTx && (
              <div className="text-[11px] text-blue-400 bg-blue-500/8 border border-blue-500/15 rounded-lg px-3 py-2 font-mono break-all">
                ✅ balances tx:{" "}
                <a
                  href={`https://sepolia.etherscan.io/tx/${oracleBalancesTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-blue-200 transition-colors"
                >
                  {oracleBalancesTx}
                </a>
              </div>
            )}
            {match.status === "finished" ? (
              <div className="space-y-2">
                <div className="text-[11px] text-gray-500 bg-gray-800/60 border border-white/5 rounded-lg px-3 py-2">
                  ✅ Match already settled in Supabase
                </div>
                <button
                  onClick={() => handleSettleMatch(true)}
                  disabled={oracleBusy}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20"
                >
                  {oracleBusy
                    ? "Re-settling…"
                    : "↺ Force Re-settle (fetch from Goalserve)"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {!match.goalserve_finished && (
                  <div className="flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                    <span>⏳</span>
                    <span>
                      Waiting for Goalserve to confirm FT… Button enables
                      automatically.
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleSettleMatch(false)}
                  disabled={oracleBusy || !match.goalserve_finished}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500/12 text-orange-400 hover:bg-orange-500/22 border border-orange-500/25"
                >
                  {oracleBusy ? "Settling…" : "🏁 Settle Match"}
                </button>
              </div>
            )}
          </div>

          {/* ── Withdraw Platform Fees ── */}
          {match.status === "finished" && match.contract_address && (
            <div className="bg-gray-900/70 border border-orange-500/15 rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">
                  💰 Withdraw Platform Fees
                </h3>
                <span className="text-[10px] bg-orange-500/15 text-orange-400 px-2 py-0.5 rounded font-mono">
                  onlyOwner
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Calls{" "}
                <code className="text-gray-400">withdrawFees(address)</code> on
                the contract to claim the platform's collected fees to your
                connected MetaMask wallet. Must be called by the contract owner.
              </p>
              {withdrawFeesError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 font-mono break-all">
                  {withdrawFeesError}
                </div>
              )}
              {withdrawFeesTx && (
                <div className="text-[11px] text-green-400 bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2 font-mono break-all">
                  ✅ tx:{" "}
                  <a
                    href={`https://sepolia.etherscan.io/tx/${withdrawFeesTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-green-200 transition-colors"
                  >
                    {withdrawFeesTx}
                  </a>
                </div>
              )}
              <button
                onClick={handleWithdrawFees}
                disabled={withdrawFeesBusy}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 border border-orange-500/20"
              >
                {withdrawFeesBusy
                  ? "Sending tx…"
                  : "💰 withdrawFees() — claim platform revenue (MetaMask)"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "pre-match": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    halftime: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    live: "bg-green-500/10 text-green-400 border-green-500/20",
    finished: "bg-gray-800 text-gray-400 border-white/8",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide border ${
        styles[status] ?? "bg-gray-800 text-gray-400 border-white/5"
      }`}
    >
      {status}
    </span>
  );
}

function Btn({
  onClick,
  color,
  children,
}: {
  onClick: () => void;
  color: "green" | "gray" | "red" | "blue";
  children: React.ReactNode;
}) {
  const styles = {
    green:
      "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20",
    gray: "bg-gray-800/80 text-gray-400 hover:bg-gray-700 border-white/5",
    red: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20",
  };
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all active:scale-[0.97] border ${styles[color]}`}
    >
      {children}
    </button>
  );
}
