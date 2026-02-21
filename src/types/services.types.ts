// ─────────────────────────────────────────────
//  Service Interfaces — goal.live Phase 1
//  Every mock AND real service MUST implement these.
// ─────────────────────────────────────────────
import type {
  Match,
  Player,
  Bet,
  BetType,
  MatchWinnerOdds,
  MatchWinnerOutcome,
  BalanceState,
  PenaltyPreview,
  BetChange,
} from "./index";

// ── Match / CRE callbacks ─────────────────────
export interface MatchCallbacks {
  onMinuteTick: (minute: number) => void;
  onOddsUpdate: (players: Player[], matchWinner: MatchWinnerOdds) => void;
  onGoal: (
    playerId: string,
    playerName: string,
    minute: number,
    team: "home" | "away",
  ) => void;
  onGoalCorrected: (originalPlayerId: string) => void;
  onScoreUpdate: (score: { home: number; away: number }) => void;
  onMatchEnd: (score: { home: number; away: number }) => void;
  onStatusChange: (status: Match["status"]) => void;
}

// ── IDataService ──────────────────────────────
export interface IDataService {
  getMatch(matchId: string): Promise<Match>;
  getPlayers(matchId: string): Promise<Player[]>;
  getMatchWinnerOdds(matchId: string): Promise<MatchWinnerOdds>;
  /** Subscribe to live match updates. Returns unsubscribe fn. */
  subscribeToMatch(matchId: string, callbacks: MatchCallbacks): () => void;
  /** Advance simulation clock (mock-only helper exposed via interface for dev tools) */
  triggerGoal?(matchId: string, playerId: string): void;
  startSimulation?(matchId: string): void;
  resetSimulation?(matchId: string): void;
}

// ── Place/Change params ─────────────────────
export interface PlaceBetParams {
  matchId: string;
  wallet: string;
  betType: BetType;
  playerId?: string; // NEXT_GOAL_SCORER
  outcome?: MatchWinnerOutcome; // MATCH_WINNER
  amount: number;
  odds: number;
  currentMinute: number;
  goalWindow: number;
}

export interface PlaceBetResult {
  success: boolean;
  bet: Bet;
  error?: string;
}

export interface ChangeBetParams {
  betId: string;
  newPlayerId?: string;
  newOutcome?: MatchWinnerOutcome;
  newOdds: number;
  currentMinute: number;
}

export interface ChangeBetResult {
  success: boolean;
  updatedBet: Bet;
  change: BetChange;
  penalty: PenaltyPreview;
  error?: string;
}

// ── IBettingService ────────────────────────────
export interface IBettingService {
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;
  changeBet(params: ChangeBetParams): Promise<ChangeBetResult>;
  getBets(wallet: string): Promise<Bet[]>;
  getBalance(wallet: string): Promise<BalanceState>;
  previewPenalty(betId: string, currentMinute: number): PenaltyPreview;
  /** Called on goal: marks winning/losing NGS bets provisional */
  processGoalEvent(
    matchId: string,
    scoringPlayerId: string,
    minute: number,
    goalWindow: number,
  ): Promise<void>;
  /** Called at match end: converts provisional → final, settles MATCH_WINNER */
  settleBets(
    matchId: string,
    finalScore: { home: number; away: number },
    winner: MatchWinnerOutcome,
  ): Promise<void>;
  reset(): void;
}

// ── WalletState ────────────────────────────────
export interface WalletState {
  address: string;
  balance: number;
  connected: boolean;
}

// ── IWalletService ─────────────────────────────
export interface IWalletService {
  connect(): Promise<WalletState>;
  disconnect(): void;
  getState(): WalletState | null;
  getBalance(): Promise<number>;
  /** Deduct amount from wallet balance (mock: immediate; real: tx) */
  deductBalance(amount: number): Promise<void>;
  /** Add amount to wallet balance (mock: immediate; real: settlement) */
  addBalance(amount: number): Promise<void>;
  /**
   * Top-up in-app balance by transferring USDC from the user's wallet.
   * Mock: instant credit. Real: on-chain USDC transfer on Sepolia.
   * Returns a tx hash (or mock id).
   */
  topUp(amount: number): Promise<string>;
  onStateChange(cb: (state: WalletState | null) => void): () => void;
}
