import type { Player, Match, MatchWinnerOdds } from "../types";

//  LIVE Feb 26 2026 — Viktoria Plzeň (home) vs Panathinaikos FC (away)
//  UEFA Europa League — Half-time 0-1
//  Lineups from Goalserve commentaries (static_id=3826786)
//  MW odds from The Odds API (EU avg at kick-off)

export const MATCH_ID = "match_plzen_panathinaikos_20260226";

export const CURRENT_MATCH: Match = {
  id: MATCH_ID,
  homeTeam: "Viktoria Plzeň",
  awayTeam: "Panathinaikos FC",
  status: "in-progress",
  currentMinute: 45,
  score: { home: 0, away: 1 },
  half: 1,
};

export const INITIAL_MW_ODDS: MatchWinnerOdds = {
  home: 4.87,  // Plzeň to win (EU bookmaker average)
  away: 1.72,  // Panathinaikos to win
  draw: 3.0,   // Draw
};

// ── Viktoria Plzeň (home) — Confirmed XI from Goalserve, Feb 26 2026 ──
// ── Panathinaikos FC (away) — Confirmed XI from Goalserve, Feb 26 2026 ─
// odds = estimated 2nd-half NGS market (update from bookie screenshots)
export const STARTING_XI: Player[] = [
  // ── Plzeň (home) — shown on RIGHT by default ─────────────────────────
  // Plzeň 4-5-1: Wiegele; Jemelka Spáčil Dweh Memić; Souaré Červ Hrošovský Ladra Višinský; Fago Lawal
  {
    id: "plzen_f1",
    name: "Fago Lawal Salim",
    team: "home",
    number: 23,
    position: "FW",
    odds: 4.5,
  },
  {
    id: "plzen_m1",
    name: "Ladra Tomáš",
    team: "home",
    number: 11,
    position: "AM",
    odds: 7.0,
  },
  {
    id: "plzen_m2",
    name: "Višinský Denis",
    team: "home",
    number: 22,
    position: "AM",
    odds: 8.0,
  },
  {
    id: "plzen_m3",
    name: "Hrošovský Patrik",
    team: "home",
    number: 8,
    position: "CM",
    odds: 9.0,
  },
  {
    id: "plzen_m4",
    name: "Červ Lukáš",
    team: "home",
    number: 19,
    position: "CM",
    odds: 12.0,
  },
  {
    id: "plzen_m5",
    name: "Souaré Cheick",
    team: "home",
    number: 6,
    position: "DM",
    odds: 15.0,
  },
  {
    id: "plzen_d1",
    name: "Jemelka Václav",
    team: "home",
    number: 13,
    position: "RB",
    odds: 20.0,
  },
  {
    id: "plzen_d2",
    name: "Spáčil Karel",
    team: "home",
    number: 4,
    position: "CB",
    odds: 20.0,
  },
  {
    id: "plzen_d3",
    name: "Dweh Sampson",
    team: "home",
    number: 5,
    position: "CB",
    odds: 22.0,
  },
  {
    id: "plzen_d4",
    name: "Memić Amar",
    team: "home",
    number: 24,
    position: "LB",
    odds: 22.0,
  },
  {
    id: "plzen_gk",
    name: "Wiegele Florian",
    team: "home",
    number: 1,
    position: "GK",
    odds: 80.0,
  },

  // ── Panathinaikos (away) — shown on LEFT by default ───────────────────
  // 4-4-2: Lafont; Katris Ingason Touba Kyriakopoulos; Calabria Sanches Bakasetas; Taborda Zaroury Tetteh
  {
    id: "panat_f1",
    name: "Zaroury Anass",
    team: "away",
    number: 37,
    position: "LW",
    odds: 3.5,
  },
  {
    id: "panat_f2",
    name: "Tetteh Andreas",
    team: "away",
    number: 20,
    position: "FW",
    odds: 4.0,
  },
  {
    id: "panat_f3",
    name: "Taborda Vicente",
    team: "away",
    number: 9,
    position: "CF",
    odds: 4.5,
  },
  {
    id: "panat_m1",
    name: "Bakasetas Anastasios",
    team: "away",
    number: 10,
    position: "CAM",
    odds: 6.0,
  },
  {
    id: "panat_m2",
    name: "Sanches Renato",
    team: "away",
    number: 35,
    position: "CM",
    odds: 8.0,
  },
  {
    id: "panat_m3",
    name: "Calabria Davide",
    team: "away",
    number: 2,
    position: "RM",
    odds: 10.0,
  },
  {
    id: "panat_m4",
    name: "Kyriakopoulos Georgios",
    team: "away",
    number: 3,
    position: "LM",
    odds: 10.0,
  },
  {
    id: "panat_d1",
    name: "Katris Georgios",
    team: "away",
    number: 16,
    position: "RB",
    odds: 18.0,
  },
  {
    id: "panat_d2",
    name: "Ingason Sverrir",
    team: "away",
    number: 5,
    position: "CB",
    odds: 20.0,
  },
  {
    id: "panat_d3",
    name: "Touba Ahmed",
    team: "away",
    number: 22,
    position: "CB",
    odds: 20.0,
  },
  {
    id: "panat_gk",
    name: "Lafont Alban",
    team: "away",
    number: 1,
    position: "GK",
    odds: 80.0,
  },
];

// Goal events — fill in as goals are confirmed during the match
export const GOAL_SCRIPT: Array<{
  minute: number;
  playerId: string;
  playerName: string;
  team: "home" | "away";
}> = [
  // 1st half goal — scorer TBC (Goalserve summary missing at HT)
  // { minute: ??, playerId: "panat_??", playerName: "???", team: "away" },
];
