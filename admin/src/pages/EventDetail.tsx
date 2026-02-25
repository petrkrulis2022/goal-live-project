import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import type {
  DbMatch,
  DbPlayer,
  DbBet,
  DbGoalEvent,
} from "@shared/lib/supabase";

type Tab = "overview" | "players" | "bets" | "goals";

export default function EventDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const nav = useNavigate();

  const [match, setMatch] = useState<DbMatch | null>(null);
  const [players, setPlayers] = useState<DbPlayer[]>([]);
  const [bets, setBets] = useState<DbBet[]>([]);
  const [goals, setGoals] = useState<DbGoalEvent[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!matchId) return;
    Promise.all([
      supabase
        .from("matches")
        .select("*")
        .eq("external_match_id", matchId)
        .single(),
    ]).then(([{ data: m, error }]) => {
      if (error || !m) {
        setLoading(false);
        return;
      }
      setMatch(m);

      Promise.all([
        supabase.from("players").select("*").eq("match_id", m.id).order("odds"),
        supabase
          .from("bets")
          .select("*")
          .eq("match_id", m.id)
          .order("placed_at", { ascending: false }),
        supabase
          .from("goal_events")
          .select("*")
          .eq("match_id", m.id)
          .order("minute"),
      ]).then(([{ data: p }, { data: b }, { data: g }]) => {
        setPlayers(p ?? []);
        setBets(b ?? []);
        setGoals(g ?? []);
        setLoading(false);
      });
    });
  }, [matchId]);

  async function updateStatus(status: DbMatch["status"]) {
    if (!match) return;
    await supabase.from("matches").update({ status }).eq("id", match.id);
    setMatch((m) => (m ? { ...m, status } : m));
  }

  async function updateScore(home: number, away: number) {
    if (!match) return;
    await supabase
      .from("matches")
      .update({ score_home: home, score_away: away })
      .eq("id", match.id);
    setMatch((m) => (m ? { ...m, score_home: home, score_away: away } : m));
  }

  if (loading)
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900/50 border border-white/5 rounded-xl h-16 animate-pulse"
          />
        ))}
      </div>
    );
  if (!match)
    return (
      <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl">
        <span>⚠</span> Event not found.
      </div>
    );

  const totalLocked = bets
    .filter((b) => b.status === "active")
    .reduce((s, b) => s + Number(b.current_amount), 0);
  const totalBets = bets.length;
  const activeBets = bets.filter((b) => b.status === "active").length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors mb-3"
          >
            ← Events
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {match.home_team}{" "}
            <span className="text-gray-600 font-normal">vs</span>{" "}
            {match.away_team}
          </h1>
          <p className="text-xs text-gray-600 mt-1 font-mono">
            {new Date(match.kickoff_at).toLocaleString()} ·{" "}
            {match.external_match_id}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <StatusBadge status={match.status} />
          <Link
            to={`/events/${matchId}/fund`}
            className="text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            Fund Pool →
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Score",
            value: `${match.score_home ?? 0}–${match.score_away ?? 0}`,
            accent: match.status === "live",
          },
          { label: "Total Bets", value: String(totalBets), accent: false },
          { label: "Active Bets", value: String(activeBets), accent: false },
          {
            label: "Locked",
            value: `$${totalLocked.toFixed(2)}`,
            accent: false,
          },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className={`bg-gray-900 border rounded-xl p-4 text-center transition-colors ${
              accent
                ? "border-green-500/30 shadow-sm shadow-green-500/10"
                : "border-white/5"
            }`}
          >
            <div
              className={`text-2xl font-bold tabular-nums ${accent ? "text-green-400" : "text-white"}`}
            >
              {value}
            </div>
            <div className="text-xs text-gray-500 mt-1 uppercase tracking-wider">
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        {(match.status === "pre-match" || match.status === "halftime") && (
          <Btn onClick={() => updateStatus("live")} color="green">
            ▶ Set Live
          </Btn>
        )}
        {match.status === "live" && (
          <>
            <Btn onClick={() => updateStatus("finished")} color="gray">
              ■ Set Finished
            </Btn>
            <Btn
              onClick={() =>
                updateScore((match.score_home ?? 0) + 1, match.score_away ?? 0)
              }
              color="green"
            >
              +1 Home
            </Btn>
            <Btn
              onClick={() =>
                updateScore(match.score_home ?? 0, (match.score_away ?? 0) + 1)
              }
              color="green"
            >
              +1 Away
            </Btn>
          </>
        )}
        <div className="ml-auto">
          {match.contract_address ? (
            <span className="px-3 py-1.5 text-[11px] bg-gray-900 border border-white/5 text-gray-500 rounded-lg font-mono">
              {match.contract_address.slice(0, 10)}…
              {match.contract_address.slice(-4)}
            </span>
          ) : (
            <span className="px-3 py-1.5 text-[11px] bg-yellow-500/8 border border-yellow-500/20 text-yellow-500 rounded-lg">
              No contract assigned
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900/60 border border-white/5 rounded-xl p-1 mb-6 w-fit">
        {(["overview", "players", "bets", "goals"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
              tab === t
                ? "bg-gray-800 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {[
            ["External ID", match.external_match_id],
            ["Status", match.status],
            ["Kickoff", new Date(match.kickoff_at).toLocaleString()],
            ["Half", String(match.half)],
            ["Minute", String(match.current_minute)],
            ["Demo", match.is_demo ? "Yes" : "No"],
            ["Oracle", match.oracle_address ?? "—"],
            ["Contract", match.contract_address ?? "—"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="bg-gray-900/70 border border-white/5 rounded-xl px-4 py-3"
            >
              <div className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-1">
                {k}
              </div>
              <div className="font-mono text-xs text-gray-300 break-all">
                {v}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "players" && (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5 bg-gray-950/40">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Odds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {players.map((p) => (
                <tr key={p.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                    {p.jersey_number}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-200">
                    {p.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        p.team === "home"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {p.team}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-green-400">
                    {p.odds}x
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "bets" && (
        <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] text-gray-600 uppercase tracking-wider border-b border-white/5 bg-gray-950/40">
                <th className="px-4 py-3 font-medium">Wallet</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Odds</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/4">
              {bets.map((b) => (
                <tr key={b.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {b.bettor_wallet.slice(0, 10)}…
                  </td>
                  <td className="px-4 py-3 text-gray-300">
                    {b.current_player_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-200">
                    ${Number(b.current_amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 font-mono text-green-400 font-bold">
                    {b.odds}x
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                        b.status === "active"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : b.status === "settled_won"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : b.status === "settled_lost"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : b.status === "provisional_win"
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                : "bg-gray-800 text-gray-400 border-white/5"
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "goals" && (
        <div className="space-y-2">
          {goals.length === 0 && (
            <div className="text-center py-12 border border-dashed border-white/8 rounded-xl text-sm text-gray-600">
              No goal events recorded yet.
            </div>
          )}
          {goals.map((g) => (
            <div
              key={g.id}
              className="group bg-gray-900/70 border border-white/5 hover:border-green-500/15 rounded-xl px-4 py-3.5 flex items-center justify-between text-sm transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">⚽</span>
                <div>
                  <span className="font-semibold text-white">
                    {g.player_name}
                  </span>
                  <span className="mx-2 text-gray-700">·</span>
                  <span
                    className={
                      g.team === "home" ? "text-blue-400" : "text-red-400"
                    }
                  >
                    {g.team}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold tabular-nums text-gray-400">
                  {g.minute}'
                </span>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${
                    g.confirmed
                      ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  }`}
                >
                  {g.confirmed ? "confirmed" : "pending"}
                </span>
                <span className="text-[11px] text-gray-600 font-mono">
                  {g.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "pre-match": "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    halftime: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    live: "bg-green-500/10 text-green-400 border-green-500/20",
    finished: "bg-gray-800 text-gray-400 border-white/8",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide border ${
        styles[status] ?? "bg-gray-800 text-gray-400 border-white/5"
      }`}
    >
      {status}
    </span>
  );
}

function Btn({
  onClick,
  color,
  children,
}: {
  onClick: () => void;
  color: "green" | "gray";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all active:scale-[0.97] border ${
        color === "green"
          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20"
          : "bg-gray-800/80 text-gray-400 hover:bg-gray-700 border-white/5"
      }`}
    >
      {children}
    </button>
  );
}
