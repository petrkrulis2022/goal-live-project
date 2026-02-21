// ─────────────────────────────────────────────
//  Real Data Service — Phase 2+ placeholder
// ─────────────────────────────────────────────
import type { IDataService, MatchCallbacks } from "../../types/services.types";
import type { Match, Player, MatchWinnerOdds } from "../../types";

class RealDataService implements IDataService {
  async getMatch(_matchId: string): Promise<Match> {
    throw new Error(
      "Real data service not implemented — set VITE_USE_MOCK=true",
    );
  }
  async getPlayers(_matchId: string): Promise<Player[]> {
    throw new Error("Real data service not implemented");
  }
  async getMatchWinnerOdds(_matchId: string): Promise<MatchWinnerOdds> {
    throw new Error("Real data service not implemented");
  }
  subscribeToMatch(_matchId: string, _callbacks: MatchCallbacks): () => void {
    throw new Error("Real data service not implemented");
  }
}

export const realDataService = new RealDataService();
