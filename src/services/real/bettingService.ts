// ─────────────────────────────────────────────
//  Real Betting Service — Supabase Phase 2
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
import { supabase, type DbBet } from "../../lib/supabase";
import { calcPenalty } from "../../utils/penaltyCalculator";

// ── helpers ────────────────────────────────────────────────────────────────

function dbBetToBet(row: DbBet): Bet {
  return {
    id: row.id,
    bettorWallet: row.bettor_wallet,
    matchId: row.match_id,
    betType: row.bet_type,
    original_player_id: row.original_player_id,
    current_player_id: row.current_player_id,
    outcome: row.outcome ?? undefined,
    original_amount: Number(row.original_amount),
    current_amount: Number(row.current_amount),
    total_penalties: Number(row.total_penalties),
    change_count: row.change_count,
    odds: Number(row.odds),
    status: row.status,
    placedAt: row.placed_at,
    placedAtMinute: row.placed_at_minute,
    goalWindowAtPlacement: row.goal_window_at_placement ?? 0,
  };
}

class SupabaseBettingService implements IBettingService {
  // cache of bets by betId for penalty preview (avoids extra round-trips)
  private _cache: Map<string, Bet> = new Map();

  // ── placeBet ─────────────────────────────────
  async placeBet(params: PlaceBetParams): Promise<PlaceBetResult> {
    const {
      matchId, wallet, betType, playerId, outcome,
      amount, odds, currentMinute, goalWindow,
    } = params;

    // Resolve match uuid
    const { data: match, error: me } = await supabase
      .from("matches")
      .select("id")
      .eq("external_match_id", matchId)
      .single();
    if (me || !match)
      return { success: false, bet: null as never, error: "Match not found" };

    // Only one active NGS bet per wallet per match
    if (betType === "NEXT_GOAL_SCORER") {
      const { data: existing } = await supabase
        .from("bets")
        .select("id")
        .eq("bettor_wallet", wallet)
        .eq("match_id", match.id)
        .eq("bet_type", "NEXT_GOAL_SCORER")
        .eq("status", "active")
        .maybeSingle();
      if (existing)
        return {
          success: false,
          bet: null as never,
          error: `EXISTING_NGS_BET:${existing.id}`,
        };
    }

    const { data, error } = await supabase
      .from("bets")
      .insert({
        bettor_wallet: wallet,
        match_id: match.id,
        bet_type: betType,
        original_player_id: playerId ?? outcome ?? "",
        current_player_id: playerId ?? outcome ?? "",
        outcome: betType === "MATCH_WINNER" ? outcome : null,
        original_amount: amount,
        current_amount: amount,
        total_penalties: 0,
        change_count: 0,
        odds,
        status: "active",
        placed_at_minute: currentMinute,
        goal_window_at_placement: goalWindow,
      })
      .select()
      .single();

    if (error || !data)
      return { success: false, bet: null as never, error: error?.message };

    const bet = dbBetToBet(data as DbBet);
    this._cache.set(bet.id, bet);
    return { success: true, bet };
  }

  // ── changeBet ─────────────────────────────────
  async changeBet(params: ChangeBetParams): Promise<ChangeBetResult> {
    const { betId, newPlayerId, newOutcome, newOdds, currentMinute, newAmount } = params;

    const { data: existing, error: fe } = await supabase
      .from("bets")
      .select("*")
      .eq("id", betId)
      .single();
    if (fe || !existing)
      return {
        success: false,
        updatedBet: null as never,
        change: null as never,
        penalty: null as never,
        error: "Bet not found",
      };

    const bet = existing as DbBet;
    const changeNumber = bet.change_count + 1;
    const penalty = calcPenalty(
      Number(bet.current_amount),
      changeNumber,
      currentMinute,
    );
    const finalAmount =
      newAmount !== undefined && newAmount > 0
        ? newAmount
        : penalty.newEffectiveAmount;

    // Update bet row
    const { data: updated, error: ue } = await supabase
      .from("bets")
      .update({
        current_player_id: newPlayerId ?? newOutcome ?? bet.current_player_id,
        outcome: newOutcome ?? bet.outcome,
        current_amount: finalAmount,
        total_penalties: Number(bet.total_penalties) + penalty.penaltyAmount,
        change_count: changeNumber,
        odds: newOdds,
        goal_window_at_placement: currentMinute,
      })
      .eq("id", betId)
      .select()
      .single();

    if (ue || !updated)
      return {
        success: false,
        updatedBet: null as never,
        change: null as never,
        penalty,
        error: ue?.message,
      };

    // Insert change record
    await supabase.from("bet_changes").insert({
      bet_id: betId,
      from_player_id: bet.current_player_id,
      to_player_id: newPlayerId ?? newOutcome ?? "",
      penalty_amount: penalty.penaltyAmount,
      penalty_pct: penalty.penaltyPct,
      match_minute: currentMinute,
    });

    const updatedBet = dbBetToBet(updated as DbBet);
    this._cache.set(updatedBet.id, updatedBet);
    return {
      success: true,
      updatedBet,
      change: {
        bet_id: betId,
        from_player_id: bet.current_player_id,
        to_player_id: newPlayerId ?? newOutcome ?? "",
        penalty_amount: penalty.penaltyAmount,
        penalty_pct: penalty.penaltyPct,
        changed_at: new Date().toISOString(),
        match_minute: currentMinute,
      },
      penalty,
    };
  }

