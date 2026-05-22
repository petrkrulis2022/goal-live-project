import { useCallback, useEffect, useRef, useState } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const GS_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const HOME_FEED = `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`;
const POLL_MS = 5_000;
const LS_KEY = "football-active-games";

const LEAGUE_SOURCES = [
  { id: "1399", name: "La Liga" },
  { id: "1269", name: "Serie A" },
  { id: "1204", name: "Premier League" },
  { id: "1221", name: "Ligue 1" },
  { id: "1005", name: "Champions League" },
  { id: "1007", name: "Europa League" },
];

const LEAGUE_COLORS: Record<
  string,
  { bar: string; badge: string; text: string }
> = {
  "La Liga": {
    bar: "from-red-500 to-yellow-500",
    badge: "bg-red-500/15 border-red-500/30 text-red-400",
    text: "text-red-400",
  },
  "Serie A": {
    bar: "from-blue-500 to-sky-400",
    badge: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    text: "text-blue-400",
  },
  "Premier League": {
    bar: "from-purple-500 to-violet-400",
    badge: "bg-purple-500/15 border-purple-500/30 text-purple-400",
    text: "text-purple-400",
  },
  "Ligue 1": {
    bar: "from-sky-500 to-cyan-400",
    badge: "bg-sky-500/15 border-sky-500/30 text-sky-400",
    text: "text-sky-400",
  },
  "Champions League": {
    bar: "from-indigo-500 to-blue-400",
    badge: "bg-indigo-500/15 border-indigo-500/30 text-indigo-400",
    text: "text-indigo-400",
  },
  "Europa League": {
    bar: "from-orange-500 to-amber-400",
    badge: "bg-orange-500/15 border-orange-500/30 text-orange-400",
    text: "text-orange-400",
  },
};

const DEFAULT_COLORS = {
  bar: "from-green-500 to-emerald-400",
  badge: "bg-green-500/15 border-green-500/30 text-green-400",
  text: "text-green-400",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ActiveFootballGame {
  id: string;
  teams: [string, string]; // [home, away]
  kickoff: string;
  date: string;
  league: string;
  gsLeagueId: string;
}

interface PickerGame {
  id: string;
  teams: [string, string];
  kickoff: string;
  date: string;
  league: string;
  gsLeagueId: string;
  status: string;
}

interface GoalLogEntry {
  minute: string;
  team: string;
  scoreHome: number;
  scoreAway: number;
  ts: string;
}

interface GameState {
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  status: string;
  goalLog: GoalLogEntry[];
  flashing: boolean;
  found: boolean;
  finished: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function matchesGame(
  home: string,
  away: string,
  teams: [string, string],
): boolean {
  const [a, b] = teams;
  return (
    (home.toLowerCase().includes(a.toLowerCase()) ||
      away.toLowerCase().includes(a.toLowerCase())) &&
    (home.toLowerCase().includes(b.toLowerCase()) ||
      away.toLowerCase().includes(b.toLowerCase()))
  );
}

function statusLabel(s: string): { text: string; live: boolean } {
  if (s === "FT") return { text: "FULL TIME", live: false };
  if (s === "HT") return { text: "HALF TIME", live: true };
  if (/^\d+$/.test(s)) return { text: `${s}'`, live: true };
  return { text: s || "—", live: false };
}

function nowTime() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function defaultState(game: ActiveFootballGame): GameState {
  return {
    homeName: game.teams[0],
    awayName: game.teams[1],
    scoreHome: 0,
    scoreAway: 0,
    status: "",
    goalLog: [],
    flashing: false,
    found: false,
    finished: false,
  };
}

function weekDateRange(): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = -1; i <= 6; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    dates.push(`${dd}.${mm}.${d.getFullYear()}`);
  }
  return dates;
}

