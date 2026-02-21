// ─────────────────────────────────────────────
//  Mock Data Service  —  10× synthetic simulation
//  Best-effort video sync (tvgo / YouTube)
// ─────────────────────────────────────────────
import type { IDataService, MatchCallbacks } from "../../types/services.types";
import type { Match, Player, MatchWinnerOdds } from "../../types";
import {
  MOCK_MATCH,
  MOCK_MATCH_ID,
  MOCK_PLAYERS,
  MOCK_MATCH_WINNER_ODDS,
  MOCK_GOAL_SCRIPT,
} from "../../data/mockMatchData";

const SPEED_MULTIPLIER = 10; // 10× real-time
const TICK_INTERVAL_MS = (60 / SPEED_MULTIPLIER) * 1000; // 6 000 ms per simulated minute

// ── Odds fluctuation helpers ──────────────────
function jitter(base: number, maxPct = 0.04): number {
  const factor = 1 + (Math.random() - 0.5) * maxPct * 2;
  return Math.round(base * factor * 100) / 100;
}

function fluctuatePlayers(players: Player[]): Player[] {
  return players.map((p) => ({ ...p, odds: jitter(p.odds) }));
}

function fluctuateMW(mw: MatchWinnerOdds): MatchWinnerOdds {
  return {
    home: jitter(mw.home),
    away: jitter(mw.away),
    draw: jitter(mw.draw),
  };
}

