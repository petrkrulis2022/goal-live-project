import { useState, useEffect, useCallback, useRef } from "react";
import { services } from "../services";
import type { Bet, BalanceState } from "../types";

export function useBetting(wallet: string | null, matchUuid?: string) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [balance, setBalance] = useState<BalanceState>(() => ({
    wallet: services.wallet.getState()?.balance ?? 0,
    locked: 0,
    lockedThisGame: 0,
    slashedThisGame: 0,
    available: services.wallet.getState()?.inAppBalance ?? 0,
    provisional: 0,
    potentialPayout: 0,
  }));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    const [b, bal] = await Promise.all([
      services.betting.getBets(wallet, matchUuid),
      services.betting.getBalance(wallet, matchUuid),
    ]);
    setBets(b);
    // wallet = in-app balance (what user can bet with); locked/provisional from betting service
    const inApp = services.wallet.getState()?.inAppBalance ?? 0;
    setBalance({
      wallet: inApp,
      locked: bal.locked,
      lockedThisGame: bal.lockedThisGame,
      slashedThisGame: bal.slashedThisGame,
      available: Math.max(0, inApp - bal.locked),
      provisional: bal.provisional,
      potentialPayout: bal.potentialPayout,
    });
  }, [wallet, matchUuid]);

  // Keep balance.wallet in sync with in-app balance from wallet service.
  // Also re-run refresh so locked/potentialPayout stay current after any state change.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    return services.wallet.onStateChange((ws) => {
      const inApp = ws?.inAppBalance ?? 0;
      setBalance((prev) => ({
        ...prev,
        wallet: inApp,
        available: Math.max(0, inApp - prev.locked),
      }));
      // Re-sync locked / potentialPayout whenever wallet state changes
      if (ws) refreshRef.current();
    });
  }, []);

  // Initial load + listen for balance refresh events
  useEffect(() => {
    if (!wallet) return;
    refresh();

    const settledHandler = (e: Event) => {
      const { totalPayout } = (e as CustomEvent).detail ?? {};
      if (totalPayout > 0) {
        services.wallet.addBalance(totalPayout).catch(() => {});
      }
      refresh();
    };
    const handler = () => refresh();
    window.addEventListener("gl:balanceRefresh", handler);
    window.addEventListener("gl:goal", handler);
    window.addEventListener("gl:settled", settledHandler);
    return () => {
      window.removeEventListener("gl:balanceRefresh", handler);
      window.removeEventListener("gl:goal", handler);
      window.removeEventListener("gl:settled", settledHandler);
    };
  }, [wallet, refresh]);

  const placeBet = useCallback(
    async (params: {
      betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER" | "EXACT_GOALS";
      playerId?: string;
      outcome?: "home" | "away" | "draw";
      goalsTarget?: number;
      amount: number;
      odds: number;
      currentMinute: number;
      goalWindow: number;
      matchId: string;
    }) => {
      if (!wallet) throw new Error("Wallet not connected");
      // Validate against *available* balance (deposited minus already-locked bets)
      const realBalance = services.wallet.getState()?.inAppBalance ?? 0;
      const available = Math.max(0, realBalance - balance.locked);
      if (params.amount > available) {
        return {
          success: false,
          bet: null as never,
          error: `Insufficient balance. Available: $${available.toFixed(2)}`,
        };
      }
      setLoading(true);
      try {
        const result = await services.betting.placeBet({ ...params, wallet });
        if (result.success) {
          // Optimistically deduct from real wallet state so balance updates immediately
          try {
            await services.wallet.deductBalance(params.amount);
          } catch {
            // soft-fail: bet is placed in DB; refresh will reconcile locked amount
          }
        }
        await refresh();
        return result;
      } finally {
        setLoading(false);
      }
    },
    [wallet, refresh],
  );

  const changeBet = useCallback(
    async (
      betId: string,
      newPlayerId: string | undefined,
      newOutcome: "home" | "away" | "draw" | undefined,
      newOdds: number,
      currentMinute: number,
      newAmount?: number,
    ) => {
      setLoading(true);
      try {
        const result = await services.betting.changeBet({
          betId,
          newPlayerId,
          newOutcome,
          newOdds,
          currentMinute,
          newAmount,
        });
        if (result.success && newAmount !== undefined) {
          // Adjust wallet: positive diff = top-up (deduct extra), negative = refund
          const diff = newAmount - result.penalty.newEffectiveAmount;
          if (diff > 0) {
            await services.wallet.deductBalance(diff);
          } else if (diff < 0) {
            await services.wallet.addBalance(-diff);
          }
        }
        await refresh();
        return result;
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  const previewPenalty = useCallback(
    (betId: string, currentMinute: number) =>
      services.betting.previewPenalty(betId, currentMinute),
    [],
  );

  return {
    bets,
    balance,
    loading,
    placeBet,
    changeBet,
    previewPenalty,
    refresh,
  };
}
