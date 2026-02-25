import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase";
import type { DbMatch } from "../../src/lib/supabase";

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

  const statusColor: Record<string, string> = {
    "pre-match": "text-yellow-400 bg-yellow-400/10",
    live: "text-green-400 bg-green-400/10",
    halftime: "text-blue-400 bg-blue-400/10",
    finished: "text-gray-400 bg-gray-400/10",
    cancelled: "text-red-400 bg-red-400/10",
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Events</h1>
        <Link
          to="/events/new"
          className="px-4 py-2 rounded-md bg-green-500 text-black text-sm font-semibold hover:bg-green-400 transition-colors"
        >
          + Create Event
        </Link>
      </div>

      {loading && <p className="text-gray-500">Loading events…</p>}
      {error && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && matches.length === 0 && (
        <div className="text-center py-20 text-gray-600">
          <p className="text-4xl mb-4">⚽</p>
          <p className="text-lg">No events yet.</p>
          <Link
            to="/events/new"
            className="text-green-400 hover:underline text-sm"
          >
            Create your first event →
          </Link>
        </div>
      )}

      {matches.length > 0 && (
        <div className="space-y-3">
          {matches.map((m) => (
            <div
              key={m.id}
              className="bg-gray-900 border border-gray-800 rounded-lg px-5 py-4 flex items-center justify-between hover:border-gray-700 transition-colors"
            >
              <div>
                <div className="font-semibold">
                  {m.home_team} <span className="text-gray-500">vs</span>{" "}
                  {m.away_team}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(m.kickoff_at).toLocaleString()} ·{" "}
                  <span className="font-mono text-gray-600">
                    {m.external_match_id}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {m.status === "live" && (
                  <span className="text-lg font-bold tabular-nums">
                    {m.score_home ?? 0}–{m.score_away ?? 0}
                  </span>
                )}
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full uppercase tracking-wide ${
                    statusColor[m.status] ?? "text-gray-400 bg-gray-800"
                  }`}
                >
                  {m.status}
                </span>
                <Link
                  to={`/events/${m.external_match_id}`}
                  className="text-sm text-green-400 hover:underline"
                >
                  Manage →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
