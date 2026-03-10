import React from "react";
import type { Bet, Match, BalanceState, Player } from "../types";

interface SettlementDisplayProps {
  match: Match;
  bets: Bet[];
  balance: BalanceState;
  players: Player[];
  onSwitchEvent: () => void;
  onOpenClaim: () => void;
  walletConnected: boolean;
  estimatedClaimAmount: number;
  claimableAmount: number;
  balancesSettled: boolean;
  withdrawn: boolean;
}

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

export const SettlementDisplay: React.FC<SettlementDisplayProps> = ({
  match,
  bets,
  balance,
  players,
  onSwitchEvent,
  onOpenClaim,
  walletConnected,
  estimatedClaimAmount,
  claimableAmount,
  balancesSettled,
  withdrawn,
}) => {
  const won = bets.filter((b) => b.status === "settled_won");
  const lost = bets.filter((b) => b.status === "settled_lost");
  const totalWon = won.reduce((s, b) => s + b.current_amount * b.odds, 0);
  const totalLost = lost.reduce((s, b) => s + b.current_amount, 0);
  const netPnl = totalWon - totalLost;

  return (
    <div className="gl-interactive w-full bg-black/95 border-t border-white/10 px-4 py-4">
      {/* Title */}
      <div className="text-center mb-4">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">
          Full Time
        </p>
        <h2 className="text-white font-black text-2xl">
          {match.homeTeam} {match.score.home} – {match.score.away}{" "}
          {match.awayTeam}
        </h2>
      </div>

      {/* P&L summary */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-emerald-950/50 border border-emerald-500/20 rounded-xl px-3 py-2 text-center">
          <p className="text-gray-400 text-[10px]">Won</p>
          <p className="text-emerald-400 font-black text-lg">
            ${totalWon.toFixed(2)}
          </p>
          <p className="text-gray-500 text-[10px]">
            {won.length} bet{won.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex-1 bg-red-950/30 border border-red-500/20 rounded-xl px-3 py-2 text-center">
          <p className="text-gray-400 text-[10px]">Lost</p>
          <p className="text-red-400 font-black text-lg">
            ${totalLost.toFixed(2)}
          </p>
          <p className="text-gray-500 text-[10px]">
            {lost.length} bet{lost.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-center">
          <p className="text-gray-400 text-[10px]">Net P&L</p>
          <p
            className={`font-black text-lg ${netPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
          >
            {netPnl >= 0 ? "+" : ""}${netPnl.toFixed(2)}
          </p>
          <p className="text-yellow-300 text-[10px] font-semibold">
            Wallet: ${balance.wallet.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Bet breakdown */}
      {bets.length > 0 && (
        <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
          {bets.map((bet) => (
            <div
              key={bet.id}
              className="flex justify-between items-center text-xs px-2 py-1 rounded-lg bg-black/40"
            >
              <span className="text-gray-300">{playerName(bet, players)}</span>
              <span
                className={
                  bet.status === "settled_won"
                    ? "text-emerald-400 font-bold"
                    : "text-red-400"
                }
              >
                {bet.status === "settled_won"
                  ? `+$${(bet.current_amount * bet.odds).toFixed(2)}`
                  : `-$${bet.current_amount.toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Post-match claim summary */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/5 px-3 py-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-400">
          Post-match claim
        </p>

        {!walletConnected ? (
          <p className="mt-1 text-sm font-semibold text-white">
            Connect wallet to view your possible payout
          </p>
        ) : withdrawn ? (
          <p className="mt-1 text-sm font-semibold text-gray-300">
            Already claimed
          </p>
        ) : balancesSettled ? (
          claimableAmount > 0 ? (
            <>
              <p className="mt-1 text-sm font-semibold text-emerald-300">
                Ready to claim
              </p>
              <p className="text-2xl font-black text-white">
                ${claimableAmount.toFixed(2)}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold text-gray-300">
              No funds left to claim
            </p>
          )
        ) : (
          <>
            <p className="mt-1 text-sm font-semibold text-sky-300">
              Possible winnings
            </p>
            <p className="text-2xl font-black text-white">
              ${estimatedClaimAmount.toFixed(2)}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              Claim becomes available after official goal.live settlement.
            </p>
          </>
        )}

        <button
          onClick={onOpenClaim}
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 transition-colors"
        >
          {!walletConnected
            ? "Connect Wallet"
            : balancesSettled && !withdrawn && claimableAmount > 0
              ? "Claim Winnings"
              : "View Claim Status"}
        </button>
      </div>

      {/* Buttons */}
      <div>
        <button
          onClick={onSwitchEvent}
          className="gl-interactive"
          style={{
            width: "100%",
            background: "#10b981",
            border: "none",
            borderRadius: "12px",
            padding: "12px",
            color: "#000",
            fontWeight: 900,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          ⚽ Switch Event
        </button>
      </div>
    </div>
  );
};
