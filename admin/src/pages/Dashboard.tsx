import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import type { DbMatch } from "@shared/lib/supabase";

export default function Dashboard() {
  const [matches, setMatches] = useState<DbMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("matches")
      .select("*")
      .order("kickoff_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setMatches(data ?? []);
        setLoading(false);
      });
  }, []);

  const statusStyles: Record<string, { dot: string; badge: string }> = {
    "pre-match": {
      dot: "bg-yellow-400",
      badge: "text-yellow-400 bg-yellow-400/10 border border-yellow-400/20",
    },
    live: {
      dot: "bg-green-400",
      badge:
        "text-green-400  bg-green-400/10  border border-green-400/20 animate-pulse",
    },
    halftime: {
      dot: "bg-blue-400",
      badge: "text-blue-400   bg-blue-400/10   border border-blue-400/20",
    },
    finished: {
      dot: "bg-gray-500",
      badge: "text-gray-400   bg-gray-400/10   border border-gray-700",
    },
    cancelled: {
      dot: "bg-red-500",
      badge: "text-red-400    bg-red-400/10    border border-red-500/20",
    },
  };

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {matches.length} match{matches.length !== 1 ? "es" : ""} on record
          </p>
        </div>
        <Link
          to="/events/new"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 text-black text-sm font-bold hover:bg-green-400 active:scale-[0.98] transition-all shadow-lg shadow-green-500/20"
        >
          <span className="text-base leading-none">＋</span>
          Create Event
        </Link>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900/50 border border-white/5 rounded-xl h-[72px] animate-pulse"
            />
          ))}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
          <span>⚠</span> {error}
        </div>
      )}

      {!loading && !error && matches.length === 0 && (
        <div className="text-center py-24 border border-dashed border-white/8 rounded-2xl">
          <p className="text-4xl mb-4">⚽</p>
          <p className="text-lg font-semibold text-gray-300 mb-1">
            No events yet
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Create your first match event to get started.
          </p>
          <Link
            to="/events/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium rounded-lg hover:bg-green-500/15 transition-colors"
          >
            Create Event →
          </Link>
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map((m) => {
            const s = statusStyles[m.status] ?? statusStyles.cancelled;
            return (
              <div
                key={m.id}
                className="group bg-gray-900 border border-white/5 hover:border-green-500/20 rounded-xl px-5 py-4 flex items-center justify-between transition-all duration-150 hover:bg-gray-900/80"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <div>
                    <div className="font-semibold text-white text-sm">
                      {m.home_team}{" "}
                      <span className="text-gray-600 font-normal">vs</span>{" "}
                      {m.away_team}
                    </div>
                    <div className="text-xs text-gray-600 mt-0.5 font-mono">
                      {new Date(m.kickoff_at).toLocaleString()} ·{" "}
                      {m.external_match_id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.status === "live" && (
                    <span className="text-base font-bold tabular-nums text-white">
                      {m.score_home ?? 0}–{m.score_away ?? 0}
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${s.badge}`}
                  >
                    {m.status}
                  </span>
                  <Link
                    to={`/events/${m.external_match_id}`}
                    className="text-xs font-medium text-gray-500 group-hover:text-green-400 transition-colors px-2 py-1"
                  >
                    Manage →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
