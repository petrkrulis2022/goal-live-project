// ─────────────────────────────────────────────
//  Domain Types — goal.live Phase 1
// ─────────────────────────────────────────────

export type MatchStatus = "pre-match" | "live" | "halftime" | "finished";
export type BetType = "NEXT_GOAL_SCORER" | "MATCH_WINNER" | "EXACT_GOALS";
export type BetStatus =
  | "active"
  | "provisional_win"
  | "provisional_loss"
  | "settled_won"
  | "settled_lost"
  | "void"; // goal corrected / VAR

export type MatchWinnerOutcome = "home" | "away" | "draw";

// ── Match ──────────────────────────────────────
export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  currentMinute: number;
  score: { home: number; away: number };
  half: 1 | 2;
}

// ── Player ────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  team: "home" | "away";
  number: number;
  position: string;
  /** Next-goal-scorer odds */
  odds: number;
  /** True after this player scored in the current goal window */
  scoredInCurrentWindow?: boolean;
}

// ── Goal event ────────────────────────────────
export interface GoalEvent {
  matchId: string;
  playerId: string;
  playerName: string;
  team: "home" | "away";
  minute: number;
  /** corrected = VAR-reversed */
  corrected?: boolean;
}

// ── Match Winner odds ─────────────────────────
export interface MatchWinnerOdds {
  home: number;
  away: number;
  draw: number;
}

// ── Bet ───────────────────────────────────────
export interface Bet {
  id: string;
  bettorWallet: string;
  matchId: string;
  betType: BetType;

  // For NEXT_GOAL_SCORER
  original_player_id: string;
  current_player_id: string;

  // For MATCH_WINNER
  outcome?: MatchWinnerOutcome;

  // For EXACT_GOALS
  goalsTarget?: number;

  original_amount: number;
  current_amount: number;
  total_penalties: number;
  change_count: number;
  odds: number;
  status: BetStatus;
  placedAt: string;
  placedAtMinute: number;

  /** sequential index of the goal window in which this bet was active */
  goalWindowAtPlacement: number;
}

// ── Bet change record ─────────────────────────
export interface BetChange {
  bet_id: string;
  from_player_id: string;
  to_player_id: string;
  penalty_amount: number;
  penalty_pct: number;
  changed_at: string;
  match_minute: number;
}

// ── Balance ───────────────────────────────────
export interface BalanceState {
  /** Free / withdrawable USDC */
  wallet: number;
  /** USDC locked in active bets */
  locked: number;
  /** Provisional winnings (not withdrawable until settlement) */
  provisional: number;
  /** Potential payout if all active bets win (stake × odds) */
  potentialPayout: number;
}

// ── Penalty preview ───────────────────────────
export interface PenaltyPreview {
  penaltyPct: number;
  penaltyAmount: number;
  newEffectiveAmount: number;
  changeNumber: number;
}
