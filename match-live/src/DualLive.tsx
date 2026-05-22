import { useCallback, useEffect, useRef, useState } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const GS_KEY = "edc0ecd4f73c4c1a20f808dea8e5ebf2";
const HOME_FEED = `https://www.goalserve.com/getfeed/${GS_KEY}/soccernew/home?json=1`;
const POLL_MS = 5_000;

const GAMES_CONFIG = [
  {
    id: "game1",
    teams: ["Freiburg", "Aston Villa"],
    kickoff: "21:00",
    color: "from-red-500 to-purple-600",
    accentBg: "bg-red-500/10",
    accentBorder: "border-red-500/40",
    accentText: "text-red-400",
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────
interface GoalLogEntry {
  minute: string;
  team: string;
  scoreHome: number;
  scoreAway: number;
  homeName: string;
  awayName: string;
  ts: string;
}

interface GameState {
  homeName: string;
  awayName: string;
  scoreHome: number;
  scoreAway: number;
  status: string; // "FT" | "HT" | "67" | "19:00" etc.
  goalLog: GoalLogEntry[];
  flashing: boolean;
  found: boolean;
  finished: boolean;
}

// ─── Web Audio goal sound ─────────────────────────────────────────────────────
function playGoalSound(ctx: AudioContext) {
  // Rising fanfare: two short beeps then a held note
  const notes = [
    { freq: 523.25, start: 0, dur: 0.12 }, // C5
    { freq: 659.25, start: 0.13, dur: 0.12 }, // E5
    { freq: 783.99, start: 0.26, dur: 0.12 }, // G5
    { freq: 1046.5, start: 0.39, dur: 0.45 }, // C6 (held)
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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toArray<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function matchesGame(
  home: string,
  away: string,
  teams: readonly [string, string],
): boolean {
  const [a, b] = teams;
  return (
    (home.includes(a) || away.includes(a)) &&
    (home.includes(b) || away.includes(b))
  );
}

function statusLabel(status: string): { text: string; live: boolean } {
  if (status === "FT") return { text: "FULL TIME", live: false };
  if (status === "HT") return { text: "HALF TIME", live: true };
  if (/^\d+$/.test(status)) return { text: `${status}'`, live: true };
  return { text: status || "—", live: false };
}

function nowTime(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

const defaultGame = (_id: string): GameState => ({
  homeName: "Freiburg",
  awayName: "Aston Villa",
  scoreHome: 0,
  scoreAway: 0,
  status: "",
  goalLog: [],
  flashing: false,
  found: false,
  finished: false,
});

// ─── Component ────────────────────────────────────────────────────────────────
export default function DualLive() {
  const [games, setGames] = useState<GameState[]>(
    GAMES_CONFIG.map((c) => defaultGame(c.id)),
  );
  const [pollCount, setPollCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [audioReady, setAudioReady] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevScoresRef = useRef<{ home: number; away: number }[]>(
    GAMES_CONFIG.map(() => ({ home: -1, away: -1 })),
  );

  // Unlock audio on first click
  const unlockAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    audioCtxRef.current = new AudioContext();
    setAudioReady(true);
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(HOME_FEED);
      const text = await res.text();
      setFeedError(null);

      if (!text.trimStart().startsWith("{")) {
        // Feed not yet populated (pre-match or API quirk)
        setPollCount((n) => n + 1);
        setLastUpdated(nowTime());
        setGames((prev) =>
          prev.map((g, i) => ({
            ...g,
            found: false,
            status: GAMES_CONFIG[i].kickoff,
          })),
        );
        return;
      }

      const data = JSON.parse(text);
      const leagues = toArray(data?.scores?.category);

      setGames((prev) => {
        const next = prev.map((g, gi) => ({ ...g }));

        for (const league of leagues) {
          const matches = toArray(league?.matches?.match ?? league?.match);
          for (const m of matches) {
            const home: string = m?.localteam?.["@name"] ?? "";
            const away: string = m?.visitorteam?.["@name"] ?? "";

            for (let gi = 0; gi < GAMES_CONFIG.length; gi++) {
              if (!matchesGame(home, away, GAMES_CONFIG[gi].teams)) continue;
              if (next[gi].finished) continue;

              const rawH = m?.localteam?.["@goals"];
              const rawA = m?.visitorteam?.["@goals"];
              const scoreHome = parseInt(rawH) >= 0 ? parseInt(rawH) : 0;
              const scoreAway = parseInt(rawA) >= 0 ? parseInt(rawA) : 0;
              const status: string = m["@status"] ?? "";

              // Goal detection
              const prev = prevScoresRef.current[gi];
              let flashing = false;
              const newLog: GoalLogEntry[] = [...next[gi].goalLog];

              if (prev.home >= 0) {
                if (scoreHome > prev.home) {
                  flashing = true;
                  newLog.push({
                    minute: status,
                    team: home,
                    scoreHome,
                    scoreAway,
                    homeName: home,
                    awayName: away,
                    ts: nowTime(),
                  });
                  if (audioCtxRef.current) playGoalSound(audioCtxRef.current);
                }
                if (scoreAway > prev.away) {
                  flashing = true;
                  newLog.push({
                    minute: status,
                    team: away,
                    scoreHome,
                    scoreAway,
                    homeName: home,
                    awayName: away,
                    ts: nowTime(),
                  });
                  if (audioCtxRef.current) playGoalSound(audioCtxRef.current);
                }
              }

              prevScoresRef.current[gi] = { home: scoreHome, away: scoreAway };

              next[gi] = {
                ...next[gi],
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

        return next;
      });

      // Clear flash after 2.5s
      setTimeout(() => {
        setGames((prev) =>
          prev.map((g) => (g.flashing ? { ...g, flashing: false } : g)),
        );
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

  return (
    <div
      className="min-h-screen bg-gray-950 text-white font-inter select-none"
      onClick={unlockAudio}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-tight text-white">
            goal<span className="text-green-400">.live</span>
          </span>
          <span className="text-xs text-gray-500 hidden sm:block">
            UEFA Europa League Final
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-medium uppercase tracking-widest">
            ● Live
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {!audioReady && (
            <span className="text-yellow-500/80 flex items-center gap-1">
              🔇 Click anywhere to enable sound
            </span>
          )}
          {audioReady && (
            <>
              <span className="text-green-500/80">🔊 Sound on</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (audioCtxRef.current) playGoalSound(audioCtxRef.current);
                }}
                className="px-2 py-1 rounded bg-green-600/30 border border-green-500/40 text-green-400 hover:bg-green-600/50 transition-colors"
              >
                Test sound
              </button>
            </>
          )}
          <span>
            Poll #{pollCount} · {lastUpdated || "—"}
          </span>
        </div>
      </header>

      {feedError && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-400 text-sm">
          ⚠ Feed error: {feedError}
        </div>
      )}

      {/* Match cards */}
      <main className="grid grid-cols-1 gap-6 p-6 max-w-2xl mx-auto">
        {GAMES_CONFIG.map((cfg, gi) => (
          <MatchCard
            key={cfg.id}
            config={cfg}
            game={games[gi]}
            index={gi + 1}
          />
        ))}
      </main>

      <footer className="text-center text-xs text-gray-700 pb-6">
        Polling every {POLL_MS / 1000}s · Powered by Goalserve
      </footer>
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────
interface MatchCardProps {
  config: (typeof GAMES_CONFIG)[number];
  game: GameState;
  index: number;
}

function MatchCard({ config, game, index }: MatchCardProps) {
  const { text: statusText, live } = statusLabel(game.status);
  const goalLogRef = useRef<HTMLDivElement>(null);

  // Auto-scroll goal log to bottom on new entry
  useEffect(() => {
    if (goalLogRef.current) {
      goalLogRef.current.scrollTop = goalLogRef.current.scrollHeight;
    }
  }, [game.goalLog.length]);

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
        game.flashing
          ? "border-yellow-400 shadow-[0_0_40px_8px_rgba(250,204,21,0.35)]"
          : `${config.accentBorder} shadow-lg`
      } ${config.accentBg} bg-gray-900`}
    >
      {/* GOAL flash overlay */}
      {game.flashing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none animate-goal-flash">
          <span className="text-5xl font-black text-yellow-300 drop-shadow-[0_0_30px_rgba(250,204,21,0.9)] tracking-widest">
            GOAL!
          </span>
        </div>
      )}

      {/* Top gradient bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${config.color}`} />

      <div className="p-5">
        {/* Game label + status */}
        <div className="flex items-center justify-between mb-4">
          <span
            className={`text-xs font-semibold uppercase tracking-widest ${config.accentText}`}
          >
            Game {index}
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
                game.status === "FT"
                  ? "bg-gray-700 text-gray-300"
                  : game.status === "HT"
                    ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                    : live
                      ? "bg-green-500/20 text-green-300 border border-green-500/40"
                      : "bg-gray-700/50 text-gray-400"
              }`}
            >
              {game.found ? statusText : `KO ${config.kickoff}`}
            </span>
          </div>
        </div>

        {/* Score row */}
        <div className="flex items-center justify-between gap-3 mb-5">
          {/* Home team */}
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-gray-300 leading-tight truncate">
              {game.homeName}
            </p>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3">
            <span
              className={`text-6xl font-black tabular-nums transition-all duration-500 ${
                game.flashing ? "text-yellow-300 scale-110" : "text-white"
              }`}
            >
              {game.found ? game.scoreHome : "—"}
            </span>
            <span className="text-2xl font-light text-gray-600">–</span>
            <span
              className={`text-6xl font-black tabular-nums transition-all duration-500 ${
                game.flashing ? "text-yellow-300 scale-110" : "text-white"
              }`}
            >
              {game.found ? game.scoreAway : "—"}
            </span>
          </div>

          {/* Away team */}
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-gray-300 leading-tight truncate">
              {game.awayName}
            </p>
          </div>
        </div>

        {/* Pre-match message */}
        {!game.found && (
          <p className="text-center text-xs text-gray-600 mb-4">
            Waiting for match data · feed populates at kick-off
          </p>
        )}

        {/* Goal log */}
        {game.goalLog.length > 0 && (
          <div
            ref={goalLogRef}
            className="mt-3 max-h-36 overflow-y-auto rounded-xl bg-gray-800/50 border border-gray-700/50 divide-y divide-gray-700/40"
          >
            {game.goalLog.map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <span className="text-yellow-400 font-bold w-10 shrink-0 text-right">
                  {/^\d+$/.test(entry.minute)
                    ? `${entry.minute}'`
                    : entry.minute}
                </span>
                <span className="text-white font-semibold">{entry.team}</span>
                <span className="ml-auto text-gray-400 font-mono tabular-nums text-xs">
                  {entry.scoreHome}–{entry.scoreAway}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* No goals yet */}
        {game.found && game.goalLog.length === 0 && (
          <div className="text-center text-xs text-gray-600 mt-2">
            No goals yet
          </div>
        )}
      </div>
    </div>
  );
}
