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
import { useMatchBalance } from "../hooks/useMatchBalance";
import { matchContractService } from "../services/matchContract";
import { MatchInfo } from "./MatchInfo";
import { BalanceDisplay } from "./BalanceDisplay";
import { PlayerButton } from "./PlayerButton";
import { BetModal } from "./BetModal";
import { BetChangeModal } from "./BetChangeModal";
import { SettlementDisplay } from "./SettlementDisplay";
import { TopUpModal } from "./TopUpModal";
import { WithdrawModal } from "./WithdrawModal";
import { FundMatchModal } from "./FundMatchModal";
import type { Player, Bet } from "../types";
import type { MatchWinnerOutcome } from "../types";
import { tryUnmuteVideo } from "../utils/videoUtils";

type ModalState =
  | { type: "player"; player: Player }
  | { type: "mw"; outcome: MatchWinnerOutcome }
  | { type: "eg"; goals: number }
  | { type: "change"; bet: Bet; toPlayer?: Player }
  | { type: "topup" }
  | { type: "fundmatch" }
  | { type: "withdraw" }
  | null;

const MW_OUTCOMES: Array<{ outcome: MatchWinnerOutcome; label: string }> = [
  { outcome: "home", label: "Home" },
  { outcome: "draw", label: "Draw" },
  { outcome: "away", label: "Away" },
];

/** Exact Goals — fallback odds used when live egOdds from The Odds API are not yet available */
const EG_TARGETS = [
  { goals: 0, label: "0", odds: 12.0 },
  { goals: 1, label: "1", odds: 7.5 },
  { goals: 2, label: "2", odds: 4.5 },
  { goals: 3, label: "3", odds: 5.5 },
  { goals: 4, label: "4", odds: 9.0 },
  { goals: 5, label: "5+", odds: 15.0 },
];

