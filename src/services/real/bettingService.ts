// ─────────────────────────────────────────────
//  Real Betting Service — Phase 2+ placeholder
// ─────────────────────────────────────────────
import type {
  IBettingService,
  PlaceBetParams,
  PlaceBetResult,
  ChangeBetParams,
  ChangeBetResult,
} from "../../types/services.types";
import type {
  Bet,
  BalanceState,
  PenaltyPreview,
  MatchWinnerOutcome,
} from "../../types";

class RealBettingService implements IBettingService {
  private err(): never {
    throw new Error(
      "Real betting service not implemented — set VITE_USE_MOCK=true",
    );
  }
  async placeBet(_p: PlaceBetParams): Promise<PlaceBetResult> {
    this.err();
  }
  async changeBet(_p: ChangeBetParams): Promise<ChangeBetResult> {
    this.err();
  }
  async getBets(_wallet: string): Promise<Bet[]> {
    this.err();
  }
  async getBalance(_wallet: string): Promise<BalanceState> {
    this.err();
  }
  previewPenalty(_betId: string, _minute: number): PenaltyPreview {
    this.err();
  }
  async processGoalEvent(
    _matchId: string,
    _playerId: string,
    _min: number,
    _gw: number,
  ): Promise<void> {
    this.err();
  }
  async settleBets(
    _matchId: string,
    _score: { home: number; away: number },
    _winner: MatchWinnerOutcome,
  ): Promise<void> {
    this.err();
  }
  reset(): void {
    this.err();
  }
}

export const realBettingService = new RealBettingService();