// ── Best-effort video time detection ─────────
function tryGetVideoMinute(): number | null {
  try {
    const video = document.querySelector("video") as HTMLVideoElement | null;
    if (!video || video.paused || !isFinite(video.currentTime)) return null;
    // Assume each second of video ≈ 1 second of match; video shows a full 90-min match
    // Estimate: match minute = video.currentTime / 60
    const estimatedMinute = Math.floor(video.currentTime / 60);
    if (estimatedMinute >= 0 && estimatedMinute <= 95) return estimatedMinute;
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────

class MockDataService implements IDataService {
  private match: Match = { ...MOCK_MATCH };
  private players: Player[] = MOCK_PLAYERS.map((p) => ({ ...p }));
  private mwOdds: MatchWinnerOdds = { ...MOCK_MATCH_WINNER_ODDS };
  private goalWindow = 0;
  private nextGoalIdx = 0;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private subscribers: Map<string, MatchCallbacks> = new Map();
  private useVideoSync = false;

  // ── Public interface ─────────────────────────

  async getMatch(matchId: string): Promise<Match> {
    if (matchId !== MOCK_MATCH_ID) throw new Error(`Unknown match ${matchId}`);
    return { ...this.match };
  }

  async getPlayers(matchId: string): Promise<Player[]> {
    if (matchId !== MOCK_MATCH_ID) throw new Error(`Unknown match ${matchId}`);
    return this.players.map((p) => ({ ...p }));
  }

  async getMatchWinnerOdds(_matchId: string): Promise<MatchWinnerOdds> {
    return { ...this.mwOdds };
  }

  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void {
    this.subscribers.set(matchId, callbacks);
    return () => {
      this.subscribers.delete(matchId);
    };
  }

  startSimulation(matchId: string): void {
    if (matchId !== MOCK_MATCH_ID) return;
    if (this.tickHandle) return; // already running

    // Try video sync on first tick; fall back gracefully
    const videoMinute = tryGetVideoMinute();
    if (videoMinute !== null) {
      this.useVideoSync = true;
      this.match.currentMinute = videoMinute;
      console.info(
        `[goal.live] Video sync active — starting at ${videoMinute}'`,
      );
    }

    this.match.status = "live";
    this.broadcast("onStatusChange", "live");

    this.tickHandle = setInterval(() => this.tick(), TICK_INTERVAL_MS);
    console.info("[goal.live] Match simulation started (10×)");
  }

  resetSimulation(matchId: string): void {
    if (matchId !== MOCK_MATCH_ID) return;
    this.stopTick();
    this.match = { ...MOCK_MATCH };
    this.players = MOCK_PLAYERS.map((p) => ({ ...p }));
    this.mwOdds = { ...MOCK_MATCH_WINNER_ODDS };
    this.goalWindow = 0;
    this.nextGoalIdx = 0;
    this.useVideoSync = false;
    this.broadcast("onStatusChange", "pre-match");
    console.info("[goal.live] Simulation reset");
  }

  triggerGoal(matchId: string, playerId: string): void {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    this.fireGoal(player, this.match.currentMinute);
  }

  // ── Internal tick ─────────────────────────────

  private tick() {
    // Sync with video if available
    if (this.useVideoSync) {
      const videoMinute = tryGetVideoMinute();
      if (videoMinute !== null) {
        this.match.currentMinute = videoMinute;
      } else {
        // Video sync lost; switch to internal timer
        this.useVideoSync = false;
        this.match.currentMinute++;
      }
    } else {
      this.match.currentMinute++;
    }

    const minute = this.match.currentMinute;

    // Half-time switch
    if (minute === 45 && this.match.half === 1) {
      this.match.half = 2;
      this.match.status = "halftime";
      this.broadcast("onStatusChange", "halftime");
      return;
    }
    if (minute === 46 && this.match.status === "halftime") {
      this.match.status = "live";
      this.broadcast("onStatusChange", "live");
    }

    // Match end
    if (minute >= 90) {
      this.match.status = "finished";
      this.stopTick();
      this.broadcast("onScoreUpdate", { ...this.match.score });
      this.broadcast("onMatchEnd", { ...this.match.score });
      return;
    }

    // Broadcast minute tick
    this.broadcast("onMinuteTick", minute);

    // Check scripted goals
    while (
      this.nextGoalIdx < MOCK_GOAL_SCRIPT.length &&
      MOCK_GOAL_SCRIPT[this.nextGoalIdx].minute <= minute
    ) {
      const g = MOCK_GOAL_SCRIPT[this.nextGoalIdx];
      const player = this.players.find((p) => p.id === g.playerId);
      if (player) this.fireGoal(player, g.minute);
      this.nextGoalIdx++;
    }

    // Odds fluctuation every 3 minutes
    if (minute % 3 === 0) {
      this.players = fluctuatePlayers(this.players);
      this.mwOdds = fluctuateMW(this.mwOdds);
      this.broadcast(
        "onOddsUpdate",
        this.players.map((p) => ({ ...p })),
        { ...this.mwOdds },
      );
    }
  }

  private fireGoal(player: Player, minute: number) {
    const team = player.team;
    if (team === "home") this.match.score.home++;
    else this.match.score.away++;

    this.broadcast("onScoreUpdate", { ...this.match.score });
    this.broadcast("onGoal", player.id, player.name, minute, team);

    // Shift to next goal window AFTER broadcasting (so betting service processes first)
    this.goalWindow++;

    // After scoring, odds shift more dramatically
    this.players = this.players.map((p) => {
      if (p.id === player.id) return { ...p, scoredInCurrentWindow: true };
      return p;
    });

    // Next window: reset scoredInCurrentWindow
    setTimeout(() => {
      this.players = this.players.map((p) => ({
        ...p,
        scoredInCurrentWindow: false,
      }));
      this.broadcast(
        "onOddsUpdate",
        this.players.map((p) => ({ ...p })),
        { ...this.mwOdds },
      );
    }, 100);
  }

  // ── Private helpers ───────────────────────────

  private stopTick() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  /** Type-safe broadcaster: calls one callback key on every subscriber */
  private broadcast<K extends keyof MatchCallbacks>(
    key: K,
    ...args: Parameters<MatchCallbacks[K]>
  ) {
    this.subscribers.forEach((cb) => {
      const fn = cb[key] as (...a: Parameters<MatchCallbacks[K]>) => void;
      fn(...args);
    });
  }

  get currentGoalWindow() {
    return this.goalWindow;
  }
}

export const mockDataService = new MockDataService();
