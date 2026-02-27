// ─────────────────────────────────────────────────────────────────────────────
//  Match Registry — goal.live
//  Single source of truth for all match configs available in the extension.
//  To add a new match: create its data file and add an entry here.
//  The extension popup reads this registry to present the match picker.
// ─────────────────────────────────────────────────────────────────────────────
import type { Match, Player, MatchWinnerOdds } from "../types";
import {
  MATCH_ID,
  CURRENT_MATCH,
  STARTING_XI,
  INITIAL_MW_ODDS,
  GOAL_SCRIPT,
} from "./matchData";

export interface MatchConfig {
  /** Short key used in chrome.storage — never changes for a given match */
  matchKey: string;
  /** Human-readable label for the popup */
  label: string;
  league: string;
  goalserveStaticId: string;
  goalserveLeague: string;
  /** Full match object (id, score, minute, etc.) */
  matchId: string;
  currentMatch: Match;
  startingXI: Player[];
  initialMWOdds: MatchWinnerOdds;
  goalScript: Array<{
    minute: number;
    playerId: string;
    playerName: string;
    team: "home" | "away";
  }>;
  /** When true, odds do not fluctuate during replay — useful for UI/UX testing */
  steadyOdds?: boolean;
}

// ── Plzeň vs Panathinaikos, UECL Feb 26 2026 ─────────────────────────────────
const PLZEN_PANAT: MatchConfig = {
  matchKey: "plzen_panat_20260226",
  label: "Viktoria Plzeň vs Panathinaikos",
  league: "UECL",
  goalserveStaticId: "3826786",
  goalserveLeague: "1007",
  matchId: MATCH_ID,
  currentMatch: CURRENT_MATCH,
  startingXI: STARTING_XI,
  initialMWOdds: INITIAL_MW_ODDS,
  goalScript: GOAL_SCRIPT,
  steadyOdds: true,
};

// ── Wolverhampton vs Aston Villa, EPL Feb 27 2026 ────────────────────────────
// Odds API event ID: b9ade3f715e4c344543f672014bc2188 (KO 21:00 CET)
// startingXI populated at ~20:00 CET when lineups confirmed
const WOLVES_VILLA: MatchConfig = {
  matchKey: "wolves_villa_20260227",
  label: "Wolverhampton vs Aston Villa",
  league: "EPL",
  goalserveStaticId: "0", // update once Goalserve confirms match ID
  goalserveLeague: "1204",
  matchId: "wolves_villa_20260227",
  currentMatch: {
    id: "wolves_villa_20260227",
    homeTeam: "Wolverhampton Wanderers",
    awayTeam: "Aston Villa",
    status: "pre-match",
    currentMinute: 0,
    score: { home: 0, away: 0 },
    half: 1,
  },
  startingXI: [], // populated at lineup confirmation
  initialMWOdds: { home: 3.5, draw: 3.4, away: 2.1 }, // pre-match estimate
  goalScript: [], // live match — no replay script
  steadyOdds: false, // use live Odds API feed
};

// ── Registry ──────────────────────────────────────────────────────────────────
export const MATCH_REGISTRY: Record<string, MatchConfig> = {
  [PLZEN_PANAT.matchKey]: PLZEN_PANAT,
  [WOLVES_VILLA.matchKey]: WOLVES_VILLA,
};

export const DEFAULT_MATCH_KEY = PLZEN_PANAT.matchKey;
