import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../../src/lib/supabase";
import type {
  DbMatch,
  DbPlayer,
  DbBet,
  DbGoalEvent,
} from "../../src/lib/supabase";

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

  if (loading) return <p className="text-gray-500">Loading…</p>;
  if (!match) return <p className="text-red-400">Event not found.</p>;

  const totalLocked = bets
    .filter((b) => b.status === "active")
    .reduce((s, b) => s + Number(b.current_amount), 0);
  const totalBets = bets.length;
  const activeBets = bets.filter((b) => b.status === "active").length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            to="/dashboard"
            className="text-xs text-gray-500 hover:text-gray-300 mb-2 block"
          >
            ← Back to Events
          </Link>
          <h1 className="text-2xl font-bold">
            {match.home_team} <span className="text-gray-500">vs</span>{" "}
            {match.away_team}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(match.kickoff_at).toLocaleString()} ·{" "}
            {match.external_match_id}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <StatusBadge status={match.status} />
          <Link
            to={`/events/${matchId}/fund`}
            className="text-xs text-green-400 hover:underline"
          >
            Fund Pool →
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          {
            label: "Score",
            value: `${match.score_home ?? 0}–${match.score_away ?? 0}`,
          },
          { label: "Total Bets", value: String(totalBets) },
          { label: "Active Bets", value: String(activeBets) },
          { label: "Locked", value: `$${totalLocked.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-center"
          >
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(match.status === "pre-match" || match.status === "halftime") && (
          <Btn onClick={() => updateStatus("live")} color="green">
            Set Live
          </Btn>
        )}
        {match.status === "live" && (
          <>
            <Btn onClick={() => updateStatus("finished")} color="gray">
              Set Finished
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
        {match.contract_address ? (
          <span className="px-3 py-1.5 text-xs bg-gray-800 text-gray-400 rounded-md font-mono">
            Contract: {match.contract_address.slice(0, 10)}…
          </span>
        ) : (
          <span className="px-3 py-1.5 text-xs bg-yellow-500/10 text-yellow-400 rounded-md">
            No contract assigned
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-800 mb-6">
        {(["overview", "players", "bets", "goals"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-green-500 text-white"
                : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 gap-4 text-sm">
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
              className="bg-gray-900 border border-gray-800 rounded-md px-4 py-3"
            >
              <div className="text-xs text-gray-500 mb-1">{k}</div>
              <div className="font-mono text-xs break-all">{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "players" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-4">#</th>
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Team</th>
              <th className="py-2">Odds</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className="border-b border-gray-800/50 hover:bg-gray-900"
              >
                <td className="py-2 pr-4 text-gray-500">{p.jersey_number}</td>
                <td className="py-2 pr-4">{p.name}</td>
                <td className="py-2 pr-4">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${p.team === "home" ? "bg-blue-500/10 text-blue-400" : "bg-red-500/10 text-red-400"}`}
                  >
                    {p.team}
                  </span>
                </td>
                <td className="py-2 font-mono font-bold text-green-400">
                  {p.odds}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "bets" && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
              <th className="py-2 pr-4">Wallet</th>
              <th className="py-2 pr-4">Player</th>
              <th className="py-2 pr-4">Amount</th>
              <th className="py-2 pr-4">Odds</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((b) => (
              <tr
                key={b.id}
                className="border-b border-gray-800/50 hover:bg-gray-900"
              >
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">
                  {b.bettor_wallet.slice(0, 10)}…
                </td>
                <td className="py-2 pr-4">{b.current_player_id}</td>
                <td className="py-2 pr-4 font-mono">
                  ${Number(b.current_amount).toFixed(2)}
                </td>
                <td className="py-2 pr-4 font-mono text-green-400">
                  {b.odds}x
                </td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      b.status === "active"
                        ? "bg-blue-500/10 text-blue-400"
                        : b.status === "settled_won"
                          ? "bg-green-500/10 text-green-400"
                          : b.status === "settled_lost"
                            ? "bg-red-500/10 text-red-400"
                            : b.status === "provisional_win"
                              ? "bg-yellow-500/10 text-yellow-400"
                              : "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {b.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === "goals" && (
        <div className="space-y-2">
          {goals.length === 0 && (
            <p className="text-gray-600 text-sm">No goal events recorded.</p>
          )}
          {goals.map((g) => (
            <div
              key={g.id}
              className="bg-gray-900 border border-gray-800 rounded-md px-4 py-3 flex items-center justify-between text-sm"
            >
              <span>
                <span className="font-bold text-white">{g.player_name}</span>
                <span className="text-gray-500 mx-2">·</span>
                <span
                  className={
                    g.team === "home" ? "text-blue-400" : "text-red-400"
                  }
                >
                  {g.team}
                </span>
                <span className="text-gray-500 mx-2">·</span>
                <span className="text-gray-300">{g.minute}'</span>
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${g.confirmed ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}
                >
                  {g.confirmed ? "confirmed" : "pending"}
                </span>
                <span className="text-xs text-gray-600">{g.source}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    "pre-match": "bg-yellow-500/10 text-yellow-400",
    halftime:   "bg-blue-500/10 text-blue-400",
    live:       "bg-green-500/10 text-green-400",
    finished:   "bg-gray-700 text-gray-400",
    cancelled:  "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`text-xs font-medium px-2 py-1 rounded-full uppercase ${colors[status] ?? "bg-gray-800 text-gray-400"}`}
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
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        color === "green"
          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
