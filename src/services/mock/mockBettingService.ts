// ─────────────────────────────────────────────
//  Mock Betting Service
//  • NGS resolves on the NEXT goal after placement
//  • MATCH_WINNER resolves at full-time
//  • Hybrid penalty: base[changeCount] × time-decay
//  • localStorage persistence
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
  BetChange,
  PenaltyPreview,
  MatchWinnerOutcome,
} from "../../types";
import { calcPenalty } from "../../utils/penaltyCalculator";

const BETS_KEY = "gl_mock_bets";
// The in-app wallet address that all bets must be stamped with
const IN_APP_WALLET = (import.meta.env.VITE_PLATFORM_WALLET as string) ?? "";
// Remove old balance key from pre-refactor sessions
localStorage.removeItem("gl_mock_balance");

// ── Persistence helpers ────────────────────────
function loadBets(): Bet[] {
  try {
    const raw = JSON.parse(localStorage.getItem(BETS_KEY) ?? "[]") as Bet[];
    // Purge any bets placed with the old mock wallet address (pre-refactor)
    let clean = raw.filter((b) => !b.bettorWallet.startsWith("0xMock"));
    // Migrate bets placed under the player wallet before the architecture switch
    if (IN_APP_WALLET) {
      clean = clean.map((b) =>
        b.bettorWallet.toLowerCase() !== IN_APP_WALLET.toLowerCase()
          ? { ...b, bettorWallet: IN_APP_WALLET }
          : b,
      );
    }
    if (JSON.stringify(clean) !== JSON.stringify(raw)) {
      localStorage.setItem(BETS_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return [];
  }
}
function saveBets(bets: Bet[]) {
  localStorage.setItem(BETS_KEY, JSON.stringify(bets));
}

// ── Service ────────────────────────────────────
class MockBettingService implements IBettingService {
  private bets: Bet[] = loadBets();

  // ── Read ──────────────────────────────────────

  async getBets(wallet: string): Promise<Bet[]> {
    return this.bets.filter((b) => b.bettorWallet === wallet);
  }

  async getBalance(wallet: string): Promise<BalanceState> {
    // Compute locked/provisional dynamically from active bets for this wallet.
    // wallet amount is sourced from the real wallet service in useBetting.
    const active = this.bets.filter(
      (b) => b.bettorWallet === wallet && b.status === "active",
    );
    const provisional = this.bets
      .filter(
        (b) => b.bettorWallet === wallet && b.status === "provisional_win",
      )
      .reduce((sum, b) => sum + b.current_amount * b.odds, 0);
    const locked = active.reduce((sum, b) => sum + b.current_amount, 0);
    // Potential payout = sum of (stake × odds) for all currently active bets
    const potentialPayout = active.reduce(
      (sum, b) => sum + b.current_amount * b.odds,
      0,
    );
    return { wallet: 0, locked, provisional, potentialPayout };
  }

  previewPenalty(betId: string, currentMinute: number): PenaltyPreview {
    const bet = this.bets.find((b) => b.id === betId);
    if (!bet)
      return {
        penaltyPct: 0,
        penaltyAmount: 0,
        newEffectiveAmount: 0,
        changeNumber: 1,
      };
    return calcPenalty(bet.current_amount, bet.change_count + 1, currentMinute);
  }

  // ── Place bet ─────────────────────────────────

  async placeBet(params: PlaceBetParams): Promise<PlaceBetResult> {
    const {
      matchId,
      wallet,
      betType,
      playerId,
      outcome,
      amount,
      odds,
      currentMinute,
      goalWindow,
    } = params;

    if (amount <= 0)
      return {
        success: false,
        bet: null as unknown as Bet,
        error: "Amount must be > 0",
      };
    // Balance validation is handled by useBetting against the real wallet service.
    if (betType === "NEXT_GOAL_SCORER" && !playerId)
      return {
        success: false,
        bet: null as unknown as Bet,
        error: "playerId required for NGS",
      };
    if (betType === "MATCH_WINNER" && !outcome)
      return {
        success: false,
        bet: null as unknown as Bet,
        error: "outcome required for MATCH_WINNER",
      };

    // ── Only one active NGS bet at a time ─────────
    // If user already has one, the UI should route to changeBet instead.
    if (betType === "NEXT_GOAL_SCORER") {
      const existing = this.bets.find(
        (b) =>
          b.bettorWallet === wallet &&
          b.betType === "NEXT_GOAL_SCORER" &&
          b.status === "active",
      );
      if (existing) {
        return {
          success: false,
          bet: null as unknown as Bet,
          // Special prefix lets BettingOverlay auto-open change flow
          error: `EXISTING_NGS_BET:${existing.id}`,
        };
      }
    }

    const bet: Bet = {
      id: `bet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      bettorWallet: wallet,
      matchId,
      betType,
      original_player_id: playerId ?? outcome ?? "",
      current_player_id: playerId ?? outcome ?? "",
      outcome: betType === "MATCH_WINNER" ? outcome : undefined,
      original_amount: amount,
      current_amount: amount,
      total_penalties: 0,
      change_count: 0,
      odds,
      status: "active",
      placedAt: new Date().toISOString(),
      placedAtMinute: currentMinute,
      goalWindowAtPlacement: goalWindow,
    };

    this.bets.push(bet);
    this.persist();

    return { success: true, bet: { ...bet } };
  }

  // ── Change bet ────────────────────────────────

  async changeBet(params: ChangeBetParams): Promise<ChangeBetResult> {
    const { betId, newPlayerId, newOutcome, newOdds, currentMinute } = params;
    const bet = this.bets.find((b) => b.id === betId);
    if (!bet) return this.changeError("Bet not found");
    if (bet.status !== "active")
      return this.changeError("Cannot change a resolved bet");

    const changeNumber = bet.change_count + 1;
    const penalty = calcPenalty(
      bet.current_amount,
      changeNumber,
      currentMinute,
    );

    const change: BetChange = {
      bet_id: betId,
      from_player_id: bet.current_player_id,
      to_player_id: newPlayerId ?? newOutcome ?? "",
      penalty_amount: penalty.penaltyAmount,
      penalty_pct: penalty.penaltyPct,
      changed_at: new Date().toISOString(),
      match_minute: currentMinute,
    };

    // Update bet
    bet.current_player_id = newPlayerId ?? newOutcome ?? bet.current_player_id;
    if (newOutcome) bet.outcome = newOutcome as MatchWinnerOutcome;
    bet.current_amount = penalty.newEffectiveAmount;
    bet.total_penalties += penalty.penaltyAmount;
    bet.change_count = changeNumber;
    bet.odds = newOdds;
    bet.goalWindowAtPlacement = params.currentMinute; // treat change as new placement for goal window tracking

    this.persist();
    return { success: true, updatedBet: { ...bet }, change, penalty };
  }

  // ── Goal event ────────────────────────────────

  async processGoalEvent(
    matchId: string,
    scoringPlayerId: string,
    _minute: number,
    goalWindow: number,
  ): Promise<void> {
    const matchBets = this.bets.filter(
      (b) =>
        b.matchId === matchId &&
        b.status === "active" &&
        b.betType === "NEXT_GOAL_SCORER",
    );

    for (const bet of matchBets) {
      // Only resolve bets that were active for THIS goal window
      if (bet.goalWindowAtPlacement !== goalWindow) continue;

      if (bet.current_player_id === scoringPlayerId) {
        bet.status = "provisional_win";
        const payout = bet.current_amount * bet.odds;
        console.info(
          `[goal.live] Provisional WIN: +$${payout.toFixed(2)} (bet ${bet.id})`,
        );
      } else {
        bet.status = "provisional_loss";
        console.info(`[goal.live] Provisional LOSS (bet ${bet.id})`);
      }
    }

    this.persist();
    window.dispatchEvent(
      new CustomEvent("gl:goal", { detail: { scoringPlayerId, goalWindow } }),
    );
  }

  // ── Settlement ────────────────────────────────

  async settleBets(
    matchId: string,
    finalScore: { home: number; away: number },
    winner: MatchWinnerOutcome,
  ): Promise<void> {
    const matchBets = this.bets.filter((b) => b.matchId === matchId);

    let totalPayout = 0;
    for (const bet of matchBets) {
      if (bet.status === "settled_won" || bet.status === "settled_lost")
        continue;

      if (bet.betType === "NEXT_GOAL_SCORER") {
        if (bet.status === "provisional_win") {
          const payout = bet.current_amount * bet.odds;
          totalPayout += payout;
          bet.status = "settled_won";
          console.info(`[goal.live] Settled WON +$${payout.toFixed(2)}`);
        } else {
          bet.status = "settled_lost";
        }
      } else if (bet.betType === "MATCH_WINNER") {
        const won = bet.outcome === winner;
        if (won) {
          const payout = bet.current_amount * bet.odds;
          totalPayout += payout;
          bet.status = "settled_won";
          console.info(`[goal.live] MW Settled WON +$${payout.toFixed(2)}`);
        } else {
          bet.status = "settled_lost";
        }
      }
    }

    this.persist();
    // Emit payout so useBetting can credit the real wallet via wallet service
    window.dispatchEvent(
      new CustomEvent("gl:settled", {
        detail: { matchId, winner, finalScore, totalPayout },
      }),
    );
  }

  // ── Reset ─────────────────────────────────────

  reset(): void {
    this.bets = [];
    this.persist();
    console.info("[goal.live] Betting service reset");
  }

  // ── Private ───────────────────────────────────

  private persist() {
    saveBets(this.bets);
  }

  private changeError(msg: string): ChangeBetResult {
    return {
      success: false,
      updatedBet: null as unknown as Bet,
      change: null as unknown as BetChange,
      penalty: null as unknown as PenaltyPreview,
      error: msg,
    };
  }
}

export const mockBettingService = new MockBettingService();
