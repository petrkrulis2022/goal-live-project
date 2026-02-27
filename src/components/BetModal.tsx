import React, { useState, useCallback } from "react";
import type { Player, MatchWinnerOdds, Bet, BalanceState } from "../types";
import type { MatchWinnerOutcome } from "../types";

interface BetModalProps {
  // One of these three will be set
  player?: Player;
  mwOutcome?: MatchWinnerOutcome;
  mwOdds?: MatchWinnerOdds;
  egGoals?: number; // EXACT_GOALS — total goals target
  egOdds?: number; // pre-set odds for that goals count
  // Context
  currentMinute: number;
  goalWindow: number;
  matchId: string;
  balance: BalanceState;
  activeBet: Bet | null;
  // Callbacks
  onPlaceBet: (params: {
    betType: "NEXT_GOAL_SCORER" | "MATCH_WINNER" | "EXACT_GOALS";
    playerId?: string;
    outcome?: MatchWinnerOutcome;
    goalsTarget?: number;
    amount: number;
    odds: number;
    currentMinute: number;
    goalWindow: number;
    matchId: string;
  }) => Promise<unknown>;
  onChangeBet: (
    betId: string,
    newPlayerId: string | undefined,
    newOutcome: MatchWinnerOutcome | undefined,
    newOdds: number,
    minute: number,
  ) => Promise<unknown>;
  onClose: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50];

export const BetModal: React.FC<BetModalProps> = ({
  player,
  mwOutcome,
  mwOdds,
  egGoals,
  egOdds,
  currentMinute,
  goalWindow,
  matchId,
  balance,
  activeBet,
  onPlaceBet,
  onChangeBet,
  onClose,
}) => {
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNGS = !!player;
  const isEG = egGoals !== undefined;
  const odds = isNGS
    ? (player?.odds ?? 1)
    : isEG
      ? (egOdds ?? 1)
      : mwOdds
        ? mwOdds[mwOutcome!]
        : 1;
  const label = isNGS
    ? player!.name
    : isEG
      ? `Exact Goals: ${egGoals === 6 ? "6+" : egGoals}`
      : outcomeLabel(mwOutcome!);
  const payout = amount * odds;
  const maxBet = balance.wallet;

  // Is this a CHANGE operation (user already has an active bet on a different player)?
  const canChange = activeBet && activeBet.status === "active";

  const handleConfirm = useCallback(async () => {
    if (amount > maxBet) {
      setError(`Insufficient balance. Max: $${maxBet.toFixed(2)}`);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (canChange && activeBet) {
        // Route through change-bet (penalty will apply)
        const res = (await onChangeBet(
          activeBet.id,
          isNGS ? player!.id : undefined,
          !isNGS ? mwOutcome : undefined,
          odds,
          currentMinute,
        )) as { success: boolean; error?: string };
        if (!res.success) throw new Error(res.error ?? "Change failed");
      } else {
        const res = (await onPlaceBet({
          betType: isNGS
            ? "NEXT_GOAL_SCORER"
            : isEG
              ? "EXACT_GOALS"
              : "MATCH_WINNER",
          playerId: isNGS ? player!.id : undefined,
          outcome: !isNGS && !isEG ? mwOutcome : undefined,
          goalsTarget: isEG ? egGoals : undefined,
          amount,
          odds,
          currentMinute,
          goalWindow,
          matchId,
        })) as { success: boolean; error?: string };
        if (!res.success) throw new Error(res.error ?? "Bet failed");
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [
    amount,
    maxBet,
    canChange,
    activeBet,
    onChangeBet,
    onPlaceBet,
    isNGS,
    player,
    mwOutcome,
    odds,
    currentMinute,
    goalWindow,
    matchId,
    onClose,
  ]);

  return (
    <div className="gl-interactive fixed inset-0 z-[2147483645] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl w-80 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-gray-400 text-xs">
              {isNGS ? "Next Goal Scorer" : "Match Winner"} · {currentMinute}'
            </p>
            <h2 className="text-white font-black text-xl">{label}</h2>
            <p className="text-yellow-300 font-bold text-lg">
              {odds.toFixed(2)}× odds
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {canChange && (
          <div className="mb-3 bg-yellow-400/10 border border-yellow-400/30 rounded-lg px-3 py-2 text-yellow-300 text-xs">
            ⚠️ Changing an active bet will apply a penalty. See penalty
            breakdown below.
          </div>
        )}

        {/* Amount input */}
        <div className="mb-3">
          <label className="text-gray-400 text-xs mb-1 block">
            Bet amount (USDC)
          </label>
          <div className="flex items-center gap-2 bg-black/50 rounded-lg border border-white/10 px-3 py-2">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              min={1}
              max={maxBet}
              step={1}
              value={amount}
              onChange={(e) =>
                setAmount(Math.max(1, Math.min(maxBet, Number(e.target.value))))
              }
              className="flex-1 bg-transparent text-white font-bold outline-none text-sm"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {PRESET_AMOUNTS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(Math.min(p, maxBet))}
                className="flex-1 text-xs bg-gray-800 hover:bg-gray-700 rounded px-1 py-1 text-gray-300 transition-colors"
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        {/* Payout preview */}
        <div className="bg-black/40 rounded-lg px-3 py-2 mb-4 flex justify-between items-center">
          <span className="text-gray-400 text-xs">Potential payout</span>
          <span className="text-emerald-400 font-bold text-sm">
            ${payout.toFixed(2)}
          </span>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl py-3 text-gray-300 font-semibold text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || amount <= 0 || amount > maxBet}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 rounded-xl py-3 text-white font-bold text-sm transition-colors"
          >
            {loading ? "…" : canChange ? "Change Bet" : "Place Bet"}
          </button>
        </div>
      </div>
    </div>
  );
};

function outcomeLabel(outcome: MatchWinnerOutcome): string {
  if (outcome === "home") return "Home Win";
  if (outcome === "away") return "Away Win";
  return "Draw";
}
