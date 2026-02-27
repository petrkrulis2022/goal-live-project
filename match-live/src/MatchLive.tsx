import { useEffect, useRef, useState } from "react";

// ─── URL-param-driven config (falls back to Plzeň/EL defaults) ───────────────
const _sp = new URLSearchParams(
  typeof window !== "undefined" ? window.location.search : "",
);
const LEAGUE_ID = _sp.get("goalserveLeague") ?? "1007";
const MATCH_STATIC_ID = _sp.get("goalserveStaticId") ?? "3826786";
const ODDS_EVENT_ID =
  _sp.get("oddsEventId") ?? "551f9026650eeec36791c0482c8b97d9";
const ODDS_SPORT = _sp.get("sport") ?? "soccer_uefa_europa_league";
const ODDS_API_KEY = "069be437bad9795678cdc1c1cee711c3";
const HOME_HINT = _sp.get("home") ?? "Viktoria Plzeň";
const AWAY_HINT = _sp.get("away") ?? "Panathinaikos FC";
const COMPETITION_LABEL = _sp.get("competition") ?? "UEFA Europa League";
const KICKOFF_LABEL = _sp.get("kickoff") ?? "18:45 CET";
const POLL_INTERVAL = 30_000; // Goalserve: every 30 s
const ODDS_POLL_INTERVAL = 300_000; // Odds API:  every 5 min (1 credit/call, 500 credits/month)

