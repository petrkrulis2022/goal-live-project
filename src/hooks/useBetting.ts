import { useState, useEffect, useCallback, useRef } from "react";
import { services } from "../services";
import type { Bet, BalanceState } from "../types";

export function useBetting(wallet: string | null) {
  const [bets, setBets] = useState<Bet[]>([]);
  const [balance, setBalance] = useState<BalanceState>({
    wallet: 0,
    locked: 0,
    provisional: 0,
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!wallet) return;
    const [b, bal] = await Promise.all([
      services.betting.getBets(wallet),
      services.betting.getBalance(wallet),
    ]);
    setBets(b);
    setBalance(bal);
  }, [wallet]);

  // Initial load + listen for balance refresh events
  useEffect(() => {
    if (!wallet) return;
    refresh();

    const handler = () => refresh();
    window.addEventListener("gl:balanceRefresh", handler);
    window.addEventListener("gl:goal", handler);
    window.addEventListener("gl:settled", handler);
    return () => {
      window.removeEventListener("gl:balanceRefresh", handler);
      window.removeEventListener("gl:goal", handler);
      window.removeEventListener("gl:settled", handler);
    };
  }, [wallet, refresh]);

  const placeBet = useCallback(
    async (params: {
      betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER";
      playerId?: string;
      outcome?: "home" | "away" | "draw";
      amount: number;
      odds: number;
      currentMinute: number;
      goalWindow: number;
      matchId: string;
    }) => {
      if (!wallet) throw new Error("Wallet not connected");
      setLoading(true);
      try {
        const result = await services.betting.placeBet({ ...params, wallet });
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
    ) => {
      setLoading(true);
      try {
        const result = await services.betting.changeBet({
          betId,
          newPlayerId,
          newOutcome,
          newOdds,
          currentMinute,
        });
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