  // ── getBets ──────────────────────────────────
  async getBets(wallet: string): Promise<Bet[]> {
    const { data, error } = await supabase
      .from("bets")
      .select("*")
      .eq("bettor_wallet", wallet)
      .order("placed_at", { ascending: false });
    if (error) throw new Error(error.message);
    const bets = (data as DbBet[]).map(dbBetToBet);
    bets.forEach((b) => this._cache.set(b.id, b));
    return bets;
  }

  // ── getBalance ───────────────────────────────
  async getBalance(wallet: string): Promise<BalanceState> {
    const bets = await this.getBets(wallet);
    const active = bets.filter((b) => b.status === "active");
    const provisional = bets
      .filter((b) => b.status === "provisional_win")
      .reduce((s, b) => s + b.current_amount * b.odds, 0);
    const locked = active.reduce((s, b) => s + b.current_amount, 0);
    const potentialPayout = active.reduce(
      (s, b) => s + b.current_amount * b.odds,
      0,
    );
    return { wallet: 0, locked, provisional, potentialPayout };
  }

  // ── previewPenalty ────────────────────────────
  previewPenalty(betId: string, currentMinute: number): PenaltyPreview {
    const bet = this._cache.get(betId);
    if (!bet) throw new Error("Bet not in cache — call getBets first");
    return calcPenalty(bet.current_amount, bet.change_count + 1, currentMinute);
  }

  // ── processGoalEvent ─────────────────────────
  async processGoalEvent(
    matchId: string,
    scoringPlayerId: string,
    minute: number,
    goalWindow: number,
  ): Promise<void> {
    // Resolve match uuid
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("external_match_id", matchId)
      .single();
    if (!match) return;

    // Get all active NGS bets for this match
    const { data: bets } = await supabase
      .from("bets")
      .select("id, current_player_id, goal_window_at_placement")
      .eq("match_id", match.id)
      .eq("bet_type", "NEXT_GOAL_SCORER")
      .eq("status", "active");
    if (!bets?.length) return;

    for (const bet of bets) {
      const inWindow =
        (bet.goal_window_at_placement ?? 0) <= minute &&
        minute <= (bet.goal_window_at_placement ?? 0) + goalWindow;
      const isWinner =
        bet.current_player_id === scoringPlayerId && inWindow;
      await supabase
        .from("bets")
        .update({ status: isWinner ? "provisional_win" : "provisional_loss" })
        .eq("id", bet.id);
    }
  }

  // ── settleBets ────────────────────────────────
  async settleBets(
    matchId: string,
    _finalScore: { home: number; away: number },
    _winner: MatchWinnerOutcome,
  ): Promise<void> {
    const { data: match } = await supabase
      .from("matches")
      .select("id")
      .eq("external_match_id", matchId)
      .single();
    if (!match) return;

    // Settle provisional_win → settled_won, provisional_loss → settled_lost
    await supabase
      .from("bets")
      .update({ status: "settled_won" })
      .eq("match_id", match.id)
      .eq("status", "provisional_win");

    await supabase
      .from("bets")
      .update({ status: "settled_lost" })
      .eq("match_id", match.id)
      .in("status", ["provisional_loss", "active"]);

    // Mark match finished
    await supabase
      .from("matches")
      .update({ status: "finished" })
      .eq("id", match.id);
  }

  // ── reset ─────────────────────────────────────
  reset(): void {
    this._cache.clear();
  }
}

export const realBettingService = new SupabaseBettingService();
