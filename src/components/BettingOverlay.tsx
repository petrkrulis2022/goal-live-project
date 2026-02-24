import React, { useState, useCallback, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";
import { useMatchData } from "../hooks/useMatchData";
import { useBetting } from "../hooks/useBetting";
import { MatchInfo } from "./MatchInfo";
import { BalanceDisplay } from "./BalanceDisplay";
import { PlayerButton } from "./PlayerButton";
import { BetModal } from "./BetModal";
import { BetChangeModal } from "./BetChangeModal";
import { SettlementDisplay } from "./SettlementDisplay";
import { TopUpModal } from "./TopUpModal";
import { WithdrawModal } from "./WithdrawModal";
import type { Player, Bet } from "../types";
import type { MatchWinnerOutcome } from "../types";
import { tryUnmuteVideo } from "../utils/videoUtils";

type ModalState =
  | { type: "player"; player: Player }
  | { type: "mw"; outcome: MatchWinnerOutcome }
  | { type: "change"; bet: Bet; toPlayer?: Player }
  | { type: "topup" }
  | { type: "withdraw" }
  | null;

const MW_OUTCOMES: Array<{ outcome: MatchWinnerOutcome; label: string }> = [
  { outcome: "home", label: "Home" },
  { outcome: "draw", label: "Draw" },
  { outcome: "away", label: "Away" },
];

export const BettingOverlay: React.FC = () => {
  const { wallet, connect, topUp, withdraw, setPlayerAddress, refreshBalance } =
    useWallet();
  const {
    match,
    players,
    mwOdds,
    loading,
    startSimulation,
    resetSimulation,
    currentGoalWindow,
  } = useMatchData();
  const { bets, balance, placeBet, changeBet, refresh } = useBetting(
    wallet?.address ?? null,
  );

  const [modal, setModal] = useState<ModalState>(null);
  const [sidesSwapped, setSidesSwapped] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    tryUnmuteVideo();
  }, []);
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("gl:balanceRefresh", h);
    return () => window.removeEventListener("gl:balanceRefresh", h);
  }, [refresh]);

  const homePlayers = players.filter((p) => p.team === "home");
  const awayPlayers = players.filter((p) => p.team === "away");
  const leftPlayers = sidesSwapped ? homePlayers : awayPlayers;
  const rightPlayers = sidesSwapped ? awayPlayers : homePlayers;
  const leftTeam = sidesSwapped ? match?.homeTeam : match?.awayTeam;
  const rightTeam = sidesSwapped ? match?.awayTeam : match?.homeTeam;

  const activeNgsBet: Bet | null =
    bets.find(
      (b) =>
        b.betType === "NEXT_GOAL_SCORER" &&
        (b.status === "active" || b.status === "provisional_win"),
    ) ?? null;

  const getMwBet = useCallback(
    (outcome: MatchWinnerOutcome) =>
      bets.find(
        (b) =>
          b.betType === "MATCH_WINNER" &&
          b.outcome === outcome &&
          b.status === "active",
      ) ?? null,
    [bets],
  );

  const handlePlayerClick = useCallback(
    (player: Player) => {
      if (!wallet) {
        connect();
        return;
      }
      if (!activeNgsBet) {
        setModal({ type: "player", player });
      } else if (activeNgsBet.current_player_id === player.id) {
        setModal({ type: "player", player });
      } else {
        setModal({ type: "change", bet: activeNgsBet, toPlayer: player });
      }
    },
    [wallet, connect, activeNgsBet],
  );

  const handleConfirmChange = useCallback(
    async (newPlayerId: string, newOdds: number) => {
      if (modal?.type !== "change") return;
      await changeBet(
        modal.bet.id,
        newPlayerId,
        undefined,
        newOdds,
        match?.currentMinute ?? 0,
      );
    },
    [modal, changeBet, match],
  );

  const currentBetPlayer = activeNgsBet
    ? (players.find((p) => p.id === activeNgsBet.current_player_id) ?? null)
    : null;

  const isFinished = match?.status === "finished";
  const isPreMatch = match?.status === "pre-match";

  if (loading) return null;

  // ── When hidden, show a tiny toggle tab only ──
  if (hidden) {
    return (
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2147483641,
          pointerEvents: "auto",
        }}
      >
        <button
          onClick={() => setHidden(false)}
          style={{
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderTop: "none",
            borderRadius: "0 0 6px 6px",
            color: "#10b981",
            fontSize: "10px",
            fontWeight: 700,
            padding: "2px 10px",
            cursor: "pointer",
            letterSpacing: "0.05em",
          }}
        >
          goal.live ▼
        </button>
      </div>
    );
  }

  const colWidth = "140px";
  const betBarHeight = "40px";

  return (
    <>
      {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 2147483641,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "3px 4px",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0) 100%)",
        }}
      >
        {/* Left controls + Start/Reset */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            pointerEvents: "auto",
          }}
        >
          <button
            onClick={() => setHidden(true)}
            className="gl-interactive"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "5px",
              color: "#9ca3af",
              fontSize: "13px",
              fontWeight: 700,
              padding: "4px 9px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
          <button
            onClick={() => setSidesSwapped((s) => !s)}
            className="gl-interactive"
            title="Swap team sides"
            style={{
              background: "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "5px",
              color: "#d1d5db",
              fontSize: "13px",
              fontWeight: 700,
              padding: "4px 9px",
              cursor: "pointer",
            }}
          >
            ⇄
          </button>
          {!isFinished && isPreMatch && (
            <button
              onClick={startSimulation}
              className="gl-interactive"
              style={{
                background: "#10b981",
                border: "none",
                borderRadius: "5px",
                color: "#000",
                fontWeight: 800,
                fontSize: "13px",
                padding: "4px 14px",
                cursor: "pointer",
              }}
            >
              ▶ Start
            </button>
          )}
          {!isPreMatch && !isFinished && (
            <button
              onClick={resetSimulation}
              className="gl-interactive"
              style={{
                background: "rgba(55,65,81,0.8)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "5px",
                color: "#fff",
                fontWeight: 700,
                fontSize: "13px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              ↺
            </button>
          )}
        </div>

        {/* Centre: match + MW odds + current NGS bet — all one line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            pointerEvents: "auto",
          }}
        >
          {/* match scoreboard */}
          <MatchInfo match={match} />

          {/* MW buttons */}
          {!isFinished &&
            MW_OUTCOMES.map(({ outcome, label }) => {
              const mwBet = getMwBet(outcome);
              return (
                <button
                  key={outcome}
                  onClick={() =>
                    wallet ? setModal({ type: "mw", outcome }) : connect()
                  }
                  className="gl-interactive"
                  style={{
                    background: mwBet ? "rgba(6,78,59,0.7)" : "rgba(0,0,0,0.6)",
                    border: `1px solid ${mwBet ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.12)"}`,
                    borderRadius: "4px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "2px 5px",
                  }}
                >
                  <span
                    style={{
                      color: "#9ca3af",
                      fontSize: "8px",
                      fontWeight: 600,
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      color: "#fde047",
                      fontSize: "10px",
                      fontWeight: 700,
                    }}
                  >
                    {mwOdds[outcome].toFixed(2)}×
                  </span>
                </button>
              );
            })}

          {/* Current NGS bet chip */}
          {activeNgsBet && currentBetPlayer && (
            <button
              onClick={() => setModal({ type: "change", bet: activeNgsBet })}
              className="gl-interactive"
              style={{
                background: "rgba(6,78,59,0.75)",
                border: "1px solid rgba(52,211,153,0.5)",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
              }}
            >
              <span
                style={{ color: "#d1fae5", fontSize: "10px", fontWeight: 700 }}
              >
                {currentBetPlayer.name.split(" ")[0]}
              </span>
              <span style={{ color: "#6ee7b7", fontSize: "9px" }}>
                ${activeNgsBet.current_amount.toFixed(0)} @{" "}
                {currentBetPlayer.odds.toFixed(2)}×
              </span>
              <span
                style={{ color: "#fde047", fontSize: "9px", fontWeight: 600 }}
              >
                → change
              </span>
            </button>
          )}
        </div>

        {/* Right: balance only — one clean line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            pointerEvents: "auto",
          }}
        >
          <BalanceDisplay
            balance={balance}
            walletAddress={wallet?.address ?? null}
            onConnect={connect}
            onTopUp={wallet ? () => setModal({ type: "topup" }) : undefined}
            onWithdraw={
              wallet ? () => setModal({ type: "withdraw" }) : undefined
            }
          />
        </div>
      </div>

      {/* ── LEFT COLUMN ─────────────────────────────────────────────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: "32px",
          left: 0,
          bottom: betBarHeight,
          width: colWidth,
          zIndex: 2147483640,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          padding: "4px 3px",
          background:
            "linear-gradient(to right, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
        }}
      >
        <p
          style={{
            color: "#6b7280",
            fontSize: "8px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: "3px",
          }}
        >
          {leftTeam}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            flex: 1,
          }}
        >
          {leftPlayers.map((p) => {
            const settled = bets.find(
              (b) =>
                b.betType === "NEXT_GOAL_SCORER" &&
                b.current_player_id === p.id &&
                (b.status === "settled_won" || b.status === "settled_lost"),
            );
            return (
              <PlayerButton
                key={p.id}
                player={p}
                isCurrentBet={activeNgsBet?.current_player_id === p.id}
                isSettled={!!settled}
                settledWon={settled?.status === "settled_won"}
                onClick={handlePlayerClick}
                disabled={isFinished}
                alignRight={false}
              />
            );
          })}
        </div>
      </div>

      {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: "32px",
          right: 0,
          bottom: betBarHeight,
          width: colWidth,
          zIndex: 2147483640,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          padding: "4px 3px",
          background:
            "linear-gradient(to left, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 100%)",
        }}
      >
        <p
          style={{
            color: "#6b7280",
            fontSize: "8px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textAlign: "center",
            marginBottom: "3px",
          }}
        >
          {rightTeam}
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            flex: 1,
          }}
        >
          {rightPlayers.map((p) => {
            const settled = bets.find(
              (b) =>
                b.betType === "NEXT_GOAL_SCORER" &&
                b.current_player_id === p.id &&
                (b.status === "settled_won" || b.status === "settled_lost"),
            );
            return (
              <PlayerButton
                key={p.id}
                player={p}
                isCurrentBet={activeNgsBet?.current_player_id === p.id}
                isSettled={!!settled}
                settledWon={settled?.status === "settled_won"}
                onClick={handlePlayerClick}
                disabled={isFinished}
                alignRight={true}
              />
            );
          })}
        </div>
      </div>

      {/* ── BOTTOM BET STATUS BAR ────────────────────────────────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: betBarHeight,
          zIndex: 2147483641,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
          padding: "0 8px",
        }}
      >
        {activeNgsBet && currentBetPlayer ? (
          <button
            onClick={() => setModal({ type: "change", bet: activeNgsBet })}
            className="gl-interactive"
            style={{
              pointerEvents: "auto",
              background:
                "linear-gradient(180deg, #064e3b 0%, #065f46 50%, #022c22 100%)",
              border: "1px solid rgba(52,211,153,0.70)",
              borderBottom: "3px solid #011a14",
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "5px 16px",
              boxShadow:
                "0 4px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)",
            }}
          >
            <span
              style={{
                color: "#34d399",
                fontSize: "11px",
                fontWeight: 900,
                letterSpacing: "0.05em",
                textShadow: "0 0 10px rgba(52,211,153,0.7)",
              }}
            >
              ★ ACTIVE BET
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
              │
            </span>
            <span
              style={{ color: "#fef3c7", fontSize: "13px", fontWeight: 800 }}
            >
              #{currentBetPlayer.number} {currentBetPlayer.name.split(" ")[0]}
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
              │
            </span>
            <span
              style={{ color: "#6ee7b7", fontSize: "13px", fontWeight: 800 }}
            >
              {currentBetPlayer.odds.toFixed(2)}×
            </span>
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}>
              │
            </span>
            <span
              style={{ color: "#86efac", fontSize: "12px", fontWeight: 700 }}
            >
              ${activeNgsBet.current_amount.toFixed(0)} → $
              {(activeNgsBet.current_amount * currentBetPlayer.odds).toFixed(0)}
            </span>
            <span
              style={{
                color: "#34d399",
                fontSize: "10px",
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              tap to change
            </span>
          </button>
        ) : (
          <span
            style={{
              color: "rgba(255,255,255,0.25)",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.05em",
            }}
          >
            tap a player to place a next goal scorer bet
          </span>
        )}
      </div>

      {/* ── SETTLEMENT overlay ──────────────────────────────────────────── */}
      {isFinished && (
        <div
          className="gl-interactive"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483642,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <SettlementDisplay
            match={match!}
            bets={bets}
            balance={balance}
            players={players}
            onReset={resetSimulation}
          />
        </div>
      )}

      {/* ── MODALS ──────────────────────────────────────────────────────── */}
      {modal?.type === "player" && (
        <BetModal
          player={modal.player}
          currentMinute={match?.currentMinute ?? 0}
          goalWindow={currentGoalWindow}
          matchId={match?.id ?? ""}
          balance={balance}
          activeBet={
            activeNgsBet?.current_player_id === modal.player.id
              ? activeNgsBet
              : null
          }
          onPlaceBet={placeBet}
          onChangeBet={changeBet}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "mw" && (
        <BetModal
          mwOutcome={modal.outcome}
          mwOdds={mwOdds}
          currentMinute={match?.currentMinute ?? 0}
          goalWindow={currentGoalWindow}
          matchId={match?.id ?? ""}
          balance={balance}
          activeBet={getMwBet(modal.outcome)}
          onPlaceBet={placeBet}
          onChangeBet={changeBet}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "change" && (
        <BetChangeModal
          bet={modal.bet}
          players={players}
          currentMinute={match?.currentMinute ?? 0}
          initialSelectedId={modal.toPlayer?.id}
          onConfirm={handleConfirmChange}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "topup" && wallet && (
        <TopUpModal
          depositAddress={wallet.address}
          currentBalance={wallet.inAppBalance}
          onRefresh={refreshBalance}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "withdraw" && wallet && (
        <WithdrawModal
          inAppBalance={wallet.inAppBalance}
          lockedAmount={balance.locked}
          walletAddress={wallet.address}
          playerAddress={wallet.playerAddress}
          onWithdraw={withdraw}
          onSavePlayerAddress={setPlayerAddress}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
};
