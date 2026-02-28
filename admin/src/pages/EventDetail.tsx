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

const ODDS_API_KEY = "46978d34dc5ac52756dd87ffbf9844b0";
// Note: Goalserve key is baked into the Vite proxy rewrite (vite.admin.config.ts)

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
      ) : (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl px-4 py-4 text-gray-600 text-xs text-center">
          {lineup === null
            ? "Fetching Goalserve lineup…"
            : "Lineup not confirmed yet — will appear when Goalserve publishes it"}
        </div>
      )}

      {/* Scorer odds from Odds API */}
      {oddsPlayers.length > 0 && (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <div className="px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-white/5 bg-gray-950/40 font-semibold">
            Scorer Odds (Odds API) — {oddsPlayers.length} players
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
                    {p.odds}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  const [oracleError, setOracleError] = useState<string | null>(null);

  const [h2h, setH2h] = useState<{
    home: number;
    draw: number;
    away: number;
    bookmaker: string;
  } | null>(null);

  async function fetchMatchOdds(m: DbMatch) {
    try {
      const sport =
        (m.odds_api_config as Record<string, string>)?.sport ?? "soccer_epl";
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
      // Write back to Supabase so extension picks up live match odds
      const existingCfg = (m.odds_api_config ?? {}) as Record<string, unknown>;
      await supabase
        .from("matches")
        .update({
          odds_api_config: { ...existingCfg, match_winner_odds: newH2h },
        })
        .eq("id", m.id);
    } catch {
      // silent
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
      const league = cfg?.goalserveLeague ?? "1204";
      let staticId = cfg?.goalserveStaticId ?? "0";

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

      const teamsNode = matchNode.teams ?? {};
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
      const sport =
        (m.odds_api_config as Record<string, string>)?.sport ?? "soccer_epl";
      const eventId = m.external_match_id;
      const res = await fetch(
        `/api/odds/sports/${sport}/events/${eventId}/odds?apiKey=${ODDS_API_KEY}&markets=player_first_goal_scorer&regions=us,uk,eu&oddsFormat=decimal`,
      );
      // Odds fetch is non-fatal — continue seeding with odds=1 if unavailable
      const data = res.ok ? await res.json() : { bookmakers: [] };

      // Collect best price per player across all bookmakers
      const priceMap = new Map<string, number>();
      for (const bm of data.bookmakers ?? []) {
        const mkt = (bm.markets ?? []).find(
          (mk: { key: string }) => mk.key === "player_first_goal_scorer",
        );
        if (!mkt) continue;
        for (const o of mkt.outcomes ?? []) {
          const pName: string = (o.description ?? o.name ?? "").trim();
          if (
            pName &&
            o.price &&
            pName.toLowerCase() !== "no scorer" &&
            !priceMap.has(pName)
          )
            priceMap.set(pName, o.price);
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
      // (skip if no odds available — nothing to update)
      if (p.length > 0) {
        if (priceMap.size === 0) return;
        const toUpdate: { id: string; price: number }[] = [];
        for (const [oddsName, price] of priceMap) {
          const normOdds = norm(oddsName);
          const oddsSurname = normOdds.split(/\s+/).pop() ?? "";
          const dbPlayer = p.find((pl) => {
            const normDb = norm(pl.name);
            const dbSurname = normDb.split(/\s+/).pop() ?? "";
            return (
              normDb === normOdds ||
              (oddsSurname.length >= 4 && dbSurname === oddsSurname)
            );
          });
          if (dbPlayer) toUpdate.push({ id: dbPlayer.id, price });
        }
        if (toUpdate.length === 0) return;
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
          `NGS odds synced — ${toUpdate.length} players updated`,
          "green",
        );
        return;
      }

      // ── Goalserve-first seeding ─────────────────────────────────────────
      // Goalserve is source of truth for the squad (20 players).
      // Odds API odds are matched to each Goalserve player by name.
      // Players not in the Goalserve squad (Odds API ghosts) are discarded.

      const lu = lineupData ?? lineup;
      if (!lu) {
        showToast("No Goalserve lineup — cannot seed players", "red");
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
              setMatch(payload.new as DbMatch);
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
        source: "admin_manual",
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

  async function handleSettleMatch() {
    if (!match) return;
    const activeScorers = goals
      .filter((g) => g.event_type !== "VAR_OVERTURNED" && g.confirmed)
      .map((g) => g.player_id);
    if (activeScorers.length === 0) {
      setOracleError(
        "No confirmed goals yet. Confirm at least one goal before settling.",
      );
      return;
    }
    setOracleBusy(true);
    setOracleError(null);
    setOracleTx(null);
    try {
      // 1. Call GoalLiveBetting.settleMatch on-chain
      const homeGoals = match.score_home ?? 0;
      const awayGoals = match.score_away ?? 0;
      const winner = homeGoals > awayGoals ? 0 : homeGoals < awayGoals ? 2 : 1;
      const txHash = await contractService.settleMatchOnChain(
        match.contract_address ?? "",
        match.external_match_id,
        activeScorers,
        winner as 0 | 1 | 2,
        homeGoals,
        awayGoals,
      );
      // 2. Trigger settle-match Edge Function to settle bets in Supabase
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/settle-match`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ match_id: match.id }),
        });
        if (!res.ok) console.warn("settle-match edge fn:", await res.text());
      } catch (edgeErr) {
        console.warn("settle-match edge fn unreachable:", edgeErr);
      }
      // 3. Update local match status
      await supabase
        .from("matches")
        .update({ status: "finished" })
        .eq("id", match.id);
      setMatch((m) => (m ? { ...m, status: "finished" } : m));
      setOracleTx(txHash);
      showToast("🏁 Match settled on-chain", "orange");
    } catch (e) {
      setOracleError(String(e));
    } finally {
      setOracleBusy(false);
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

          {/* Settle Match */}
          <div className="bg-gray-900/70 border border-white/5 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">
              🏁 Settle Match On-Chain
            </h3>
            <p className="text-xs text-gray-500">
              Calls{" "}
              <span className="font-mono text-gray-400">
                GoalLiveBetting.settleMatch()
              </span>{" "}
              with all <strong className="text-white">confirmed</strong> goal
              scorers, then triggers the{" "}
              <span className="font-mono text-gray-400">settle-match</span> Edge
              Function to close out bets in Supabase.
            </p>
            {goals.filter(
              (g) => g.confirmed && g.event_type !== "VAR_OVERTURNED",
            ).length > 0 ? (
              <div className="flex flex-wrap gap-2 mb-1">
                {goals
                  .filter(
                    (g) => g.confirmed && g.event_type !== "VAR_OVERTURNED",
                  )
                  .map((g) => (
                    <span
                      key={g.id}
                      className="text-[11px] px-2 py-0.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full font-medium"
                    >
                      {g.player_name} {g.minute}'
                    </span>
                  ))}
              </div>
            ) : (
              <p className="text-[11px] text-yellow-500">
                ⚠ No confirmed goals. Go to the <strong>Goals</strong> tab and
                confirm scorers first.
              </p>
            )}
            <button
              onClick={handleSettleMatch}
              disabled={oracleBusy || match.status === "finished"}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed bg-orange-500/12 text-orange-400 hover:bg-orange-500/22 border border-orange-500/25"
            >
              {match.status === "finished"
                ? "✅ Match already settled"
                : oracleBusy
                  ? "Settling…"
                  : "🏁 Settle Match"}
            </button>
          </div>
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
