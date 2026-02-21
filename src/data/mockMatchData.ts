import type { Player, Match, MatchWinnerOdds } from "../types";

//  Real Feb 21 2026 — Man City (home) vs Newcastle United (away)
//  NGS pre-match odds sourced from bookmaker screenshot

export const MOCK_MATCH_ID = "match_city_newcastle_20260221";

export const MOCK_MATCH: Match = {
  id: MOCK_MATCH_ID,
  homeTeam: "Man City",
  awayTeam: "Newcastle",
  status: "pre-match",
  currentMinute: 0,
  score: { home: 0, away: 0 },
  half: 1,
};

export const MOCK_MATCH_WINNER_ODDS: MatchWinnerOdds = {
  home: 1.62,
  away: 5.8,
  draw: 3.7,
};

// ── Man City (home) — Official starting XI, Feb 21 2026 ───────────────
// ── Newcastle (away) — Official starting XI, Feb 21 2026 ──────────────
// odds = NGS pre-match "next goalscorer" market
export const MOCK_PLAYERS: Player[] = [
  // ── Man City — shown on RIGHT by default ─────────────────────────────
  // 4-1-3-2: Donnarumma; Ait-Nouri Guéhi Dias Nunes; Rodri; O'Reilly Silva Semenyo; Marmoush Haaland
  {
    id: "city_1",
    name: "Haaland Erling",
    team: "home",
    number: 9,
    position: "ST",
    odds: 1.52,
  },
  {
    id: "city_2",
    name: "Marmoush Omar",
    team: "home",
    number: 7,
    position: "CF",
    odds: 2.4,
  },
  {
    id: "city_3",
    name: "Semenyo Antoine",
    team: "home",
    number: 21,
    position: "RW",
    odds: 3.5,
  },
  {
    id: "city_4",
    name: "Ait-Nouri Rayan",
    team: "home",
    number: 3,
    position: "LB",
    odds: 7.0,
  },
  {
    id: "city_5",
    name: "Guehi Marc",
    team: "home",
    number: 6,
    position: "CB",
    odds: 9.0,
  },
  {
    id: "city_6",
    name: "Rodri",
    team: "home",
    number: 16,
    position: "DM",
    odds: 5.5,
  },
  {
    id: "city_7",
    name: "Silva Bernardo",
    team: "home",
    number: 20,
    position: "CAM",
    odds: 4.8,
  },
  {
    id: "city_8",
    name: "O'Reilly Nico",
    team: "home",
    number: 25,
    position: "CM",
    odds: 6.0,
  },
  {
    id: "city_9",
    name: "Dias Ruben",
    team: "home",
    number: 5,
    position: "CB",
    odds: 10.0,
  },
  {
    id: "city_10",
    name: "Nunes Matheus",
    team: "home",
    number: 27,
    position: "RB",
    odds: 8.0,
  },
  {
    id: "city_gk",
    name: "Donnarumma Gianluigi",
    team: "home",
    number: 1,
    position: "GK",
    odds: 80.0,
  },

  // ── Newcastle — shown on LEFT by default ─────────────────────────────
  // 4-3-3: Pope; Trippier Thiaw Burn Hall; Ramsey Tonali Willock; Elanga Woltemade Gordon
  {
    id: "newc_1",
    name: "Gordon Anthony",
    team: "away",
    number: 10,
    position: "LW",
    odds: 4.5,
  },
  {
    id: "newc_2",
    name: "Woltemade Nick",
    team: "away",
    number: 37,
    position: "CF",
    odds: 3.7,
  },
  {
    id: "newc_3",
    name: "Elanga Anthony",
    team: "away",
    number: 20,
    position: "RW",
    odds: 5.0,
  },
  {
    id: "newc_4",
    name: "Trippier Kieran",
    team: "away",
    number: 2,
    position: "RB",
    odds: 8.0,
  },
  {
    id: "newc_5",
    name: "Thiaw Malick",
    team: "away",
    number: 4,
    position: "CB",
    odds: 12.0,
  },
  {
    id: "newc_6",
    name: "Burn Dan",
    team: "away",
    number: 33,
    position: "CB",
    odds: 14.0,
  },
  {
    id: "newc_7",
    name: "Hall Lewis",
    team: "away",
    number: 18,
    position: "LB",
    odds: 9.0,
  },
  {
    id: "newc_8",
    name: "Ramsey Jacob",
    team: "away",
    number: 8,
    position: "CM",
    odds: 7.0,
  },
  {
    id: "newc_9",
    name: "Willock Joe",
    team: "away",
    number: 28,
    position: "CM",
    odds: 8.5,
  },
  {
    id: "newc_10",
    name: "Tonali Sandro",
    team: "away",
    number: 7,
    position: "CM",
    odds: 7.5,
  },
  {
    id: "newc_gk",
    name: "Pope Nick",
    team: "away",
    number: 1,
    position: "GK",
    odds: 80.0,
  },
];

// Synthetic goal script for the 10× replay simulation
// (replace with real match data after game ends on Feb 21)
export const MOCK_GOAL_SCRIPT: Array<{
  minute: number;
  playerId: string;
  playerName: string;
  team: "home" | "away";
}> = [
  {
    minute: 17,
    playerId: "city_1",
    playerName: "Haaland Erling",
    team: "home",
  },
  {
    minute: 38,
    playerId: "newc_1",
    playerName: "Gordon Anthony",
    team: "away",
  },
  { minute: 54, playerId: "city_2", playerName: "Marmoush Omar", team: "home" },
  {
    minute: 71,
    playerId: "newc_2",
    playerName: "Woltemade Nick",
    team: "away",
  },
  {
    minute: 84,
    playerId: "city_3",
    playerName: "Semenyo Antoine",
    team: "home",
  },
];