export const BettingOverlay: React.FC<{ matchKey?: string }> = ({
  matchKey,
}) => {
  const {
    wallet,
    connect,
    topUp,
    withdraw,
    setPlayerAddress,
    refreshBalance,
    deductBalance,
  } = useWallet();
  const { match, players, mwOdds, loading, currentGoalWindow } =
    useMatchData(matchKey);
  const { bets, balance, placeBet, changeBet, refresh } = useBetting(
    wallet?.address ?? null,
    match?.dbId, // Supabase UUID — filters bets/balance to current match only
  );
  const poolBalance = usePoolBalance(match?.contractAddress, matchKey ?? null);
  const matchBalanceInfo = useMatchBalance(
    match?.contractAddress,
    matchKey ?? null,
    wallet?.address ?? null,
  );

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
    const h = () => {
      refresh();
      refreshBalance();
    };
    window.addEventListener("gl:balanceRefresh", h);
    return () => window.removeEventListener("gl:balanceRefresh", h);
  }, [refresh, refreshBalance]);

  // ── In-game ad popup: CubePay 5s → gap 3s → Vibe 5s → wait → repeat ──
  const [adVisible, setAdVisible] = useState(false);
  const [adIndex, setAdIndex] = useState(0); // 0 = CubePay, 1 = Vibe.live
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const cycle = () => {
      // 1. Show CubePay
      setAdIndex(0);
      setAdVisible(true);
      timers.push(
        setTimeout(() => {
          // 2. Hide CubePay
          setAdVisible(false);
          timers.push(
            setTimeout(() => {
              // 3. Show Vibe
              setAdIndex(1);
              setAdVisible(true);
              timers.push(
                setTimeout(() => {
                  // 4. Hide Vibe
                  setAdVisible(false);
                }, 5_000),
              );
            }, 3_000),
          );
        }, 5_000),
      );
    };
    // First cycle after 3 s (immediate for testing)
    timers.push(setTimeout(cycle, 3_000));
    // Repeat every 60 s
    const iv = setInterval(cycle, 60_000);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, []);

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

  // Corner bet mock state — only one corner active at a time (no real bet logic)
  const [activeCorner, setActiveCorner] = useState<
    null | "A" | "B" | "C" | "D"
  >(null);

  const leftLineup = panelFlipped ? awayLineup : homeLineup;
  const rightLineup = panelFlipped ? homeLineup : awayLineup;
  const leftTeamName = panelFlipped ? match?.awayTeam : match?.homeTeam;
  const rightTeamName = panelFlipped ? match?.homeTeam : match?.awayTeam;
  const leftLabelColor = panelFlipped ? "#60a5fa" : "#4ade80";
  const rightLabelColor = panelFlipped ? "#4ade80" : "#60a5fa";

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

  const betBarHeight = "48px";

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
            paddingLeft: "164px",
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

          {/* Exact Goals buttons — top bar, between swap and logo */}
          {!isFinished && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2px",
                marginLeft: "6px",
              }}
            >
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap",
                  textTransform: "uppercase",
                  textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                }}
              >
                Exact Goals
              </span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "3px" }}
              >
                {(() => {
                  const totalGoals =
                    (match?.score.home ?? 0) + (match?.score.away ?? 0);
                  // Filter out goals counts that are already impossible (fewer than goals already scored).
                  // For 5+, it's only impossible if we already have ≥5 goals AND want exactly 5 (it becomes settled).
                  return EG_TARGETS.filter(({ goals }) => {
                    if (goals < 5) return goals >= totalGoals;
                    return true; // 5+ stays visible — could still be betting higher
                  }).map(({ goals, label, odds: fallbackOdds }) => {
                    // Use live odds from Odds API if available, else fall back to static values
                    const odds = mwOdds.egOdds?.[String(goals)] ?? fallbackOdds;
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
                          padding: "4px 8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          minWidth: "36px",
                        }}
                      >
                        <span
                          style={{
                            color: egBet ? "#34d399" : "#e5e7eb",
                            fontSize: "11px",
                            fontWeight: 700,
                            lineHeight: 1.2,
                          }}
                        >
                          {label}
                        </span>
                        <span
                          style={{
                            color: "#fde047",
                            fontSize: "10px",
                            fontWeight: 600,
                            lineHeight: 1.2,
                          }}
                        >
                          {odds}×
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          )}

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

          {/* match scoreboard + MW bets inside */}
          <MatchInfo
            match={match}
            mwOdds={mwOdds}
            getMwBet={(o) => !!getMwBet(o)}
            onMwBet={(o) =>
              wallet ? setModal({ type: "mw", outcome: o }) : connect()
            }
            isFinished={isFinished}
          />
        </div>

        {/* Right: pool + balance — two rows, pushed toward centre to free corner */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: "2px",
            pointerEvents: "auto",
            paddingRight: "164px",
          }}
        >
          <BalanceDisplay
            balance={balance}
            walletAddress={wallet?.address ?? null}
            poolBalance={poolBalance}
            matchBalanceInfo={matchBalanceInfo}
            onConnect={connect}
            onTopUp={wallet ? () => setModal({ type: "topup" }) : undefined}
            onFundMatch={
              wallet && match?.contractAddress
                ? () => setModal({ type: "fundmatch" })
                : undefined
            }
            onWithdraw={
              wallet ? () => setModal({ type: "withdraw" }) : undefined
            }
            onWithdrawMatch={
              wallet &&
              matchBalanceInfo?.balancesSettled &&
              !matchBalanceInfo.withdrawn &&
              matchBalanceInfo.balance > 0
                ? () => {
                    if (!match?.contractAddress || !matchKey) return;
                    matchContractService
                      .withdraw(match.contractAddress, matchKey)
                      .then(() =>
                        window.dispatchEvent(new Event("gl:balanceRefresh")),
                      )
                      .catch((e: unknown) =>
                        console.error("[withdraw match] failed", e),
                      );
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* ── LEFT PANEL (home in 1st half, away in 2nd half) ───────────── */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          top: "60px",
          left: 0,
          bottom: "60px",
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
            padding: "2px 6px 2px",
            flexShrink: 0,
            color: leftLabelColor,
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: `0 0 12px ${leftLabelColor}88, 0 1px 3px rgba(0,0,0,0.9)`,
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
          top: "60px",
          right: 0,
          bottom: "60px",
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
            padding: "2px 6px 2px",
            flexShrink: 0,
            color: rightLabelColor,
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textAlign: "right",
            textShadow: `0 0 12px ${rightLabelColor}88, 0 1px 3px rgba(0,0,0,0.9)`,
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
          gap: "6px",
        }}
      >
        {/* CENTER: NGS active bet — EG and MW are now in top bar / MatchInfo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
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
              <span
                style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}
              >
                │
              </span>
              <span
                style={{ color: "#fef3c7", fontSize: "13px", fontWeight: 800 }}
              >
                #{currentBetPlayer.number}{" "}
                {currentBetPlayer.name.split(" ").slice(-1)[0]}
              </span>
              <span
                style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}
              >
                │
              </span>
              <span
                style={{ color: "#6ee7b7", fontSize: "13px", fontWeight: 800 }}
              >
                {currentBetPlayer.odds.toFixed(2)}×
              </span>
              <span
                style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}
              >
                │
              </span>
              <span
                style={{ color: "#86efac", fontSize: "12px", fontWeight: 700 }}
              >
                ${activeNgsBet.current_amount.toFixed(0)} → $
                {(activeNgsBet.current_amount * currentBetPlayer.odds).toFixed(
                  0,
                )}
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

        {/* (Match Winner buttons are now inside the MatchInfo scoreboard box) */}
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
          egOdds={
            mwOdds.egOdds?.[String(modal.goals)] ??
            EG_TARGETS.find((t) => t.goals === modal.goals)?.odds
          }
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
      {modal?.type === "fundmatch" && wallet && match?.contractAddress && (
        <FundMatchModal
          contractAddress={match.contractAddress}
          matchId={matchKey ?? match.id ?? match.dbId}
          matchLabel={`${match.homeTeam} vs ${match.awayTeam}`}
          walletAddress={wallet.address}
          onClose={() => setModal(null)}
          onFunded={(amt) => deductBalance(amt)}
          onSuccess={() => window.dispatchEvent(new Event("gl:balanceRefresh"))}
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

      {/* ── CORNER BET MOCK BUTTONS — one per screen corner ───────────── */}
      {["A", "B", "C", "D"].map((corner) => {
        const isTop = corner === "A" || corner === "B";
        const isLeft = corner === "A" || corner === "C";
        const isActive = activeCorner === corner;
        return (
          <button
            key={corner}
            onClick={() =>
              setActiveCorner((prev) =>
                prev === corner ? null : (corner as "A" | "B" | "C" | "D"),
              )
            }
            className="gl-interactive"
            title={`Corner ${corner} — next corner kick bet (mock)`}
            style={{
              position: "fixed",
              ...(isTop ? { top: "0" } : { bottom: "0" }),
              ...(isLeft ? { left: "0" } : { right: "0" }),
              zIndex: 2147483645,
              pointerEvents: "auto",
              width: "156px",
              height: "60px",
              background: isActive
                ? "linear-gradient(180deg,#fef08a 0%,#fde047 40%,#eab308 100%)"
                : "linear-gradient(180deg,#fde047 0%,#eab308 40%,#ca8a04 100%)",
              borderTop: `1px solid ${isActive ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"}`,
              borderLeft: `1px solid ${isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)"}`,
              borderRight: `1px solid ${isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.18)"}`,
              borderBottom: `3px solid ${isActive ? "#92400e" : "#a16207"}`,
              borderRadius: "8px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              boxShadow: isActive
                ? "0 0 14px rgba(253,211,77,0.8), inset 0 1px 0 rgba(255,255,255,0.4)"
                : "0 5px 0 #a16207, 0 6px 14px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.35)",
              transform: isActive ? "translateY(2px)" : "translateY(0px)",
              transition: "all 0.12s ease",
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: isActive ? "#78350f" : "#1c1917",
                fontWeight: 800,
                letterSpacing: "0.04em",
              }}
            >
              Corner {corner}
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 800,
                color: isActive ? "#92400e" : "#1c1917",
                textShadow: isActive ? "0 0 8px rgba(255,255,255,0.4)" : "none",
              }}
            >
              2.80×
            </span>
          </button>
        );
      })}

      {/* ── IN-GAME AD POPUP ──────────────────────────────────────────────
           Appears bottom-centre for 5 s, TV-style, fully clickable */}
      <div
        className="gl-interactive"
        style={{
          position: "fixed",
          bottom: "10%",
          left: "28%",
          zIndex: 2147483642,
          opacity: adVisible ? 1 : 0,
          transform: adVisible ? "translateY(0)" : "translateY(14px)",
          transition: "opacity 0.45s ease, transform 0.45s ease",
          pointerEvents: adVisible ? "auto" : "none",
        }}
      >
        {adIndex === 0 ? (
          <button
            className="gl-interactive"
            onClick={() =>
              window.open("https://vision-pay.netlify.app/", "_blank")
            }
            title="CubePay — AR/XR Payments Infrastructure"
            style={{
              background: "linear-gradient(135deg, #0a1f0a 0%, #071507 100%)",
              border: "1.5px solid rgba(52,211,153,0.75)",
              borderBottom: "3px solid #021005",
              borderRadius: "10px",
              boxShadow:
                "0 8px 28px rgba(0,0,0,0.8), 0 0 0 1px rgba(52,211,153,0.12)",
              padding: "10px 18px 10px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minWidth: "270px",
            }}
          >
            {AD_CUBEPAY_URL && (
              <img
                src={AD_CUBEPAY_URL}
                alt="CubePay"
                style={{
                  height: "48px",
                  width: "48px",
                  borderRadius: "8px",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  color: "#34d399",
                  fontSize: "15px",
                  fontWeight: 900,
                  letterSpacing: "0.01em",
                  lineHeight: 1.2,
                }}
              >
                Visit Cube Pay
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "11px",
                  fontWeight: 500,
                  marginTop: "3px",
                  lineHeight: 1.4,
                }}
              >
                AR/XR Payments Infrastructure
              </div>
            </div>
          </button>
        ) : (
          <button
            className="gl-interactive"
            onClick={() =>
              window.open("https://cube-pay-web.netlify.app/", "_blank")
            }
            title="Vibe.Live — Your Interactive Streaming"
            style={{
              background: "linear-gradient(135deg, #0e0820 0%, #080412 100%)",
              border: "1.5px solid rgba(167,139,250,0.75)",
              borderBottom: "3px solid #040108",
              borderRadius: "10px",
              boxShadow:
                "0 8px 28px rgba(0,0,0,0.8), 0 0 0 1px rgba(167,139,250,0.12)",
              padding: "10px 18px 10px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              minWidth: "270px",
            }}
          >
            {AD_VIBE_URL && (
              <img
                src={AD_VIBE_URL}
                alt="Vibe.live"
                style={{
                  height: "48px",
                  width: "auto",
                  borderRadius: "8px",
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  color: "#a78bfa",
                  fontSize: "15px",
                  fontWeight: 900,
                  letterSpacing: "0.01em",
                  lineHeight: 1.2,
                }}
              >
                Visit Vibe.Live
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.6)",
                  fontSize: "11px",
                  fontWeight: 500,
                  marginTop: "3px",
                  lineHeight: 1.4,
                }}
              >
                Your Interactive Streaming
              </div>
            </div>
          </button>
        )}
      </div>
    </>
  );
};
