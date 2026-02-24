import React from "react";
import type { Match } from "../types";

interface MatchInfoProps {
  match: Match | null;
}

const STATUS_LABEL: Record<Match["status"], string> = {
  "pre-match": "PRE-MATCH",
  live: "LIVE",
  halftime: "HALF TIME",
  finished: "FULL TIME",
};

export const MatchInfo: React.FC<MatchInfoProps> = ({ match }) => {
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
        padding: "5px 18px",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "0 12px",
      }}
    >
      {/* Home team name */}
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
          textAlign: "left",
          margin: 0,
          lineHeight: 1.2,
        }}
      >
        {match.awayTeam}
      </p>

      {/* Home score */}
      <p
        style={{
          color: "#fff",
          fontWeight: 900,
          fontSize: "32px",
          textAlign: "right",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {match.score.home}
      </p>

      {/* Logo — centre of score row */}
      {/* Score separator */}
      <p
        style={{
          color: "rgba(255,255,255,0.3)",
          fontWeight: 700,
          fontSize: "22px",
          textAlign: "center",
          margin: 0,
          lineHeight: 1,
        }}
      >
        —
      </p>

      {/* Away score */}
      <p
        style={{
          color: "#fff",
          fontWeight: 900,
          fontSize: "32px",
          textAlign: "left",
          margin: 0,
          lineHeight: 1,
        }}
      >
        {match.score.away}
      </p>
    </div>
  );
};
