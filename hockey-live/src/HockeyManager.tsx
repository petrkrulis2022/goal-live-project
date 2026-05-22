import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 5_000;
const LS_KEY = "hockey-active-games";
const PICKER_LS_KEY = "hockey-picker-games";
const WORLD_CHAMPIONSHIP_NAME = "World Championship";
const GOALSERVE_FEEDS = ["home", "d1", "d2", "d3", "d4", "d5"] as const;

export interface ActiveHockeyGame {
  id: number;
  teams: [string, string];
  date: string;
  time: string;
  status: string;
  league: string;
}

interface PickerGame {
  id: number;
  teams: [string, string];
  date: string;
  time: string;
  status: string;
  league: string;
}

interface HockeyEvent {
  key: string;
  period: string | number;
  minute: string | number;
  team: string;
  players: string[];
  assists: string[];
  type: string;
  comment: string;
  ts: string;
}

interface PeriodScore {
  home: number;
  away: number;
}

interface GameState {
  scoreHome: number;
  scoreAway: number;
  periods: PeriodScore[];
  status: string;
  events: HockeyEvent[];
  flashing: boolean;
  found: boolean;
  finished: boolean;
}

interface GoalserveEvent {
  min?: string;
  player?: string;
  playerid?: string;
  assist?: string;
  assistid?: string;
  comment?: string;
  result?: string;
  team?: string;
  type?: string;
}

interface GoalservePeriodPayload {
  event?: GoalserveEvent | GoalserveEvent[];
  score?: string;
}

interface GoalserveMatch {
  id?: string | number;
  fix_id?: string | number;
  date?: string;
  time?: string;
  status?: string;
  timer?: string;
  localteam?: { id?: string; name?: string; totalscore?: string };
  awayteam?: { id?: string; name?: string; totalscore?: string };
  events?: Record<string, GoalservePeriodPayload>;
}

interface GoalserveCategory {
  name?: string;
  file_group?: string;
  match?: GoalserveMatch | GoalserveMatch[];
}

interface GoalserveFeed {
  scores?: {
    category?: GoalserveCategory[];
  };
}

interface GoalserveEventEntry {
  periodKey: string;
  event: GoalserveEvent;
}

function nowTime() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function periodLabel(periodKey: string | number): string {
  const key = String(periodKey).toLowerCase();
  if (key.includes("first")) return "P1";
  if (key.includes("second")) return "P2";
  if (key.includes("third")) return "P3";
  if (key.includes("overtime")) return "OT";
  if (key.includes("penalt")) return "SO";

  const n = Number(periodKey);
  if (n === 1) return "P1";
  if (n === 2) return "P2";
  if (n === 3) return "P3";
  if (n === 4) return "OT";
  if (n === 5) return "SO";
  return String(periodKey);
}

function statusBadgeClass(status: string): string {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("finished") ||
    normalized === "ft" ||
    normalized.includes("after ot") ||
    normalized.includes("after so")
  ) {
    return "bg-gray-700 text-gray-300";
  }
  if (normalized.includes("not started") || normalized === "ns") {
    return "bg-gray-800 text-gray-500 border border-gray-700";
  }
  return "bg-blue-500/20 text-blue-300 border border-blue-500/40";
}

function isLive(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized !== "" &&
    !normalized.includes("not started") &&
    !normalized.includes("finished") &&
    normalized !== "ft" &&
    !normalized.includes("after ot") &&
    !normalized.includes("after so")
  );
}

function isFinished(status: string): boolean {
  const normalized = status.toLowerCase();
  return (
    normalized.includes("finished") ||
    normalized === "ft" ||
    normalized.includes("after ot") ||
    normalized.includes("after so")
  );
}

function defaultState(): GameState {
  return {
    scoreHome: 0,
    scoreAway: 0,
    periods: [],
    status: "",
    events: [],
    flashing: false,
    found: false,
    finished: false,
  };
}

function parseIsoDate(date: string | undefined): string {
  if (!date) return new Date().toISOString().split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const parts = date.split(".");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? new Date().toISOString().split("T")[0]
    : parsed.toISOString().split("T")[0];
}

function dateLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isoDate === today.toISOString().split("T")[0]) return "Today";
  if (isoDate === tomorrow.toISOString().split("T")[0]) return "Tomorrow";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function extractGameId(match: GoalserveMatch): number {
  return Number(match.id ?? match.fix_id ?? 0);
}