/** 2-3 char abbreviation: "FC Lausanne-Sport" → "FLS", "Sigma Olomouc" → "SO" */
function teamAbbrev(name: string): string {
  const words = name
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (words.length === 1) return name.slice(0, 3).toUpperCase();
  return words
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

// scorer odds are fetched live from The Odds API — see fetchScorerOdds()

// ─── Types ────────────────────────────────────────────────────────────────────
interface GoalEvent {
  name: string;
  minute: string;
  extra_min: string;
  owngoal: string;
  var_cancelled: string;
  penalty: string;
  team: "home" | "away";
}

interface Player {
  num: string;
  name: string;
  pos: string;
  isSubst: boolean;
  isCaptain: boolean;
}

interface MatchData {
  status: string;
  timer: string;
  homeScore: string;
  awayScore: string;
  homeName: string;
  awayName: string;
  homeFormation: string;
  awayFormation: string;
  homeGoals: GoalEvent[];
  awayGoals: GoalEvent[];
  homePlayers: Player[];
  awayPlayers: Player[];
  homeSubstitutes: Player[];
  awaySubstitutes: Player[];
  lastUpdated: string;
}

interface H2HOdds {
  home: number;
  draw: number;
  away: number;
  bookmaker: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toArr<T>(x: T | T[] | null | undefined): T[] {
  if (!x) return [];
  return Array.isArray(x) ? x : [x];
}

function parsePlayers(teamNode: any): Player[] {
  if (!teamNode) return [];
  return toArr(teamNode.player as any)
    .filter((p: any) => p && p["@name"])
    .map((p: any) => ({
      num: p["@number"] ?? p["@num"] ?? "",
      name: p["@name"] ?? "",
      pos: p["@pos"] ?? "",
      isSubst: false,
      isCaptain: p["@isCaptain"] === "True" || p["@isCaptain"] === "true",
    }));
}

function parseGoals(teamSummary: any): GoalEvent[] {
  if (!teamSummary?.goals) return [];
  return toArr(teamSummary.goals.player).map((p: any) => ({
    name: p["@name"],
    minute: p["@minute"],
    extra_min: p["@extra_min"] ?? "",
    owngoal: p["@owngoal"] ?? "False",
    var_cancelled: p["@var_cancelled"] ?? "False",
    penalty: p["@penalty"] ?? "False",
    team: "home" as const,
  }));
}

// ─── Fallback odds — last known Betfair Exchange values at 1:1 (26 Feb 2026) ──
// Shown when The Odds API quota is exhausted so the panel is never blank.
const FALLBACK_H2H: H2HOdds = {
  home: 3.0,
  draw: 2.02,
  away: 5.3,
  bookmaker: "Betfair Exchange",
};

// ─── Component ────────────────────────────────────────────────────────────────
interface ScorerOdd {
  name: string;
  team: "home" | "away" | "unknown";
  odds: number;
}

export default function MatchLive() {
  const [match, setMatch] = useState<MatchData | null>(null);
  const [h2h, setH2h] = useState<H2HOdds | null>(FALLBACK_H2H);
  const [oddsCached, setOddsCached] = useState(true);
  const [scorerOdds, setScorerOdds] = useState<ScorerOdd[]>([]);
  const [lastScorerPoll, setLastScorerPoll] = useState<Date | null>(null);
  const [tab, setTab] = useState<"lineups" | "odds" | "scorers">("lineups");
  const [error, setError] = useState("");
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const [lastOddsPoll, setLastOddsPoll] = useState<Date | null>(null);
  const prevGoalCount = useRef(0);
  const prevH2h = useRef<H2HOdds | null>(null);
  const [oddsChanged, setOddsChanged] = useState<{
    home: boolean;
    draw: boolean;
    away: boolean;
  }>({ home: false, draw: false, away: false });
  const [newGoalFlash, setNewGoalFlash] = useState(false);
  const discoveredId = useRef<string>("0");

  // ── Fetch Goalserve ────────────────────────────────────────────────────────
  async function fetchMatch() {
    try {
      // Auto-discover static_id from live feed if none was configured
      if (MATCH_STATIC_ID === "0" && discoveredId.current === "0") {
        const liveRes = await fetch(
          `/api/goalserve/soccer/soccerlive?cat=soccerlive&league=${LEAGUE_ID}`,
        );
        const liveText = await liveRes.text();
        if (!liveText.trim()) {
          setError("Waiting for match to start…");
          return;
        }
        const parser = new DOMParser();
        const doc = parser.parseFromString(liveText, "application/xml");
        const homeWord = HOME_HINT.split(" ")[0].toLowerCase();
        const awayWord = AWAY_HINT.split(" ")[0].toLowerCase();
        const found = Array.from(doc.querySelectorAll("match")).find((el) => {
          const lt = el.querySelector("localteam")?.getAttribute("name") ?? "";
          const vt =
            el.querySelector("visitorteam")?.getAttribute("name") ?? "";
          return (
            lt.toLowerCase().includes(homeWord) ||
            vt.toLowerCase().includes(awayWord)
          );
        });
        if (!found) {
          setError("Match not found in live feed — waiting for kick-off");
          return;
        }
        const sid =
          found.getAttribute("static_id") ?? found.getAttribute("id") ?? "";
        if (sid) discoveredId.current = sid;
      }

      const staticId =
        MATCH_STATIC_ID !== "0" ? MATCH_STATIC_ID : discoveredId.current;
      if (staticId === "0") return; // still discovering

      const res = await fetch(
        `/api/goalserve/commentaries/match?id=${staticId}&league=${LEAGUE_ID}&json=1`,
      );
      const data = await res.json();

      // navigate to match node
      const raw: any =
        data?.commentaries?.tournament?.match ??
        data?.commentaries?.match ??
        null;

      if (!raw) {
        setError("Match data not yet available");
        return;
      }

      const m = Array.isArray(raw) ? raw[0] : raw;

      const lt = m.localteam ?? {};
      const vt = m.visitorteam ?? {};
      const sum = m.summary ?? {};

      // Lineups: pre-match → teams node; in-play → player_stats node (fallback)
      const teamsNode = m.teams ?? {};
      const subsNode = m.substitutes ?? {};
      const statsNode = m.player_stats ?? {};

      const homeGoals = parseGoals(sum.localteam).map((g) => ({
        ...g,
        team: "home" as const,
      }));
      const awayGoals = parseGoals(sum.visitorteam).map((g) => ({
        ...g,
        team: "away" as const,
      }));

      const totalGoals = homeGoals.length + awayGoals.length;
      if (totalGoals > prevGoalCount.current) {
        setNewGoalFlash(true);
        setTimeout(() => setNewGoalFlash(false), 3000);
      }
      prevGoalCount.current = totalGoals;

      // teams node = starters only (has @formation_pos), substitutes node = bench only
      // player_stats appears during live play — has both starters + subs mixed, use @isSubst to split
      let homeStarters: ReturnType<typeof parsePlayers>;
      let awayStarters: ReturnType<typeof parsePlayers>;
      let homeSubs: ReturnType<typeof parsePlayers>;
      let awaySubs: ReturnType<typeof parsePlayers>;

      if (statsNode?.localteam?.player) {
        // Live: player_stats has everyone, split by @isSubst
        const allHome = toArr(statsNode.localteam.player)
          .filter((p: any) => p?.["@name"])
          .map((p: any) => ({
            num: p["@number"] ?? p["@num"] ?? "",
            name: p["@name"] ?? "",
            pos: p["@pos"] ?? "",
            isSubst: p["@isSubst"] === "True" || p["@isSubst"] === "true",
            isCaptain: p["@isCaptain"] === "True" || p["@isCaptain"] === "true",
          }));
        const allAway = toArr(statsNode.visitorteam?.player)
          .filter((p: any) => p?.["@name"])
          .map((p: any) => ({
            num: p["@number"] ?? p["@num"] ?? "",
            name: p["@name"] ?? "",
            pos: p["@pos"] ?? "",
            isSubst: p["@isSubst"] === "True" || p["@isSubst"] === "true",
            isCaptain: p["@isCaptain"] === "True" || p["@isCaptain"] === "true",
          }));
        homeStarters = allHome.filter((p) => !p.isSubst);
        homeSubs = allHome.filter((p) => p.isSubst);
        awayStarters = allAway.filter((p) => !p.isSubst);
        awaySubs = allAway.filter((p) => p.isSubst);
      } else {
        // Pre-match: teams node has only starters, substitutes node has only bench
        homeStarters = parsePlayers(teamsNode.localteam);
        awayStarters = parsePlayers(teamsNode.visitorteam);
        homeSubs = parsePlayers(subsNode.localteam);
        awaySubs = parsePlayers(subsNode.visitorteam);
      }

      setMatch({
        status: m["@status"] ?? "Not Started",
        timer: m["@timer"] ?? "",
        homeScore: lt["@goals"] ?? "0",
        awayScore: vt["@goals"] ?? "0",
        homeName: lt["@name"] ?? HOME_HINT,
        awayName: vt["@name"] ?? AWAY_HINT,
        homeFormation: teamsNode.localteam?.["@formation"] ?? "",
        awayFormation: teamsNode.visitorteam?.["@formation"] ?? "",
        homeGoals,
        awayGoals,
        homePlayers: homeStarters,
        awayPlayers: awayStarters,
        homeSubstitutes: homeSubs,
        awaySubstitutes: awaySubs,
        lastUpdated: new Date().toLocaleTimeString(),
      });
      setLastPoll(new Date());
      setError("");
    } catch (e: any) {
      setError("Goalserve fetch failed: " + e.message);
    }
  }

  // ── Fetch Odds ─────────────────────────────────────────────────────────────
  async function fetchOdds() {
    try {
      const res = await fetch(
        `/api/odds/sports/${ODDS_SPORT}/events/${ODDS_EVENT_ID}/odds/?apiKey=${ODDS_API_KEY}&markets=h2h&bookmakers=betfair_ex_eu`,
      );
      const data = await res.json();
      if (data.message) {
        // Quota exhausted or other API error — keep current (cached) odds
        setOddsCached(true);
        return;
      }

      // Single bookmaker: grab Betfair Exchange directly
      const bm = data.bookmakers?.[0];
      if (!bm) {
        setOddsCached(true);
        return;
      }
      const h2hMkt = bm.markets?.find((m: any) => m.key === "h2h");
      if (!h2hMkt) {
        setOddsCached(true);
        return;
      }
      const newH2h = {
        home:
          h2hMkt.outcomes.find((o: any) => o.name === data.home_team)?.price ??
          0,
        draw: h2hMkt.outcomes.find((o: any) => o.name === "Draw")?.price ?? 0,
        away:
          h2hMkt.outcomes.find((o: any) => o.name === data.away_team)?.price ??
          0,
        bookmaker: bm.title,
      };
      // detect changes vs previous fetch
      if (prevH2h.current) {
        const changed = {
          home: prevH2h.current.home !== newH2h.home,
          draw: prevH2h.current.draw !== newH2h.draw,
          away: prevH2h.current.away !== newH2h.away,
        };
        if (changed.home || changed.draw || changed.away) {
          setOddsChanged(changed);
          setTimeout(
            () => setOddsChanged({ home: false, draw: false, away: false }),
            3000,
          );
        }
      }
      prevH2h.current = newH2h;
      setH2h(newH2h);
      setOddsCached(false);
      setLastOddsPoll(new Date());
    } catch (_) {
      /* silent */
    }
  }

  // ── Fetch first-goalscorer odds from The Odds API ────────────────────────
  async function fetchScorerOdds(currentMatch?: MatchData | null) {
    try {
      const res = await fetch(
        `/api/odds/sports/${ODDS_SPORT}/events/${ODDS_EVENT_ID}/odds?apiKey=${ODDS_API_KEY}&markets=player_first_goal_scorer&regions=us,uk,eu&oddsFormat=decimal`,
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.message) return; // quota exhausted

      // Collect best price per player name across all bookmakers
      const priceMap = new Map<string, number>();
      for (const bm of data.bookmakers ?? []) {
        const mkt = (bm.markets ?? []).find(
          (mk: { key: string }) => mk.key === "player_first_goal_scorer",
        );
        if (!mkt) continue;
        for (const o of mkt.outcomes ?? []) {
          const name: string = (o.description ?? o.name ?? "").trim();
          if (name && o.price && !priceMap.has(name))
            priceMap.set(name, o.price);
        }
      }
      if (priceMap.size === 0) return;

      // Assign home/away by cross-referencing Goalserve lineup (already fetched)
      const m = currentMatch;
      const homePlayers = [
        ...(m?.homePlayers ?? []),
        ...(m?.homeSubstitutes ?? []),
      ].map((p) => p.name.toLowerCase());
      const awayPlayers = [
        ...(m?.awayPlayers ?? []),
        ...(m?.awaySubstitutes ?? []),
      ].map((p) => p.name.toLowerCase());

      function assignTeam(oddsName: string): "home" | "away" | "unknown" {
        const needle = oddsName.toLowerCase();
        // exact match first
        if (homePlayers.some((n) => n === needle)) return "home";
        if (awayPlayers.some((n) => n === needle)) return "away";
        // partial match (last name token)
        const lastName = needle.split(" ").pop() ?? needle;
        if (homePlayers.some((n) => n.includes(lastName))) return "home";
        if (awayPlayers.some((n) => n.includes(lastName))) return "away";
        return "unknown";
      }

      const result: ScorerOdd[] = Array.from(priceMap.entries())
        .filter(([name]) => name.toLowerCase() !== "no scorer")
        .map(([name, odds]) => ({ name, odds, team: assignTeam(name) }))
        .sort((a, b) => a.odds - b.odds);

      setScorerOdds(result);
      setLastScorerPoll(new Date());
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    fetchMatch();
    fetchOdds();
    fetchScorerOdds();
    const matchIv = setInterval(fetchMatch, 15_000);
    const oddsIv = setInterval(fetchOdds, ODDS_POLL_INTERVAL);
    const scorerIv = setInterval(
      () => fetchScorerOdds(prevMatchRef.current),
      ODDS_POLL_INTERVAL,
    );
    return () => {
      clearInterval(matchIv);
      clearInterval(oddsIv);
      clearInterval(scorerIv);
    };
  }, []);

  // Re-run scorer team assignment whenever Goalserve lineup arrives
  const prevMatchRef = useRef<MatchData | null>(null);
  useEffect(() => {
    if (!match) return;
    const hadLineup = (prevMatchRef.current?.homePlayers.length ?? 0) > 0;
    const hasLineup = match.homePlayers.length > 0;
    if (!hadLineup && hasLineup) {
      // Lineup just arrived — re-assign teams for existing scorer odds
      fetchScorerOdds(match);
    }
    prevMatchRef.current = match;
  }, [match]);

  // ─── Status helpers ────────────────────────────────────────────────────────
  const isLive =
    match?.status === "In Progress" || /^\d+$/.test(match?.timer ?? "");
  const isFT = match?.status === "Full-time";
  const allGoals = [
    ...(match?.homeGoals ?? []).map((g) => ({ ...g, team: "home" as const })),
    ...(match?.awayGoals ?? []).map((g) => ({ ...g, team: "away" as const })),
  ].sort((a, b) => Number(a.minute) - Number(b.minute));

  const homeScorerOdds = scorerOdds.filter((s) => s.team === "home");
  const awayScorerOdds = scorerOdds.filter((s) => s.team === "away");
  const unknownScorerOdds = scorerOdds.filter((s) => s.team === "unknown");

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-200 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-5 fade-in">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xs font-semibold uppercase tracking-widest text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full">
            {COMPETITION_LABEL}
          </div>
          <div className="text-xs text-slate-500">Round of 16 · Play-offs</div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            {lastPoll && (
              <div className="text-xs text-slate-600">
                ⚽ Score: {lastPoll.toLocaleTimeString()}
              </div>
            )}
            {lastOddsPoll && (
              <div className="text-xs text-slate-600">
                📊 Odds: {lastOddsPoll.toLocaleTimeString()}
              </div>
            )}
            {lastScorerPoll && (
              <div className="text-xs text-slate-600">
                🎯 Scorers: {lastScorerPoll.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/40 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Scoreboard ── */}
        <div
          className={`section-card relative overflow-hidden transition-colors duration-1000 ${newGoalFlash ? "bg-yellow-400/10" : ""}`}
        >
          {/* live pulse */}
          {isLive && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <span className="live-dot w-2 h-2 rounded-full bg-green-400 inline-block" />
              <span className="text-xs font-bold text-green-400 uppercase tracking-wider">
                Live
              </span>
            </div>
          )}
          {isFT && (
            <div className="absolute top-3 right-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              Full Time
            </div>
          )}
          {!isLive && !isFT && (
            <div className="absolute top-3 right-3 text-xs font-bold text-amber-400 uppercase tracking-wider">
              {match?.status ?? "Pre-Match"}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 py-4">
            {/* Home */}
            <div className="flex-1 text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center text-lg font-black">
                {teamAbbrev(match?.homeName ?? HOME_HINT)}
              </div>
              <div className="text-base md:text-lg font-bold leading-tight">
                {match?.homeName ?? HOME_HINT}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Home</div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-1 min-w-[120px]">
              <div className="flex items-center gap-3 score-box">
                <span className="text-5xl md:text-6xl font-black tabular-nums">
                  {match?.homeScore ?? "0"}
                </span>
                <span className="text-3xl text-slate-600 font-light">:</span>
                <span className="text-5xl md:text-6xl font-black tabular-nums">
                  {match?.awayScore ?? "0"}
                </span>
              </div>
              {isLive && match?.timer ? (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-600 text-white text-xs font-mono font-semibold">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {match.timer}&apos;
                </div>
              ) : (
                <div className="text-sm font-semibold text-slate-400">
                  {isFT ? "FT" : KICKOFF_LABEL}
                </div>
              )}
              {/* goal events mini-list */}
              {allGoals.length > 0 && (
                <div className="mt-2 space-y-0.5 text-center">
                  {allGoals.map((g, i) => (
                    <div key={i} className="text-xs text-slate-400">
                      {g.var_cancelled === "True"
                        ? "❌ "
                        : g.owngoal === "True"
                          ? "⚽ OG "
                          : "⚽ "}
                      {g.name} {g.minute}'{g.extra_min ? `+${g.extra_min}` : ""}
                      {g.penalty === "True" ? " (P)" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Away */}
            <div className="flex-1 text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-gradient-to-br from-green-700 to-green-900 flex items-center justify-center text-lg font-black">
                {teamAbbrev(match?.awayName ?? AWAY_HINT)}
              </div>
              <div className="text-base md:text-lg font-bold leading-tight">
                {match?.awayName ?? AWAY_HINT}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">Away</div>
            </div>
          </div>
        </div>

        {/* ── 1X2 best odds strip ── */}
        {h2h && (
          <div className="section-card">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-semibold flex items-center justify-between">
              <span>Match Result — Betfair Exchange</span>
              {oddsCached && (
                <span className="text-amber-500/80 normal-case tracking-normal text-[10px] font-normal border border-amber-500/30 rounded px-1.5 py-0.5">
                  live odds unavailable
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  {
                    label: `1 · ${(match?.homeName ?? HOME_HINT).split(" ")[0]}`,
                    val: h2h.home,
                    changed: oddsChanged.home,
                  },
                  {
                    label: "X · Draw",
                    val: h2h.draw,
                    changed: oddsChanged.draw,
                  },
                  {
                    label: `2 · ${(match?.awayName ?? AWAY_HINT).split(" ")[0]}`,
                    val: h2h.away,
                    changed: oddsChanged.away,
                  },
                ] as { label: string; val: number; changed: boolean }[]
              ).map(({ label, val, changed }) => (
                <div
                  key={label}
                  className={`flex flex-col items-center gap-1 rounded-xl py-4 px-2 transition-colors duration-700 ${
                    changed ? "bg-yellow-500/20" : "bg-[#1e293b]"
                  }`}
                >
                  <span className="text-xs text-slate-400 font-medium text-center">
                    {label}
                  </span>
                  <span
                    className={`text-2xl font-black tabular-nums transition-colors duration-700 ${
                      changed ? "text-yellow-300" : "text-blue-400"
                    }`}
                  >
                    {val.toFixed(2)}
                  </span>
                  {changed && (
                    <span className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wide">
                      updated
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="border-b border-slate-800 flex gap-1">
          {(["lineups", "odds", "scorers"] as const).map((t) => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "lineups"
                ? "Lineups"
                : t === "odds"
                  ? "Betfair Odds"
                  : `1st Scorer${scorerOdds.length ? ` (${scorerOdds.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* ── Lineups tab ── */}
        {tab === "lineups" && (
          <div className="grid md:grid-cols-2 gap-4 fade-in">
            {/* Home */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-blue-700 text-[10px] font-black flex items-center justify-center">
                  {teamAbbrev(match?.homeName ?? HOME_HINT)}
                </div>
                <span className="font-bold text-sm">
                  {match?.homeName ?? HOME_HINT}
                </span>
                {match?.homeFormation && (
                  <span className="ml-auto text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded font-mono">
                    {match.homeFormation}
                  </span>
                )}
              </div>
              {match?.homePlayers && match.homePlayers.length > 0 ? (
                <>
                  <div className="text-xs text-slate-600 uppercase tracking-wider mb-1 px-4">
                    Starting XI
                  </div>
                  {match.homePlayers.map((p, i) => (
                    <div key={i} className="player-row">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-5 text-right">
                          {p.num || i + 1}
                        </span>
                        <span className="text-sm">
                          {p.name}
                          {p.isCaptain ? " 🅲" : ""}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {p.pos}
                      </span>
                    </div>
                  ))}
                  {match.homeSubstitutes.length > 0 && (
                    <>
                      <div className="text-xs text-slate-600 uppercase tracking-wider mt-3 mb-1 px-4">
                        Substitutes
                      </div>
                      {match.homeSubstitutes.map((p, i) => (
                        <div key={i} className="player-row opacity-60">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-600 w-5 text-right">
                              {p.num}
                            </span>
                            <span className="text-sm">{p.name}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {p.pos}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-500 px-4 py-6 text-center">
                  Lineup not published yet
                </div>
              )}
            </div>

            {/* Away */}
            <div className="section-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-green-700 text-[10px] font-black flex items-center justify-center">
                  {teamAbbrev(match?.awayName ?? AWAY_HINT)}
                </div>
                <span className="font-bold text-sm">
                  {match?.awayName ?? AWAY_HINT}
                </span>
                {match?.awayFormation && (
                  <span className="ml-auto text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded font-mono">
                    {match.awayFormation}
                  </span>
                )}
              </div>
              {match?.awayPlayers && match.awayPlayers.length > 0 ? (
                <>
                  <div className="text-xs text-slate-600 uppercase tracking-wider mb-1 px-4">
                    Starting XI
                  </div>
                  {match.awayPlayers.map((p, i) => (
                    <div key={i} className="player-row">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-5 text-right">
                          {p.num || i + 1}
                        </span>
                        <span className="text-sm">
                          {p.name}
                          {p.isCaptain ? " 🅲" : ""}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        {p.pos}
                      </span>
                    </div>
                  ))}
                  {match.awaySubstitutes.length > 0 && (
                    <>
                      <div className="text-xs text-slate-600 uppercase tracking-wider mt-3 mb-1 px-4">
                        Substitutes
                      </div>
                      {match.awaySubstitutes.map((p, i) => (
                        <div key={i} className="player-row opacity-60">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-600 w-5 text-right">
                              {p.num}
                            </span>
                            <span className="text-sm">{p.name}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-medium">
                            {p.pos}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <div className="text-sm text-slate-500 px-4 py-6 text-center">
                  Lineup not published yet
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Betfair Odds tab ── */}
        {tab === "odds" && (
          <div className="section-card fade-in">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-4 font-semibold flex items-center justify-between">
              <span>1X2 Odds · Betfair Exchange</span>
              {oddsCached && (
                <span className="text-amber-500/80 normal-case tracking-normal text-[10px] font-normal border border-amber-500/30 rounded px-1.5 py-0.5">
                  live odds unavailable
                </span>
              )}
            </div>
            {h2h ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: `1 · ${(match?.homeName ?? HOME_HINT).split(" ")[0]}`,
                    val: h2h.home,
                  },
                  { label: "X · Draw", val: h2h.draw },
                  {
                    label: `2 · ${(match?.awayName ?? AWAY_HINT).split(" ")[0]}`,
                    val: h2h.away,
                  },
                ].map(({ label, val }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-1 rounded-xl py-5 px-2 bg-[#1e293b]"
                  >
                    <span className="text-xs text-slate-400 font-medium text-center">
                      {label}
                    </span>
                    <span className="text-3xl font-black tabular-nums text-blue-400">
                      {val.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 text-center py-8">
                Loading odds…
              </div>
            )}
            <p className="text-[11px] text-slate-600 mt-3 text-right">
              Source: Betfair Exchange · updated every 5 min
            </p>
          </div>
        )}

        {/* ── First Scorer tab ── */}
        {tab === "scorers" && (
          <div className="fade-in">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-semibold px-1 flex items-center justify-between">
              <span>First Goalscorer · The Odds API (best price)</span>
              {lastScorerPoll && (
                <span className="normal-case tracking-normal font-normal text-[10px]">
                  updated {lastScorerPoll.toLocaleTimeString()}
                </span>
              )}
            </div>

            {scorerOdds.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-10 section-card">
                Fetching first goalscorer odds…
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {/* Home */}
                <div className="section-card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-blue-700 text-[10px] font-black flex items-center justify-center">
                      {teamAbbrev(match?.homeName ?? HOME_HINT)}
                    </div>
                    <span className="font-bold text-sm">
                      {match?.homeName ?? HOME_HINT}
                    </span>
                  </div>
                  {homeScorerOdds.length > 0 ? (
                    homeScorerOdds.map((s, i) => (
                      <div key={i} className="player-row">
                        <span className="text-sm">{s.name}</span>
                        <span
                          className={`odds-badge ${s.odds <= 10 ? "best" : ""}`}
                        >
                          {s.odds.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-600 px-4 py-4">
                      Waiting for lineup to assign teams…
                    </div>
                  )}
                </div>

                {/* Away */}
                <div className="section-card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-green-700 text-[10px] font-black flex items-center justify-center">
                      {teamAbbrev(match?.awayName ?? AWAY_HINT)}
                    </div>
                    <span className="font-bold text-sm">
                      {match?.awayName ?? AWAY_HINT}
                    </span>
                  </div>
                  {awayScorerOdds.length > 0 ? (
                    awayScorerOdds.map((s, i) => (
                      <div key={i} className="player-row">
                        <span className="text-sm">{s.name}</span>
                        <span
                          className={`odds-badge ${s.odds <= 10 ? "best" : ""}`}
                        >
                          {s.odds.toFixed(2)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-slate-600 px-4 py-4">
                      Waiting for lineup to assign teams…
                    </div>
                  )}
                </div>

                {/* Unknown team — show until Goalserve lineup arrives */}
                {unknownScorerOdds.length > 0 && (
                  <div className="section-card md:col-span-2">
                    <div className="text-xs text-slate-600 mb-2">
                      Team unconfirmed (lineup pending) — will auto-assign when
                      Goalserve publishes the lineup
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-6">
                      {unknownScorerOdds.map((s, i) => (
                        <div key={i} className="player-row">
                          <span className="text-sm text-slate-400">
                            {s.name}
                          </span>
                          <span className="odds-badge">
                            {s.odds.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="text-xs text-slate-700 text-center pb-4">
          Live data: Goalserve every 15s · 1X2 + Scorer odds: The Odds API every
          5min
        </div>
      </div>
    </div>
  );
}
