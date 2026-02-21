import React, { useState, useMemo } from "react";
import type { Bet, Player, PenaltyPreview } from "../types";
import { calcPenalty, formatPenaltyPct } from "../utils/penaltyCalculator";

interface BetChangeModalProps {
  bet: Bet;
  players: Player[];
  currentMinute: number;
  /** Pre-select a player when opening (e.g. tapped directly from overlay) */
  initialSelectedId?: string;
  onConfirm: (newPlayerId: string, newOdds: number) => Promise<void>;
  onClose: () => void;
}

export const BetChangeModal: React.FC<BetChangeModalProps> = ({
  bet,
  players,
  currentMinute,
  initialSelectedId,
  onConfirm,
  onClose,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPlayer = players.find((p) => p.id === selectedId);

  const preview: PenaltyPreview = useMemo(
    () => calcPenalty(bet.current_amount, bet.change_count + 1, currentMinute),
    [bet.current_amount, bet.change_count, currentMinute],
  );

  const potentialPayout = selectedPlayer
    ? preview.newEffectiveAmount * selectedPlayer.odds
    : 0;

  const handleConfirm = async () => {
    if (!selectedPlayer) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(selectedPlayer.id, selectedPlayer.odds);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change bet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gl-interactive fixed inset-0 z-[2147483645] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative bg-gray-900 border border-white/10 rounded-2xl w-96 p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white font-black text-lg">Change Bet</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Current bet summary */}
        <div className="bg-black/40 rounded-xl px-4 py-3 mb-4 border border-white/5">
          <p className="text-gray-400 text-xs mb-1">Current bet</p>
          <div className="flex justify-between">
            <span className="text-white font-bold text-sm">
              {players.find((p) => p.id === bet.current_player_id)?.name ??
                bet.current_player_id}
            </span>
            <span className="text-yellow-300 font-bold text-sm">
              ${bet.current_amount.toFixed(2)}
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            Change #{bet.change_count + 1} · {currentMinute}' ·{" "}
            {bet.odds.toFixed(2)}× odds
          </p>
        </div>

        {/* Penalty breakdown */}
        <div className="bg-red-950/40 border border-red-500/20 rounded-xl px-4 py-3 mb-4">
          <p className="text-red-400 text-xs font-semibold mb-2">
            Penalty (change #{preview.changeNumber})
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Base rate</span>
              <span className="text-white">
                {preview.changeNumber === 1
                  ? "3%"
                  : preview.changeNumber === 2
                    ? "5%"
                    : preview.changeNumber === 3
                      ? "8%"
                      : preview.changeNumber === 4
                        ? "12%"
                        : "15%"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">
                Time decay (1 − {currentMinute}/90)
              </span>
              <span className="text-white">
                ×{(1 - currentMinute / 90).toFixed(3)}
              </span>
            </div>
            <div className="flex justify-between border-t border-white/5 pt-1 mt-1">
              <span className="text-red-400 font-semibold">Penalty</span>
              <span className="text-red-400 font-semibold">
                {formatPenaltyPct(preview.penaltyPct)} = −$
                {preview.penaltyAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">New effective amount</span>
              <span className="text-yellow-300 font-bold">
                ${preview.newEffectiveAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Player picker */}
        <p className="text-gray-400 text-xs mb-2">Select new player</p>
        <div className="grid grid-cols-2 gap-2 mb-4 max-h-52 overflow-y-auto pr-1">
          {players
            .filter((p) => p.id !== bet.current_player_id)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all
                  ${
                    selectedId === p.id
                      ? "border-emerald-500 bg-emerald-950/50 text-white"
                      : "border-white/10 bg-gray-800/50 text-gray-300 hover:border-white/30"
                  }`}
              >
                <span className="font-bold text-xs">{p.name}</span>
                <span className="text-yellow-300 text-[11px]">
                  {p.odds.toFixed(2)}×
                </span>
              </button>
            ))}
        </div>

        {/* Payout preview */}
        {selectedPlayer && (
          <div className="bg-black/40 rounded-lg px-3 py-2 mb-4 flex justify-between">
            <span className="text-gray-400 text-xs">
              Potential payout with {selectedPlayer.name}
            </span>
            <span className="text-emerald-400 font-bold text-sm">
              ${potentialPayout.toFixed(2)}
            </span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-800 hover:bg-gray-700 rounded-xl py-3 text-gray-300 font-semibold text-sm"
          >
            Keep Bet
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedPlayer || loading}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 rounded-xl py-3 text-black font-bold text-sm transition-colors"
          >
            {loading ? "…" : "Confirm Change"}
          </button>
        </div>
      </div>
    </div>
  );
};
