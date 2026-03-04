import React, { useState, useCallback, useEffect } from "react";
import { useWallet } from "../hooks/useWallet";

const SB_URL = "https://weryswulejhjkrmervnf.supabase.co";
const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlcnlzd3VsZWpoamtybWVydm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjEyODEsImV4cCI6MjA4NzU5NzI4MX0.fxMn2LMdoFuYAln-34WUo1uUiWjSnlSzJlDS-sepdtc";

interface MatchRow {
  external_match_id: string;
  home_team: string;
  away_team: string;
  status: string;
  score_home: number;
  score_away: number;
  kickoff_at: string;
}

const LOGO_URL =
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("goal-live-logo.png")
    : "";
const AD_CUBEPAY_URL =
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("ad-cubepay.png")
    : "";
const AD_VIBE_URL =
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("ad-vibe.png")
    : "";
import { useMatchData } from "../hooks/useMatchData";
import { useBetting } from "../hooks/useBetting";
import { usePoolBalance } from "../hooks/usePoolBalance";
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
  | { type: "eg"; goals: number }
  | { type: "change"; bet: Bet; toPlayer?: Player }
  | { type: "topup" }
  | { type: "withdraw" }
  | null;

const MW_OUTCOMES: Array<{ outcome: MatchWinnerOutcome; label: string }> = [
  { outcome: "home", label: "Home" },
  { outcome: "draw", label: "Draw" },
  { outcome: "away", label: "Away" },
];

/** Exact Goals — total goals targets with fixed odds (last entry = 5+ means ≥5) */
const EG_TARGETS = [
  { goals: 0, label: "0", odds: 12.0 },
  { goals: 1, label: "1", odds: 7.5 },
  { goals: 2, label: "2", odds: 4.5 },
  { goals: 3, label: "3", odds: 5.5 },
  { goals: 4, label: "4", odds: 9.0 },
  { goals: 5, label: "5+", odds: 15.0 },
] as const;

