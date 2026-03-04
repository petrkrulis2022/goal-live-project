import React from "react";
import type { Match } from "../types";

interface MatchInfoProps {
  match: Match | null;
  mwOdds?: { home: number; draw: number; away: number };
  getMwBet?: (o: "home" | "draw" | "away") => boolean;
  onMwBet?: (o: "home" | "draw" | "away") => void;
  isFinished?: boolean;
}

const STATUS_LABEL: Record<Match["status"], string> = {
  "pre-match": "PRE-MATCH",
  live: "LIVE",
  halftime: "HALF TIME",
  finished: "FULL TIME",
};

const MW_LABELS = { home: "HOME", draw: "DRAW", away: "AWAY" };

const MwButton: React.FC<{
  o: "home" | "draw" | "away";
  mwOdds: { home: number; draw: number; away: number };
  getMwBet?: (o: "home" | "draw" | "away") => boolean;
  onMwBet: (o: "home" | "draw" | "away") => void;
}> = ({ o, mwOdds, getMwBet, onMwBet }) => {
  const active = getMwBet ? getMwBet(o) : false;
  return (
    <button
      onClick={() => onMwBet(o)}
      className="gl-interactive"
      style={{
        background: active
          ? "linear-gradient(180deg,#064e3b 0%,#065f46 50%,#022c22 100%)"
          : "linear-gradient(180deg,#1e2a45 0%,#111827 100%)",
        border: `1px solid ${active ? "rgba(52,211,153,0.7)" : "rgba(255,255,255,0.14)"}`,
        borderBottom: `3px solid ${active ? "#011a14" : "#06080f"}`,
        borderRadius: "6px",
        cursor: "pointer",
        padding: "4px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1px",
        pointerEvents: "auto",
        minWidth: "52px",
      }}
    >
      <span
        style={{
          color: active ? "#34d399" : "#9ca3af",
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}
      >
        {MW_LABELS[o]}
      </span>
      <span style={{ color: "#fde047", fontSize: "12px", fontWeight: 800 }}>
        {mwOdds[o].toFixed(2)}×
      </span>
    </button>
  );
};

export const MatchInfo: React.FC<MatchInfoProps> = ({
  match,
  mwOdds,
  getMwBet,
  onMwBet,
  isFinished,
}) => {
  if (!match) {
    return (
      <div className="bg-black/80 rounded-lg px-6 py-2 border border-white/10 text-gray-400 text-xs">
        Loading match…
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[match.status];
  const isLive = match.status === "live";

  const statusColor = isLive
    ? "#10b981"
    : match.status === "halftime"
      ? "#fde047"
      : match.status === "finished"
        ? "#6b7280"
        : "#d1d5db";

  const statusText = isLive ? `● LIVE  ${match.currentMinute}'` : statusLabel;

  return (
    <div
      className="gl-interactive"
      style={{
        background: "rgba(0,0,0,0.90)",
        borderRadius: "10px",
        border: "1px solid rgba(255,255,255,0.10)",
        padding: "4px 12px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "0 8px",
      }}
    >
      {/* Home team name */}
      <p
        style={{
          color: "#fff",
          fontWeight: 700,
          fontSize: "12px",
          textAlign: "left",
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {match.homeTeam}
      </p>

      {/* Status label — top-centre */}
      <p
        style={{
          color: statusColor,
          fontWeight: 700,
          fontSize: "9px",
          textAlign: "center",
          margin: 0,
          letterSpacing: "0.07em",
        }}
      >
        {statusText}
      </p>

      {/* Away team name */}
      <p
        style={{
          color: "#fff",
          fontWeight: 700,
          fontSize: "12px",
          textAlign: "right",
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {match.awayTeam}
      </p>

      {/* Score + MW row — spans all 3 columns */}
      <div
        style={{
          gridColumn: "1 / span 3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        {/* HOME MW button */}
        {mwOdds && !isFinished && onMwBet ? (
          <MwButton
            o="home"
            mwOdds={mwOdds}
            getMwBet={getMwBet}
            onMwBet={onMwBet}
          />
        ) : null}

        {/* Home score */}
        <p
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: "32px",
            margin: 0,
            lineHeight: 1,
            minWidth: "28px",
            textAlign: "center",
          }}
        >
          {match.score.home}
        </p>

        {/* DRAW MW button */}
        {mwOdds && !isFinished && onMwBet ? (
          <MwButton
            o="draw"
            mwOdds={mwOdds}
            getMwBet={getMwBet}
            onMwBet={onMwBet}
          />
        ) : (
          <p
            style={{
              color: "rgba(255,255,255,0.3)",
              fontWeight: 700,
              fontSize: "22px",
              margin: 0,
              lineHeight: 1,
            }}
          >
            —
          </p>
        )}

        {/* Away score */}
        <p
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: "32px",
            margin: 0,
            lineHeight: 1,
            minWidth: "28px",
            textAlign: "center",
          }}
        >
          {match.score.away}
        </p>

        {/* AWAY MW button */}
        {mwOdds && !isFinished && onMwBet ? (
          <MwButton
            o="away"
            mwOdds={mwOdds}
            getMwBet={getMwBet}
            onMwBet={onMwBet}
          />
        ) : null}
      </div>
    </div>
  );
};