function extractScore(match: GoalserveMatch): { home: number; away: number } {
  return {
    home: Number(match.localteam?.totalscore ?? 0) || 0,
    away: Number(match.awayteam?.totalscore ?? 0) || 0,
  };
}

function parseScorePair(score?: string): PeriodScore {
  if (!score) return { home: 0, away: 0 };
  const match = score.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (!match) return { home: 0, away: 0 };
  return { home: Number(match[1]) || 0, away: Number(match[2]) || 0 };
}

function extractPeriods(match: GoalserveMatch): PeriodScore[] {
  const periods: PeriodScore[] = [];
  const order = [
    "firstperiod",
    "secondperiod",
    "thirdperiod",
    "overtime",
    "penalties",
  ];
  const events = match.events ?? {};
  for (const key of order) {
    const payload = events[key];
    if (payload?.score) {
      periods.push(parseScorePair(payload.score));
    }
  }
  return periods;
}

function extractGoalserveEventEntries(
  match: GoalserveMatch,
): GoalserveEventEntry[] {
  const entries: GoalserveEventEntry[] = [];
  const events = match.events ?? {};
  for (const [periodKey, payload] of Object.entries(events)) {
    const raw = payload?.event;
    if (Array.isArray(raw)) {
      for (const event of raw) entries.push({ periodKey, event });
    } else if (raw) {
      entries.push({ periodKey, event: raw });
    }
  }
  return entries;
}

function eventKey(periodKey: string, event: GoalserveEvent): string {
  return [
    periodLabel(periodKey),
    event.min ?? "",
    event.player ?? "",
    event.type ?? "",
    event.comment ?? "",
    event.result ?? "",
  ].join("|");
}

