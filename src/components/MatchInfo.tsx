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

  return (
    <div className="gl-interactive bg-black/90 rounded-lg px-5 py-2 border border-white/10 flex items-center gap-5">
      {/* Home team */}
      <div className="text-center min-w-[80px]">
        <p className="text-white font-bold text-sm leading-tight">
          {match.homeTeam}
        </p>
        <p className="text-4xl font-black text-white leading-none">
          {match.score.home}
        </p>
      </div>

      {/* Centre info */}
      <div className="text-center flex flex-col items-center gap-0.5">
        {isLive && (
          <span className="text-emerald-400 text-[10px] font-bold tracking-widest">
            ● LIVE
          </span>
        )}
        <span
          className={`text-xs font-semibold tracking-wide ${
            match.status === "halftime"
              ? "text-yellow-400"
              : match.status === "finished"
                ? "text-gray-400"
                : "text-white"
          }`}
        >
          {isLive ? `${match.currentMinute}'` : statusLabel}
        </span>
      </div>

      {/* Away team */}
      <div className="text-center min-w-[80px]">
        <p className="text-white font-bold text-sm leading-tight">
          {match.awayTeam}
        </p>
        <p className="text-4xl font-black text-white leading-none">
          {match.score.away}
        </p>
      </div>
    </div>
  );
};
