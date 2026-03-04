// ─────────────────────────────────────────────────────────────────────────────
//  Match Registry — goal.live
//  Single source of truth for all match configs available in the extension.
//  To add a new match: create its data file and add an entry here.
//  The extension popup reads this registry to present the match picker.
// ─────────────────────────────────────────────────────────────────────────────
import type { Match, Player, MatchWinnerOdds } from "../types";

export interface MatchConfig {
  /** Short key used in chrome.storage — never changes for a given match */
  matchKey: string;
  /** Human-readable label for the popup */
  label: string;
  league: string;
  goalserveStaticId: string;
  goalserveLeague: string;
  /** external_match_id in Supabase matches table */
  matchId: string;
  currentMatch: Match;
  startingXI: Player[];
  initialMWOdds: MatchWinnerOdds;
}

// ── Liverpool vs West Ham United, EPL Feb 28 2026 ───────────────────────────
// Odds API event ID: 466f3df43a6647947e4fb9cab6657d80 (KO ~16:00 UTC)
const LIVERPOOL_WESTHAM: MatchConfig = {
  matchKey: "liverpool_westham_20260228",
  label: "Liverpool vs West Ham United",
  league: "EPL",
  goalserveStaticId: "3682598",
  goalserveLeague: "1204",
  matchId: "466f3df43a6647947e4fb9cab6657d80",
  currentMatch: {
    id: "466f3df43a6647947e4fb9cab6657d80",
    homeTeam: "Liverpool",
    awayTeam: "West Ham United",
    status: "pre-match",
    currentMinute: 0,
    score: { home: 0, away: 0 },
    half: 1,
  },
  startingXI: [], // populated at lineup confirmation
  initialMWOdds: { home: 1.5, draw: 4.2, away: 6.5 }, // pre-match estimate
};

// ── Real Madrid vs Getafe, La Liga Mar 2 2026 ────────────────────────────────
// Odds API event ID: 7a8e8e30174af5cd99d1a3977365674e (KO 20:00 UTC)
// Goalserve static_id: 4200637, league: 1399
const REALMADRID_GETAFE: MatchConfig = {
  matchKey: "realmadrid_getafe_20260302",
  label: "Real Madrid vs Getafe",
  league: "La Liga",
  goalserveStaticId: "4200637",
  goalserveLeague: "1399",
  matchId: "7a8e8e30174af5cd99d1a3977365674e",
  currentMatch: {
    id: "7a8e8e30174af5cd99d1a3977365674e",
    homeTeam: "Real Madrid",
    awayTeam: "Getafe",
    status: "pre-match",
    currentMinute: 0,
    score: { home: 0, away: 0 },
    half: 1,
  },
  startingXI: [],
  initialMWOdds: { home: 1.4, draw: 4.8, away: 8.5 },
};

// ── Registry ──────────────────────────────────────────────────────────────────
export const MATCH_REGISTRY: Record<string, MatchConfig> = {
  [REALMADRID_GETAFE.matchKey]: REALMADRID_GETAFE,
  [LIVERPOOL_WESTHAM.matchKey]: LIVERPOOL_WESTHAM,
};

export const DEFAULT_MATCH_KEY = REALMADRID_GETAFE.matchKey;