export const BettingOverlay: React.FC<{ matchKey?: string }> = ({
  matchKey,
}) => {
  const { wallet, connect, topUp, withdraw, setPlayerAddress, refreshBalance } =
    useWallet();
  const { match, players, mwOdds, loading, currentGoalWindow } =
    useMatchData(matchKey);
  const { bets, balance, placeBet, changeBet, refresh } = useBetting(
    wallet?.address ?? null,
    match?.dbId, // Supabase UUID — filters bets/balance to current match only
  );
  const poolBalance = usePoolBalance(match?.contractAddress, matchKey ?? null);

  const [modal, setModal] = useState<ModalState>(null);
  const [hidden, setHidden] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMatches, setPickerMatches] = useState<MatchRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  useEffect(() => {
    if (!showPicker) return;
    setPickerLoading(true);
    fetch(
      `${SB_URL}/rest/v1/matches?select=external_match_id,home_team,away_team,status,score_home,score_away,kickoff_at&order=kickoff_at.desc&limit=20`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } },
    )
      .then((r) => r.json())
      .then((rows) => setPickerMatches(rows as MatchRow[]))
      .catch(() => {})
      .finally(() => setPickerLoading(false));
  }, [showPicker]);

  function switchMatch(id: string) {
    setShowPicker(false);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ matchKey: id });
    }
  }

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
  // Active lineup = starters (is_starter=true). Falls back to all players if no is_starter data.
  const hasStarterData = players.some((p) => p.isStarter);
  const homeLineup = hasStarterData
    ? homePlayers.filter((p) => p.isStarter)
    : homePlayers;
  const awayLineup = hasStarterData
    ? awayPlayers.filter((p) => p.isStarter)
    : awayPlayers;

  // Manual panel flip — persisted per match in localStorage.
  const [panelFlipped, setPanelFlipped] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`gl_panel_flip_${matchKey}`) === "1";
    } catch {
      return false;
    }
  });

  // Reload preference when switching between matches.
  useEffect(() => {
    try {
      setPanelFlipped(
        localStorage.getItem(`gl_panel_flip_${matchKey}`) === "1",
      );
    } catch {
      /* ignore */
    }
  }, [matchKey]);

  // Persist preference.
  useEffect(() => {
    try {
      if (panelFlipped) localStorage.setItem(`gl_panel_flip_${matchKey}`, "1");
      else localStorage.removeItem(`gl_panel_flip_${matchKey}`);
    } catch {
      /* ignore */
    }
  }, [panelFlipped, matchKey]);

  const leftLineup = panelFlipped ? awayLineup : homeLineup;
  const rightLineup = panelFlipped ? homeLineup : awayLineup;
  const leftTeamName = panelFlipped ? match?.awayTeam : match?.homeTeam;
  const rightTeamName = panelFlipped ? match?.homeTeam : match?.awayTeam;
  const leftLabelColor = panelFlipped ? "#fca5a5" : "#93c5fd";
  const rightLabelColor = panelFlipped ? "#93c5fd" : "#fca5a5";

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

  // Any active MW bet regardless of outcome — used so switching Home→Away
  // routes through changeBet (with penalty) instead of placing a second bet.
  const activeMwBet =
    bets.find((b) => b.betType === "MATCH_WINNER" && b.status === "active") ??
    null;

  const getEgBet = useCallback(
    (goals: number) =>
      bets.find(
        (b) =>
          b.betType === "EXACT_GOALS" &&
          b.goalsTarget === goals &&
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
    async (newPlayerId: string, newOdds: number, newAmount: number) => {
      if (modal?.type !== "change") return;
      await changeBet(
        modal.bet.id,
        newPlayerId,
        undefined,
        newOdds,
        match?.currentMinute ?? 0,
        newAmount,
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
          zIndex: 2147483643,
          pointerEvents: "none",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
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
            justifyContent: "flex-start",
            position: "relative",
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
            onClick={() => setShowPicker((v) => !v)}
            className="gl-interactive"
            style={{
              background: showPicker ? "#10b981" : "rgba(0,0,0,0.6)",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: "5px",
              color: showPicker ? "#000" : "#fff",
              fontSize: "11px",
              fontWeight: 700,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            ⚽ Events
          </button>

          {/* Panel swap button */}
          <button
            onClick={() => setPanelFlipped((v) => !v)}
            className="gl-interactive"
            title={
              panelFlipped
                ? "Panels flipped — click to restore"
                : "Swap left/right team panels"
            }
            style={{
              background: panelFlipped
                ? "rgba(251,191,36,0.2)"
                : "rgba(0,0,0,0.6)",
              border: `1px solid ${
                panelFlipped ? "rgba(251,191,36,0.5)" : "rgba(255,255,255,0.18)"
              }`,
              borderRadius: "5px",
              color: panelFlipped ? "#fbbf24" : "#9ca3af",
              fontSize: "13px",
              fontWeight: 700,
              padding: "4px 9px",
              cursor: "pointer",
            }}
          >
            ⇆
          </button>

          {showPicker && (
            <div
              className="gl-interactive"
              style={{
                position: "absolute",
                top: "34px",
                left: "4px",
                background: "#111827",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "8px",
                minWidth: "260px",
                zIndex: 2147483644,
                overflow: "hidden",
                boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "11px",
                  color: "#6b7280",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                }}
              >
                SELECT EVENT
              </div>
              {pickerLoading ? (
                <div
                  style={{
                    padding: "12px",
                    color: "#6b7280",
                    fontSize: "12px",
                  }}
                >
                  Loading…
                </div>
              ) : pickerMatches.length === 0 ? (
                <div
                  style={{
                    padding: "12px",
                    color: "#6b7280",
                    fontSize: "12px",
                  }}
                >
                  No events found
                </div>
              ) : (
                pickerMatches.map((m) => {
                  const isActive = m.external_match_id === matchKey;
                  const score =
                    m.status === "pre-match"
                      ? new Date(m.kickoff_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : m.status === "finished"
                        ? `FT ${m.score_home}–${m.score_away}`
                        : `${m.score_home}–${m.score_away}`;
                  const statusDot =
                    m.status === "live" || m.status === "halftime" ? (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: "#10b981",
                          display: "inline-block",
                          marginRight: 5,
                        }}
                      />
                    ) : null;
                  return (
                    <div
                      key={m.external_match_id}
                      onClick={() => switchMatch(m.external_match_id)}
                      style={{
                        padding: "9px 12px",
                        cursor: "pointer",
                        background: isActive
                          ? "rgba(16,185,129,0.15)"
                          : "transparent",
                        borderLeft: isActive
                          ? "3px solid #10b981"
                          : "3px solid transparent",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span
                        style={{
                          color: "#f3f4f6",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        {statusDot}
                        {m.home_team} vs {m.away_team}
                      </span>
                      <span
                        style={{
                          color: "#9ca3af",
                          fontSize: "11px",
                          marginLeft: 8,
                        }}
                      >
                        {score}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Ad button 1: CubePay — 3D, rectangular, pushed toward centre */}
          {AD_CUBEPAY_URL && (
            <button
              className="gl-interactive"
              onClick={() =>
                window.open("https://vision-pay.netlify.app/", "_blank")
              }
              title="CubePay — powered by goal.live"
              style={{
                background:
                  "linear-gradient(180deg, #1a2e1a 0%, #0f1f0f 60%, #071207 100%)",
                border: "1px solid rgba(52,211,153,0.55)",
                borderBottom: "3px solid #021005",
                borderRadius: "7px",
                boxShadow:
                  "0 4px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
                padding: "3px 8px 3px 4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                flexShrink: 0,
              }}
            >
              <img
                src={AD_CUBEPAY_URL}
                alt="CubePay"
                style={{
                  height: "28px",
                  width: "28px",
                  borderRadius: "4px",
                  display: "block",
                  objectFit: "cover",
                }}
              />
              <span
                style={{
                  color: "#34d399",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                Visit
              </span>
            </button>
          )}
        </div>

        {/* Centre column: always truly centred by CSS grid */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            pointerEvents: "auto",
          }}
        >
          {/* Logo — same height as score box, left of it */}
          {LOGO_URL && (
            <img
              src={LOGO_URL}
              alt="goal.live"
              style={{
                height: "52px",
                width: "auto",
                display: "block",
                borderRadius: "8px",
                flexShrink: 0,
              }}
            />
          )}

          {/* match scoreboard */}
          <MatchInfo match={match} />

          {/* Pool balance chip */}
          {poolBalance !== null && (
            <div
              className="gl-interactive"
              style={{
                background: "rgba(0,0,0,0.55)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "5px",
                padding: "3px 8px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: "10px" }}>🏦</span>
              <span
                style={{
                  color: "#6b7280",
                  fontSize: "9px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Pool
              </span>
              <span
                style={{ color: "#d1fae5", fontSize: "12px", fontWeight: 700 }}
              >
                ${poolBalance.toFixed(2)}
              </span>
            </div>
          )}

          {/* MW bet buttons — Home / Draw / Away */}
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
                    border: `1px solid ${
                      mwBet ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.12)"
                    }`,
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

          {/* Extra Bets — right of Away */}
          {!isFinished && (
            <button
              className="gl-interactive"
              onClick={() => {}}
              title="Extra bets — corners, cards, goals (coming soon)"
              style={{
                background: "rgba(109,40,217,0.30)",
                border: "1px solid rgba(167,139,250,0.5)",
                borderRadius: "6px",
                color: "#a78bfa",
                fontSize: "11px",
                fontWeight: 700,
                padding: "4px 10px",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Extra Bets
            </button>
          )}
        </div>

        {/* Right: balance */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "4px",
            pointerEvents: "auto",
          }}
        >
          {/* Ad button 2: Vibe.live — 3D, pushed toward centre */}
          {AD_VIBE_URL && (
            <button
              className="gl-interactive"
              onClick={() =>
                window.open("https://cube-pay-web.netlify.app/", "_blank")
              }
              title="Vibe.live — powered by goal.live"
              style={{
                background:
                  "linear-gradient(180deg, #1e1030 0%, #120a22 60%, #080412 100%)",
                border: "1px solid rgba(167,139,250,0.55)",
                borderBottom: "3px solid #040108",
                borderRadius: "7px",
                boxShadow:
                  "0 4px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)",
                padding: "3px 4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <img
                src={AD_VIBE_URL}
                alt="Vibe.live"
                style={{
                  height: "30px",
                  width: "auto",
                  borderRadius: "4px",
                  display: "block",
                }}
              />
            </button>
          )}

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

      {/* ── EXACT GOALS BAR ─────────────────────────────────────────────── */}
      {!isFinished && (
        <div
          className="gl-interactive"
          style={{
            position: "fixed",
            top: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2147483644,
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px 5px",
            background: "rgba(0,0,0,0.82)",
            borderRadius: "0 0 8px 8px",
            border: "1px solid rgba(255,255,255,0.10)",
            borderTop: "none",
          }}
        >
          <span
            style={{
              color: "#6b7280",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.05em",
              marginRight: "2px",
              whiteSpace: "nowrap",
            }}
          >
            ⚽ GOALS:
          </span>
          {EG_TARGETS.map(({ goals, label, odds }) => {
            const egBet = getEgBet(goals);
            return (
              <button
                key={goals}
                onClick={() =>
                  wallet ? setModal({ type: "eg", goals }) : connect()
                }
                className="gl-interactive"
                style={{
                  pointerEvents: "auto",
                  background: egBet
                    ? "rgba(6,78,59,0.7)"
                    : "rgba(30,20,50,0.85)",
                  border: `1px solid ${egBet ? "rgba(52,211,153,0.5)" : "rgba(255,255,255,0.13)"}`,
                  borderRadius: "5px",
                  cursor: "pointer",
                  padding: "5px 9px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  minWidth: "34px",
                  minHeight: "36px",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    color: egBet ? "#34d399" : "#e5e7eb",
                    fontSize: "10px",
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  {label}
                </span>
                <span
                  style={{
                    color: "#fde047",
                    fontSize: "9px",
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {odds}×
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── LEFT PANEL (home in 1st half, away in 2nd half) ───────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: "52px",
          left: 0,
          bottom: betBarHeight,
          width: "164px",
          zIndex: 2147483640,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(to right, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0.0) 100%)",
        }}
      >
        {/* Team label */}
        <div
          style={{
            padding: "4px 6px 2px",
            flexShrink: 0,
            color: leftLabelColor,
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {leftTeamName ?? "Home"}
        </div>
        {/* Player list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            padding: "2px 4px 4px",
            pointerEvents: "none",
          }}
        >
          {leftLineup.map((p) => {
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

      {/* ── RIGHT PANEL (away in 1st half, home in 2nd half) ──────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: "52px",
          right: 0,
          bottom: betBarHeight,
          width: "164px",
          zIndex: 2147483640,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(to left, rgba(0,0,0,0.72) 60%, rgba(0,0,0,0.0) 100%)",
        }}
      >
        {/* Team label */}
        <div
          style={{
            padding: "4px 6px 2px",
            flexShrink: 0,
            color: rightLabelColor,
            fontSize: "8px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textAlign: "right",
          }}
        >
          {rightTeamName ?? "Away"}
        </div>
        {/* Player list */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            padding: "2px 4px 4px",
            pointerEvents: "none",
          }}
        >
          {rightLineup.map((p) => {
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
              #{currentBetPlayer.number}{" "}
              {currentBetPlayer.name.split(" ").slice(-1)[0]}
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
            onSwitchEvent={() => setShowPicker(true)}
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
          activeBet={activeNgsBet}
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
          activeBet={activeMwBet}
          onPlaceBet={placeBet}
          onChangeBet={changeBet}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "eg" && (
        <BetModal
          egGoals={modal.goals}
          egOdds={EG_TARGETS.find((t) => t.goals === modal.goals)?.odds}
          currentMinute={match?.currentMinute ?? 0}
          goalWindow={currentGoalWindow}
          matchId={match?.id ?? ""}
          balance={balance}
          activeBet={getEgBet(modal.goals)}
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
          availableBalance={balance.wallet}
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
          contractAddress={match?.contractAddress}
          matchLabel={
            match ? `${match.homeTeam} vs ${match.awayTeam}` : undefined
          }
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