function dateLabel(ddMmYyyy: string): string {
  const [dd, mm, yyyy] = ddMmYyyy.split(".");
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// ─── Goal sound ───────────────────────────────────────────────────────────────
function playGoalSound(ctx: AudioContext) {
  const notes = [
    { freq: 523.25, start: 0, dur: 0.12 },
    { freq: 659.25, start: 0.13, dur: 0.12 },
    { freq: 783.99, start: 0.26, dur: 0.12 },
    { freq: 1046.5, start: 0.39, dur: 0.45 },
  ];
  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.45, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LiveManager() {
  const [activeGames, setActiveGames] = useState<ActiveFootballGame[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [pickerGames, setPickerGames] = useState<PickerGame[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [gameStates, setGameStates] = useState<Record<string, GameState>>({});
  const [pollCount, setPollCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeGamesRef = useRef<ActiveFootballGame[]>(activeGames);
  const prevScoresRef = useRef<Record<string, { home: number; away: number }>>(
    {},
  );

  // Keep ref in sync
  useEffect(() => {
    activeGamesRef.current = activeGames;
  }, [activeGames]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(activeGames));
  }, [activeGames]);

  // Unlock audio
  const unlockAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    audioCtxRef.current = new AudioContext();
    setAudioReady(true);
  }, []);

  // ── Fetch available fixtures ──────────────────────────────────────────────
  useEffect(() => {
    async function fetchGames() {
      setPickerLoading(true);
      const range = weekDateRange();
      const all: PickerGame[] = [];

      // Fetch week fixtures for each league
      await Promise.allSettled(
        LEAGUE_SOURCES.map(async ({ id, name }) => {
          try {
            const res = await fetch(
              `https://www.goalserve.com/getfeed/${GS_KEY}/soccerfixtures/leagueid/${id}?json=1`,
            );
            const data = await res.json();
            const t = data?.results?.tournament;
            if (!t) return;
            // Handle both week-based (PL/Liga/Serie A) and stage-based (CL/EL)
            const weeks = t.week
              ? Array.isArray(t.week)
                ? t.week
                : [t.week]
              : t.stage
                ? toArray(t.stage).flatMap((s: any) => toArray(s?.week ?? s))
                : [];
            for (const w of weeks) {
              const matches = Array.isArray(w?.match)
                ? w.match
                : w?.match
                  ? [w.match]
                  : [];
              for (const m of matches) {
                if (!range.includes(m["@date"])) continue;
                const home = m.localteam?.["@name"] ?? "?";
                const away = m.visitorteam?.["@name"] ?? "?";
                if (home === "?" || away === "?") continue;
                all.push({
                  id: String(m["@static_id"]),
                  teams: [home, away],
                  kickoff: m["@time"] ?? "—",
                  date: m["@date"] ?? "",
                  league: name,
                  gsLeagueId: id,
                  status: m["@status"] ?? "Not Started",
                });
              }
            }
          } catch {
            /* silently skip failed leagues */
          }
        }),
      );

      // Also pull currently live matches from home feed
      try {
        const res = await fetch(HOME_FEED);
        const text = await res.text();
        if (text.trimStart().startsWith("{")) {
          const data = JSON.parse(text);
          const cats = toArray(data?.scores?.category);
          for (const cat of cats) {
            const ms = toArray(cat?.matches?.match ?? cat?.match);
            for (const m of ms) {
              const home = m?.localteam?.["@name"] ?? "";
              const away = m?.visitorteam?.["@name"] ?? "";
              if (!home || !away) continue;
              const staticId = String(
                m["@id"] ?? m["@static_id"] ?? `live-${home}-${away}`,
              );
              // Avoid duplicate if already in all[]
              if (all.some((g) => g.id === staticId)) continue;
              all.push({
                id: staticId,
                teams: [home, away],
                kickoff: m["@time"] ?? "—",
                date: "Today",
                league: cat["@name"] ?? cat.name ?? "Live",
                gsLeagueId: "",
                status: m["@status"] ?? "Live",
              });
            }
          }
        }
      } catch {
        /* ok */
      }

      // Sort by date then kickoff
      all.sort((a, b) => {
        const da = a.date === "Today" ? "00.00.0000" : a.date;
        const db = b.date === "Today" ? "00.00.0000" : b.date;
        if (da !== db) return da.localeCompare(db);
        return (a.kickoff ?? "").localeCompare(b.kickoff ?? "");
      });

      setPickerGames(all);
      setPickerLoading(false);
    }
    fetchGames();
  }, []);

  // ── Polling ───────────────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    const games = activeGamesRef.current;
    if (games.length === 0) {
      setPollCount((n) => n + 1);
      setLastUpdated(nowTime());
      return;
    }
    try {
      const res = await fetch(HOME_FEED);
      const text = await res.text();
      setFeedError(null);

      if (!text.trimStart().startsWith("{")) {
        // Feed not yet populated — keep showing kickoff times
        setPollCount((n) => n + 1);
        setLastUpdated(nowTime());
        return;
      }

      const data = JSON.parse(text);
      const leagues = toArray(data?.scores?.category);

      setGameStates((prev) => {
        const next = { ...prev };
        let anyGoal = false;

        for (const league of leagues) {
          const matches = toArray(league?.matches?.match ?? league?.match);
          for (const m of matches) {
            const home: string = m?.localteam?.["@name"] ?? "";
            const away: string = m?.visitorteam?.["@name"] ?? "";

            for (const game of games) {
              if (!matchesGame(home, away, game.teams)) continue;

              const existing = next[game.id] ?? defaultState(game);
              if (existing.finished) continue;

              const scoreHome = parseInt(m?.localteam?.["@goals"]) || 0;
              const scoreAway = parseInt(m?.visitorteam?.["@goals"]) || 0;
              const status: string = m["@status"] ?? "";

              const prevScore = prevScoresRef.current[game.id] ?? {
                home: -1,
                away: -1,
              };
              let flashing = false;
              const newLog = [...existing.goalLog];

              if (prevScore.home >= 0) {
                if (scoreHome > prevScore.home) {
                  flashing = true;
                  anyGoal = true;
                  newLog.push({
                    minute: status,
                    team: home,
                    scoreHome,
                    scoreAway,
                    ts: nowTime(),
                  });
                }
                if (scoreAway > prevScore.away) {
                  flashing = true;
                  anyGoal = true;
                  newLog.push({
                    minute: status,
                    team: away,
                    scoreHome,
                    scoreAway,
                    ts: nowTime(),
                  });
                }
              }

              prevScoresRef.current[game.id] = {
                home: scoreHome,
                away: scoreAway,
              };

              next[game.id] = {
                ...existing,
                homeName: home,
                awayName: away,
                scoreHome,
                scoreAway,
                status,
                goalLog: newLog,
                flashing,
                found: true,
                finished: status === "FT",
              };
            }
          }
        }

        if (anyGoal && audioCtxRef.current) {
          playGoalSound(audioCtxRef.current);
        }
        return next;
      });

      setTimeout(() => {
        setGameStates((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (next[k].flashing) next[k] = { ...next[k], flashing: false };
          }
          return next;
        });
      }, 2500);
    } catch (e: any) {
      setFeedError(e.message);
    }
    setPollCount((n) => n + 1);
    setLastUpdated(nowTime());
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // ── Add / remove games ────────────────────────────────────────────────────
  function addGame(pg: PickerGame) {
    if (activeGames.some((g) => g.id === pg.id)) return;
    setActiveGames((prev) => [
      ...prev,
      {
        id: pg.id,
        teams: pg.teams,
        kickoff: pg.kickoff,
        date: pg.date,
        league: pg.league,
        gsLeagueId: pg.gsLeagueId,
      },
    ]);
  }

  function removeGame(id: string) {
    setActiveGames((prev) => prev.filter((g) => g.id !== id));
    setGameStates((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
    delete prevScoresRef.current[id];
  }

  function copyCommand(game: ActiveFootballGame) {
    const cmd = `node scripts/poll-football-game.mjs "${game.teams[0]}" "${game.teams[1]}"`;
    navigator.clipboard.writeText(cmd).catch(() => {});
    setCopiedId(game.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Group picker games by date ────────────────────────────────────────────
  const groupedPicker: Record<string, PickerGame[]> = {};
  for (const pg of pickerGames) {
    const key = pg.date;
    if (!groupedPicker[key]) groupedPicker[key] = [];
    groupedPicker[key].push(pg);
  }
  const activeIds = new Set(activeGames.map((g) => g.id));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-gray-950 text-white font-inter select-none flex flex-col"
      onClick={unlockAudio}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-tight">
            goal<span className="text-green-400">.live</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 font-medium uppercase tracking-widest">
            ⚽ Football Manager
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {!audioReady ? (
            <span className="text-yellow-500/80">
              🔇 Click anywhere for sound
            </span>
          ) : (
            <>
              <span className="text-green-500/80">🔊 Sound on</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioCtxRef.current) playGoalSound(audioCtxRef.current);
                }}
                className="px-2 py-1 rounded bg-green-600/20 border border-green-500/30 text-green-400 hover:bg-green-600/40 transition-colors"
              >
                Test ♪
              </button>
            </>
          )}
          <span>
            Poll #{pollCount} · {lastUpdated || "—"}
          </span>
        </div>
      </header>

      {feedError && (
        <div className="mx-4 mt-3 px-4 py-2 rounded-lg bg-red-900/30 border border-red-700/40 text-red-400 text-xs">
          ⚠ {feedError}
        </div>
      )}

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: Picker ── */}
        <aside className="w-80 shrink-0 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 shrink-0">
            <h2 className="text-sm font-bold text-white">Add Game</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Click a match to add it to the dashboard
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
            {pickerLoading ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                Loading fixtures…
              </div>
            ) : pickerGames.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                No fixtures found this week.
              </div>
            ) : (
              Object.entries(groupedPicker).map(([date, games]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-1">
                    {dateLabel(date)}
                  </p>
                  <div className="space-y-1">
                    {games.map((pg) => {
                      const isAdded = activeIds.has(pg.id);
                      const col = LEAGUE_COLORS[pg.league] ?? DEFAULT_COLORS;
                      return (
                        <button
                          key={pg.id}
                          onClick={() => addGame(pg)}
                          disabled={isAdded}
                          className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                            isAdded
                              ? "border-gray-700 bg-gray-800/40 opacity-50 cursor-default"
                              : "border-gray-700/60 bg-gray-900 hover:bg-gray-800 hover:border-gray-600 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border ${col.badge}`}
                            >
                              {pg.league}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {pg.kickoff}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-gray-200 leading-snug">
                            {pg.teams[0]}{" "}
                            <span className="text-gray-500">vs</span>{" "}
                            {pg.teams[1]}
                          </p>
                          {isAdded && (
                            <p className="text-[10px] text-green-500 mt-0.5">
                              ✓ Added
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── Right: Dashboard ── */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <div className="text-6xl mb-4">⚽</div>
              <p className="text-lg font-semibold">No games added yet</p>
              <p className="text-sm mt-1">
                Pick a match from the sidebar to start tracking
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-5xl">
              {activeGames.map((game) => {
                const gs = gameStates[game.id] ?? defaultState(game);
                return (
                  <FootballMatchCard
                    key={game.id}
                    game={game}
                    state={gs}
                    onRemove={() => removeGame(game.id)}
                    onCopy={() => copyCommand(game)}
                    copied={copiedId === game.id}
                  />
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
interface FootballMatchCardProps {
  game: ActiveFootballGame;
  state: GameState;
  onRemove: () => void;
  onCopy: () => void;
  copied: boolean;
}

function FootballMatchCard({
  game,
  state,
  onRemove,
  onCopy,
  copied,
}: FootballMatchCardProps) {
  const col = LEAGUE_COLORS[game.league] ?? DEFAULT_COLORS;
  const { text: statusText, live } = statusLabel(state.status);
  const goalLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (goalLogRef.current) {
      goalLogRef.current.scrollTop = goalLogRef.current.scrollHeight;
    }
  }, [state.goalLog.length]);

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 bg-gray-900 ${
        state.flashing
          ? "border-yellow-400 shadow-[0_0_40px_8px_rgba(250,204,21,0.35)]"
          : "border-gray-700/60 shadow-lg"
      }`}
    >
      {/* GOAL flash */}
      {state.flashing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-5xl font-black text-yellow-300 drop-shadow-[0_0_30px_rgba(250,204,21,0.9)] tracking-widest animate-pulse">
            GOAL!
          </span>
        </div>
      )}

      {/* Gradient bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${col.bar}`} />

      <div className="p-4">
        {/* Top row: league + status + remove */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={`text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border ${col.badge}`}
          >
            {game.league}
          </span>
          <div className="flex items-center gap-2">
            {live && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
            )}
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                state.status === "FT"
                  ? "bg-gray-700 text-gray-300"
                  : state.status === "HT"
                    ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                    : live
                      ? "bg-green-500/20 text-green-300 border border-green-500/40"
                      : "bg-gray-800 text-gray-500"
              }`}
            >
              {state.found ? statusText : `KO ${game.kickoff}`}
            </span>
            <button
              onClick={onRemove}
              className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none"
              title="Remove game"
            >
              ×
            </button>
          </div>
        </div>

        {/* Score row */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <p className="flex-1 text-sm font-semibold text-gray-300 text-center truncate">
            {state.homeName}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-5xl font-black tabular-nums transition-all duration-500 ${state.flashing ? "text-yellow-300 scale-110" : "text-white"}`}
            >
              {state.scoreHome}
            </span>
            <span className="text-2xl text-gray-600 font-bold">–</span>
            <span
              className={`text-5xl font-black tabular-nums transition-all duration-500 ${state.flashing ? "text-yellow-300 scale-110" : "text-white"}`}
            >
              {state.scoreAway}
            </span>
          </div>
          <p className="flex-1 text-sm font-semibold text-gray-300 text-center truncate">
            {state.awayName}
          </p>
        </div>

        {/* Goal log */}
        {state.goalLog.length > 0 && (
          <div
            ref={goalLogRef}
            className="max-h-24 overflow-y-auto space-y-1 mb-3"
          >
            {state.goalLog.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-yellow-400">⚽</span>
                <span className="text-gray-400">{g.minute}'</span>
                <span className="text-white font-semibold truncate">
                  {g.team}
                </span>
                <span className="text-gray-600 ml-auto shrink-0">
                  {g.scoreHome}–{g.scoreAway}
                </span>
                <span className="text-gray-700 shrink-0">{g.ts}</span>
              </div>
            ))}
          </div>
        )}

        {/* Terminal command */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
          <code className="flex-1 text-[10px] text-gray-500 font-mono truncate">
            node scripts/poll-football-game.mjs "{game.teams[0]}" "
            {game.teams[1]}"
          </code>
          <button
            onClick={onCopy}
            className="shrink-0 text-[10px] px-2 py-1 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
