import React from "react";
import type { Bet, Player } from "../types";

interface MyBetsProps {
  bets: Bet[];
  players: Player[];
  currentMinute: number;
  onChangeBet: (bet: Bet) => void;
}

const STATUS_COLOR: Record<Bet["status"], string> = {
  active: "text-blue-300",
  provisional_win: "text-emerald-400 animate-pulse",
  provisional_loss: "text-red-400",
  settled_won: "text-emerald-300",
  settled_lost: "text-gray-500",
  void: "text-yellow-400",
};

const STATUS_LABEL: Record<Bet["status"], string> = {
  active: "ACTIVE",
  provisional_win: "⚽ WIN (PENDING)",
  provisional_loss: "✗ LOST",
  settled_won: "✅ WON",
  settled_lost: "SETTLED LOST",
  void: "↺ VOIDED",
};

function playerName(bet: Bet, players: Player[]): string {
  if (bet.betType === "MATCH_WINNER") {
    const labels = { home: "Home Win", away: "Away Win", draw: "Draw" };
    return labels[bet.outcome ?? "draw"];
  }
  return (
    players.find((p) => p.id === bet.current_player_id)?.name ??
    bet.current_player_id
  );
}

export const MyBets: React.FC<MyBetsProps> = ({
  bets,
  players,
  currentMinute,
  onChangeBet,
}) => {
  if (bets.length === 0) {
    return (
      <div className="gl-interactive text-gray-500 text-xs text-center py-2">
        No bets placed yet
      </div>
    );
  }

  return (
    <div className="gl-interactive flex flex-col gap-1.5">
      {bets.map((bet) => {
        const name = playerName(bet, players);
        const payout = bet.current_amount * bet.odds;
        const canChange = bet.status === "active";

        return (
          <div
            key={bet.id}
            className={`bg-black/60 rounded-xl px-3 py-2 border flex items-center justify-between gap-2
              ${
                bet.status === "provisional_win"
                  ? "border-emerald-500/40"
                  : bet.status === "settled_won"
                    ? "border-emerald-500/30"
                    : bet.status === "active"
                      ? "border-blue-500/30"
                      : "border-white/5"
              }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-xs truncate">
                  {name}
                </span>
                <span className="text-gray-500 text-[10px]">
                  {bet.betType === "NEXT_GOAL_SCORER" ? "NGS" : "MW"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-gray-400 text-[10px]">
                  ${bet.current_amount.toFixed(2)} @ {bet.odds.toFixed(2)}× → $
                  {payout.toFixed(2)}
                </span>
                {bet.change_count > 0 && (
                  <span className="text-yellow-500/70 text-[10px]">
                    {bet.change_count} change{bet.change_count > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold ${STATUS_COLOR[bet.status]}`}
              >
                {STATUS_LABEL[bet.status]}
              </span>
            </div>

            {canChange && (
              <button
                onClick={() => onChangeBet(bet)}
                className="shrink-0 text-[10px] bg-yellow-500/20 hover:bg-yellow-500/40 border border-yellow-500/40 text-yellow-400 rounded-lg px-2 py-1 font-semibold transition-colors"
              >
                Change
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};