function teamsFromEvent(
  event: GoalserveEvent,
  home: string,
  away: string,
): string {
  if (event.team === "localteam") return home;
  if (event.team === "visitorteam") return away;
  return event.team ?? "?";
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isSameMatchByTeams(
  game: ActiveHockeyGame,
  match: GoalserveMatch,
): boolean {
  const gameHome = normalizeTeamName(game.teams[0]);
  const gameAway = normalizeTeamName(game.teams[1]);
  const feedHome = normalizeTeamName(match.localteam?.name ?? "");
  const feedAway = normalizeTeamName(match.awayteam?.name ?? "");
  return gameHome === feedHome && gameAway === feedAway;
}

function isWorldChampionshipCategory(categoryName?: string): boolean {
  return (categoryName ?? "")
    .toLowerCase()
    .includes(WORLD_CHAMPIONSHIP_NAME.toLowerCase());
}

function readStoredPickerGames(): PickerGame[] {
  try {
    return JSON.parse(localStorage.getItem(PICKER_LS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function playHockeyBuzzer(ctx: AudioContext) {
  const notes = [
    { freq: 392.0, start: 0, dur: 0.1 },
    { freq: 523.25, start: 0.11, dur: 0.1 },
    { freq: 659.25, start: 0.22, dur: 0.1 },
    { freq: 880.0, start: 0.33, dur: 0.5 },
  ];
  notes.forEach(({ freq, start, dur }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const t = ctx.currentTime + start;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

export default function HockeyManager() {
  const [activeGames, setActiveGames] = useState<ActiveHockeyGame[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
      return [];
    }
  });
  const [pickerGames, setPickerGames] = useState<PickerGame[]>(
    readStoredPickerGames,
  );
  const [pickerLoading, setPickerLoading] = useState(true);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [gameStates, setGameStates] = useState<Record<number, GameState>>({});
  const [pollCount, setPollCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("");
  const [audioReady, setAudioReady] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeGamesRef = useRef<ActiveHockeyGame[]>(activeGames);
  const gameStatesRef = useRef<Record<number, GameState>>(gameStates);
  const seenEventsRef = useRef<Record<number, Set<string>>>({});

  useEffect(() => {
    activeGamesRef.current = activeGames;
  }, [activeGames]);

  useEffect(() => {
    gameStatesRef.current = gameStates;
  }, [gameStates]);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(activeGames));
  }, [activeGames]);

  useEffect(() => {
    localStorage.setItem(PICKER_LS_KEY, JSON.stringify(pickerGames));
  }, [pickerGames]);

  const unlockAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    audioCtxRef.current = new AudioContext();
    setAudioReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchGames() {
      setPickerLoading(true);
      setPickerError(null);

      const nextGames = new Map<number, PickerGame>();

      for (const feed of GOALSERVE_FEEDS) {
        try {
          const res = await fetch(`/api/hockey/${feed}?json=1`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: GoalserveFeed = await res.json();
          const categories = data.scores?.category ?? [];

          for (const category of categories) {
            if (!isWorldChampionshipCategory(category.name)) continue;
            const matches = Array.isArray(category.match)
              ? category.match
              : category.match
                ? [category.match]
                : [];

            for (const match of matches) {
              const id = extractGameId(match);
              if (!id) continue;
              nextGames.set(id, {
                id,
                teams: [
                  match.localteam?.name ?? "?",
                  match.awayteam?.name ?? "?",
                ],
                date: parseIsoDate(match.date),
                time: match.time ?? "—",
                status: match.status ?? (match.timer ? "Live" : "Not Started"),
                league: category.name ?? WORLD_CHAMPIONSHIP_NAME,
              });
            }
          }
        } catch {
          /* keep cache and continue */
        }
      }

      if (cancelled) return;

      const all = Array.from(nextGames.values()).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

      if (all.length > 0) {
        setPickerGames(all);
      } else if (pickerGames.length === 0) {
        setPickerError(
          "Cannot reach Goalserve hockey feed. Make sure the hockey proxy is running on port 5176.",
        );
      }

      setPickerLoading(false);
    }

    fetchGames();

    return () => {
      cancelled = true;
    };
  }, []);

  const pollHomeFeed = useCallback(async () => {
    const games = activeGamesRef.current;
    if (games.length === 0) {
      setPollCount((n) => n + 1);
      setLastUpdated(nowTime());
      return;
    }

    try {
      const res = await fetch(`/api/hockey/home?json=1`);
      if (!res.ok) return;

      const data: GoalserveFeed = await res.json();
      const categories = data.scores?.category ?? [];
      const matchById = new Map<
        number,
        { category: GoalserveCategory; match: GoalserveMatch }
      >();
      const allFeedMatches: Array<{
        category: GoalserveCategory;
        match: GoalserveMatch;
      }> = [];

      for (const category of categories) {
        const matches = Array.isArray(category.match)
          ? category.match
          : category.match
            ? [category.match]
            : [];
        for (const match of matches) {
          const item = { category, match };
          allFeedMatches.push(item);
          const id = extractGameId(match);
          if (id) matchById.set(id, item);
        }
      }

      let anyGoal = false;

      for (const game of games) {
        let current = matchById.get(game.id);
        if (!current) {
          current = allFeedMatches.find(({ match }) =>
            isSameMatchByTeams(game, match),
          );
        }
        if (!current) continue;

        const match = current.match;
        const status = match.status ?? (match.timer ? "Live" : "Not Started");
        const score = extractScore(match);
        const periods = extractPeriods(match);
        const previous = gameStatesRef.current[game.id] ?? defaultState();
        const scoreChanged =
          score.home !== previous.scoreHome ||
          score.away !== previous.scoreAway;

        const nextState: GameState = {
          ...previous,
          scoreHome: score.home,
          scoreAway: score.away,
          periods,
          status,
          found: true,
          finished: isFinished(status),
        };

        if (isLive(status) && scoreChanged) {
          const seen = seenEventsRef.current[game.id] ?? new Set<string>();
          seenEventsRef.current[game.id] = seen;

          const newGoals: HockeyEvent[] = [];
          for (const { periodKey, event } of extractGoalserveEventEntries(
            match,
          )) {
            const type = (event.type ?? "").toLowerCase();
            if (type !== "goal") continue;

            const key = eventKey(periodKey, event);
            if (seen.has(key)) continue;
            seen.add(key);

            const players = [event.player ?? ""].filter(Boolean);
            const assists = (event.assist ?? "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean);

            newGoals.push({
              key,
              period: periodLabel(periodKey),
              minute: event.min ?? "?",
              team: teamsFromEvent(event, game.teams[0], game.teams[1]),
              players,
              assists,
              type: "goal",
              comment: event.comment ?? event.result ?? "",
              ts: nowTime(),
            });
          }

          if (newGoals.length > 0) {
            anyGoal = true;
            nextState.events = [...previous.events, ...newGoals];
            nextState.flashing = true;

            setTimeout(() => {
              setGameStates((prev) => ({
                ...prev,
                [game.id]: prev[game.id]
                  ? { ...prev[game.id], flashing: false }
                  : prev[game.id],
              }));
            }, 2500);
          }
        }

        setGameStates((prev) => ({
          ...prev,
          [game.id]: nextState,
        }));
      }

      if (anyGoal && audioCtxRef.current) {
        playHockeyBuzzer(audioCtxRef.current);
      }
    } catch {
      /* keep current dashboard state */
    } finally {
      setPollCount((n) => n + 1);
      setLastUpdated(nowTime());
    }
  }, []);

  useEffect(() => {
    pollHomeFeed();
    const intervalId = setInterval(pollHomeFeed, POLL_MS);
    return () => clearInterval(intervalId);
  }, [pollHomeFeed]);

  function addGame(pg: PickerGame) {
    if (activeGames.some((g) => g.id === pg.id)) return;
    setActiveGames((prev) => [
      ...prev,
      {
        id: pg.id,
        teams: pg.teams,
        date: pg.date,
        time: pg.time,
        status: pg.status,
        league: pg.league,
      },
    ]);
  }

  function removeGame(id: number) {
    setActiveGames((prev) => prev.filter((g) => g.id !== id));
    setGameStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    delete seenEventsRef.current[id];
  }

  function copyCommand(game: ActiveHockeyGame) {
    const cmd = `node scripts/poll-hockey-wc.mjs ${game.id} "${game.teams[0]}" "${game.teams[1]}"`;
    navigator.clipboard.writeText(cmd).catch(() => {});
    setCopiedId(game.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const groupedPicker: Record<string, PickerGame[]> = {};
  for (const pg of pickerGames) {
    if (!groupedPicker[pg.date]) groupedPicker[pg.date] = [];
    groupedPicker[pg.date].push(pg);
  }

  const activeIds = new Set(activeGames.map((g) => g.id));

  return (
    <div
      className="min-h-screen bg-[#0a0e1a] text-white font-inter select-none flex flex-col"
      onClick={unlockAudio}
    >
      <header className="flex items-center justify-between px-6 py-4 border-b border-blue-900/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-tight">
            goal<span className="text-blue-400">.live</span>
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 font-medium uppercase tracking-widest">
            🏒 Ice Hockey WC
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {!audioReady ? (
            <span className="text-yellow-500/80">
              🔇 Click anywhere for sound
            </span>
          ) : (
            <>
              <span className="text-blue-400/80">🔊 Sound on</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioCtxRef.current)
                    playHockeyBuzzer(audioCtxRef.current);
                }}
                className="px-2 py-1 rounded bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/40 transition-colors"
              >
                Test 🎺
              </button>
            </>
          )}
          <span>
            Poll #{pollCount} · {lastUpdated || "—"}
          </span>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-80 shrink-0 border-r border-blue-900/40 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-blue-900/40 shrink-0">
            <h2 className="text-sm font-bold text-white">Add Game</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              IIHF World Championship matches only
            </p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
            {pickerLoading ? (
              <div className="text-center py-8 text-gray-600 text-sm">
                Loading fixtures…
              </div>
            ) : (
              <div className="space-y-4">
                {pickerError && (
                  <div className="px-3 py-3 text-amber-300 text-xs bg-amber-900/20 rounded-lg border border-amber-700/40">
                    ⚠ {pickerError}
                  </div>
                )}
                {pickerGames.length === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    No World Championship games found for this week.
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
                          const live = isLive(pg.status);
                          return (
                            <button
                              key={pg.id}
                              onClick={() => addGame(pg)}
                              disabled={isAdded}
                              className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                                isAdded
                                  ? "border-gray-700 bg-gray-800/40 opacity-50 cursor-default"
                                  : "border-blue-900/40 bg-[#0d1120] hover:bg-[#111827] hover:border-blue-700/50 cursor-pointer"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  {live && (
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500" />
                                    </span>
                                  )}
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusBadgeClass(pg.status)}`}
                                  >
                                    {pg.status}
                                  </span>
                                </div>
                                <span className="text-[10px] text-gray-500">
                                  {pg.time} UTC
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-gray-200 leading-snug">
                                {pg.teams[0]}{" "}
                                <span className="text-gray-500">vs</span>{" "}
                                {pg.teams[1]}
                              </p>
                              <p className="text-[10px] text-gray-600 mt-0.5">
                                #{pg.id}
                              </p>
                              {isAdded && (
                                <p className="text-[10px] text-blue-400 mt-0.5">
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
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-6">
          {activeGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <div className="text-6xl mb-4">🏒</div>
              <p className="text-lg font-semibold">No games added yet</p>
              <p className="text-sm mt-1">
                Pick a World Championship match from the sidebar
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-5xl">
              {activeGames.map((game) => {
                const gs = gameStates[game.id] ?? defaultState();
                return (
                  <HockeyMatchCard
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

interface HockeyMatchCardProps {
  game: ActiveHockeyGame;
  state: GameState;
  onRemove: () => void;
  onCopy: () => void;
  copied: boolean;
}

function HockeyMatchCard({
  game,
  state,
  onRemove,
  onCopy,
  copied,
}: HockeyMatchCardProps) {
  const live = isLive(state.status);
  const eventLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [state.events.length]);

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 bg-[#0d1120] ${
        state.flashing
          ? "border-blue-400 shadow-[0_0_40px_8px_rgba(96,165,250,0.35)]"
          : "border-blue-900/40 shadow-lg"
      }`}
    >
      {state.flashing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="text-5xl font-black text-blue-300 drop-shadow-[0_0_30px_rgba(96,165,250,0.9)] tracking-widest animate-pulse">
            GOAL!
          </span>
        </div>
      )}

      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-500" />

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded border bg-blue-500/15 border-blue-500/30 text-blue-300">
            🏒 IIHF WC
          </span>
          <div className="flex items-center gap-2">
            {live && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            )}
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadgeClass(state.status)}`}
            >
              {state.found ? state.status || "—" : `KO ${game.time} UTC`}
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

        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="flex-1 text-sm font-semibold text-gray-300 text-center truncate">
            {game.teams[0]}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-5xl font-black tabular-nums transition-all duration-500 ${state.flashing ? "text-blue-300 scale-110" : "text-white"}`}
            >
              {state.scoreHome}
            </span>
            <span className="text-2xl text-gray-600 font-bold">–</span>
            <span
              className={`text-5xl font-black tabular-nums transition-all duration-500 ${state.flashing ? "text-blue-300 scale-110" : "text-white"}`}
            >
              {state.scoreAway}
            </span>
          </div>
          <p className="flex-1 text-sm font-semibold text-gray-300 text-center truncate">
            {game.teams[1]}
          </p>
        </div>

        {state.periods.length > 0 && (
          <div className="flex items-center justify-center gap-3 mb-3">
            {state.periods.map((p, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-[10px] text-gray-600 mb-0.5">
                  {periodLabel(i + 1)}
                </span>
                <span className="text-xs font-bold text-gray-400">
                  {p.home}–{p.away}
                </span>
              </div>
            ))}
          </div>
        )}

        {state.events.length > 0 && (
          <div
            ref={eventLogRef}
            className="max-h-32 overflow-y-auto space-y-1.5 mb-3"
          >
            {state.events.map((ev, i) => {
              const isPowerPlay =
                ev.comment.toLowerCase().includes("power") ||
                ev.comment.toLowerCase().includes("pp");
              const isShortHanded =
                ev.comment.toLowerCase().includes("shorthanded") ||
                ev.comment.toLowerCase().includes("sh");
              return (
                <div key={i} className="text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">🏒</span>
                    <span className="text-gray-500">
                      {ev.period} {ev.minute}'
                    </span>
                    <span className="text-white font-semibold truncate">
                      {ev.team}
                    </span>
                    {isPowerPlay && (
                      <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 font-bold">
                        PP
                      </span>
                    )}
                    {isShortHanded && (
                      <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-400 font-bold">
                        SH
                      </span>
                    )}
                    <span className="text-gray-700 ml-auto shrink-0">
                      {ev.ts}
                    </span>
                  </div>
                  {ev.players.length > 0 && (
                    <div className="flex items-center gap-1 pl-5 mt-0.5">
                      <span className="text-gray-400 truncate">
                        {ev.players[0]}
                      </span>
                      {ev.assists.length > 0 && (
                        <span className="text-gray-600 truncate">
                          · {ev.assists.slice(0, 2).join(", ")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-blue-900/30">
          <code className="flex-1 text-[10px] text-gray-500 font-mono truncate">
            node scripts/poll-hockey-wc.mjs {game.id} "{game.teams[0]}" "
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
