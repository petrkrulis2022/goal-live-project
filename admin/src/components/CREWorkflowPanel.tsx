/**
 * CREWorkflowPanel — Live visual tracker for the Chainlink CRE settlement workflow.
 *
 * Shows 3 phases:
 *   Phase 1: Match Setup  (contract deployed, pool funded, match registered on-chain)
 *   Phase 2: Live Tracking (CRE cron polling, goal events captured)
 *   Phase 3: Settlement    (FT detected, settleMatch, bets settled, settleUserBalances, withdraw ready)
 *
 * On-chain state (isActive, isSettled, balancesSettled, poolSize) is read directly
 * from the deployed GoalLiveBetting contract via a public Sepolia RPC.
 */
import { useEffect, useState, useCallback } from "react";
import { Interface } from "ethers";
import type { DbMatch, DbBet, DbGoalEvent } from "@shared/lib/supabase";

const SEPOLIA_RPC =
  (import.meta.env.VITE_SEPOLIA_RPC_URL as string | undefined) ??
  "https://sepolia.drpc.org";

// V1 matches() getter: returns (isActive, isSettled, balancesSettled, poolSize, createdAt, finalOutcome, homeGoals, awayGoals)
const IFACE = new Interface([
  "function matches(string) view returns (bool, bool, bool, uint256, uint256, uint8, uint8, uint8)",
]);

interface OnChainState {
  isActive: boolean;
  isSettled: boolean;
  balancesSettled: boolean;
  poolSize: bigint;
}

type StepStatus = "done" | "active" | "pending" | "error";

interface Step {
  label: string;
  detail?: string;
  status: StepStatus;
}

interface Phase {
  label: string;
  color: "blue" | "green" | "orange";
  steps: Step[];
}

/** Raw JSON-RPC eth_call (no external lib dependency needed for reads) */
async function ethCall(to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(SEPOLIA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to, data }, "latest"],
      }),
    });
    const json = await res.json();
    return json.result ?? null;
  } catch {
    return null;
  }
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold">
        ✓
      </span>
    );
  if (status === "active")
    return (
      <span className="flex h-4 w-4 items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-blue-400 animate-pulse" />
      </span>
    );
  if (status === "error")
    return (
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
        ✗
      </span>
    );
  return (
    <span className="flex h-4 w-4 items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border border-gray-600" />
    </span>
  );
}

const PHASE_COLORS: Record<Phase["color"], string> = {
  blue: "text-blue-400/70",
  green: "text-green-400/70",
  orange: "text-orange-400/70",
};

interface Props {
  match: DbMatch;
  bets: DbBet[];
  goals: DbGoalEvent[];
}

export function CREWorkflowPanel({ match, bets, goals }: Props) {
  const [onChain, setOnChain] = useState<OnChainState | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchOnChainState = useCallback(async () => {
    if (!match.contract_address) {
      setOnChain(null);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const calldata = IFACE.encodeFunctionData("matches", [
        match.external_match_id,
      ]);
      const raw = await ethCall(match.contract_address, calldata);
      if (!raw || raw === "0x") {
        setOnChain(null);
        setFetchError("No on-chain data (match not yet created?)");
        return;
      }
      const decoded = IFACE.decodeFunctionResult("matches", raw);
      setOnChain({
        isActive: decoded[0] as boolean,
        isSettled: decoded[1] as boolean,
        balancesSettled: decoded[2] as boolean,
        poolSize: decoded[3] as bigint,
      });
      setLastRefresh(new Date());
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setLoading(false);
    }
  }, [match.contract_address, match.external_match_id]);

  // Initial load
  useEffect(() => {
    fetchOnChainState();
  }, [fetchOnChainState]);

  // Auto-refresh every 30 s while live
  useEffect(() => {
    if (match.status === "live" || match.status === "halftime") {
      const id = setInterval(fetchOnChainState, 30_000);
      return () => clearInterval(id);
    }
  }, [match.status, fetchOnChainState]);

  // Derived stats
  const settledBets = bets.filter(
    (b) => b.status === "settled_won" || b.status === "settled_lost",
  );
  const wonBets = bets.filter((b) => b.status === "settled_won");
  // Find a successful settle tx (not an ERROR string)
  const settleTx = bets.find(
    (b) =>
      b.blockchain_settle_tx &&
      !b.blockchain_settle_tx.startsWith("ERROR") &&
      b.blockchain_settle_tx !== "already_settled",
  )?.blockchain_settle_tx;

  // ── Build phases ──────────────────────────────────────────────────────────

  const poolUSDC = onChain ? Number(onChain.poolSize) / 1_000_000 : null;

  const phases: Phase[] = [
    {
      label: "Phase 1 · Match Setup",
      color: "blue",
      steps: [
        {
          label: "Contract deployed",
          detail: match.contract_address
            ? match.contract_address.slice(0, 10) + "…"
            : undefined,
          status: match.contract_address ? "done" : "pending",
        },
        {
          label: "Match registered on-chain",
          detail:
            onChain && (onChain.isActive || onChain.isSettled)
              ? `ID: ${match.external_match_id.slice(0, 12)}…`
              : undefined,
          status: !match.contract_address
            ? "pending"
            : onChain === null
              ? "active" // loading
              : onChain.isActive || onChain.isSettled
                ? "done"
                : "pending",
        },
        {
          label: "Pool funded",
          detail:
            poolUSDC !== null
              ? poolUSDC > 0
                ? `$${poolUSDC.toFixed(2)} USDC on-chain`
                : "Pool empty"
              : undefined,
          status: !match.contract_address
            ? "pending"
            : onChain === null
              ? "active"
              : (onChain.poolSize ?? 0n) > 0n
                ? "done"
                : "pending",
        },
      ],
    },
    {
      label: "Phase 2 · Live Tracking (CRE Cron)",
      color: "green",
      steps: [
        {
          label: "CRE cron polling (60 s)",
          detail:
            match.status === "live" || match.status === "halftime"
              ? `Min ${match.current_minute ?? "?"}`
              : match.status === "finished"
                ? "Complete"
                : undefined,
          status:
            match.status === "live" || match.status === "halftime"
              ? "active"
              : match.status === "finished"
                ? "done"
                : match.status === "pre-match"
                  ? "pending"
                  : "pending",
        },
        {
          label: "Live odds sync running",
          detail:
            match.status === "live" || match.status === "halftime"
              ? "sync-live-odds cron active"
              : match.status === "finished"
                ? "Complete"
                : undefined,
          status:
            match.status === "live" || match.status === "halftime"
              ? "active"
              : match.status === "finished"
                ? "done"
                : "pending",
        },
        {
          label: "Goal events captured",
          detail:
            goals.length > 0
              ? `${goals.length} goal${goals.length > 1 ? "s" : ""} · ${goals.filter((g) => g.confirmed).length} confirmed`
              : undefined,
          status:
            goals.length > 0
              ? "done"
              : match.status === "live" || match.status === "halftime"
                ? "active"
                : "pending",
        },
      ],
    },
    {
      label: "Phase 3 · Settlement",
      color: "orange",
      steps: [
        {
          label: "FT detected by CRE",
          detail:
            match.status === "finished"
              ? `${match.score_home ?? "?"}–${match.score_away ?? "?"} FT`
              : undefined,
          status:
            match.status === "finished"
              ? "done"
              : match.status === "live" || match.status === "halftime"
                ? "active"
                : "pending",
        },
        {
          label: "settleMatch() on-chain",
          detail: settleTx
            ? `tx: ${settleTx.slice(0, 10)}…`
            : onChain?.isSettled
              ? "Confirmed (no tx recorded)"
              : undefined,
          status: onChain?.isSettled
            ? "done"
            : match.status === "finished"
              ? "active"
              : "pending",
        },
        {
          label: "Supabase bets settled",
          detail:
            settledBets.length > 0
              ? `${wonBets.length} won · ${settledBets.length - wonBets.length} lost`
              : undefined,
          status:
            settledBets.length > 0
              ? "done"
              : match.status === "finished"
                ? "active"
                : "pending",
        },
        {
          label: "settleUserBalances() on-chain",
          detail: onChain?.balancesSettled
            ? "Balances distributed ✓"
            : onChain?.isSettled
              ? "Pending (run settle again or wait for CRE)"
              : undefined,
          status: onChain?.balancesSettled
            ? "done"
            : onChain?.isSettled
              ? "active"
              : "pending",
        },
        {
          label: "Users can withdraw()",
          detail: onChain?.balancesSettled
            ? "Withdrawal enabled for all users"
            : undefined,
          status: onChain?.balancesSettled ? "done" : "pending",
        },
      ],
    },
  ];

  // Overall progress
  const allSteps = phases.flatMap((p) => p.steps);
  const doneCount = allSteps.filter((s) => s.status === "done").length;

  return (
    <div className="bg-gray-900/50 border border-white/8 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            ⛓ CRE Workflow
            <span className="text-[10px] font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              {doneCount}/{allSteps.length} steps
            </span>
          </h3>
          {lastRefresh && (
            <p className="text-[10px] text-gray-600 mt-0.5">
              On-chain read: {lastRefresh.toLocaleTimeString()}
              {(match.status === "live" || match.status === "halftime") && (
                <span className="ml-1 text-blue-500/60">
                  · auto-refresh 30 s
                </span>
              )}
            </p>
          )}
        </div>
        <button
          onClick={fetchOnChainState}
          disabled={loading || !match.contract_address}
          className="text-xs px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 hover:text-gray-200 border border-white/8 transition-colors disabled:opacity-40"
        >
          {loading ? "…" : "↺ Refresh"}
        </button>
      </div>

      {/* On-chain fetch error */}
      {fetchError && (
        <div className="text-[11px] text-yellow-400/80 bg-yellow-500/6 border border-yellow-500/15 rounded-lg px-3 py-2 mb-4">
          On-chain read: {fetchError}
        </div>
      )}

      {/* No contract yet */}
      {!match.contract_address && (
        <div className="text-[11px] text-gray-600 mb-4">
          Deploy a contract to unlock on-chain step tracking.
        </div>
      )}

      {/* Phases */}
      <div className="space-y-5">
        {phases.map((phase) => (
          <div key={phase.label}>
            <div
              className={`text-[10px] font-bold uppercase tracking-widest mb-2.5 ${PHASE_COLORS[phase.color]}`}
            >
              {phase.label}
            </div>
            <div className="relative pl-4 border-l border-white/8 ml-1.5 space-y-2">
              {phase.steps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center gap-2.5 relative"
                >
                  {/* Connector dot */}
                  <div className="absolute -left-[22px]">
                    <StepIcon status={step.status} />
                  </div>

                  {/* Label + detail */}
                  <div className="flex flex-1 items-center justify-between min-w-0">
                    <span
                      className={`text-xs font-medium ${
                        step.status === "done"
                          ? "text-gray-300"
                          : step.status === "active"
                            ? "text-white"
                            : step.status === "error"
                              ? "text-red-400"
                              : "text-gray-600"
                      }`}
                    >
                      {step.label}
                    </span>
                    {step.detail && (
                      <span className="text-[10px] text-gray-500 font-mono ml-3 flex-shrink-0 text-right">
                        {step.detail}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Completion banner + on-chain breakdown */}
      {onChain?.balancesSettled && (() => {
        const settledBetsAll = bets.filter(
          (b) => b.status === "settled_won" || b.status === "settled_lost",
        );
        const totalPool = Number(onChain.poolSize) / 1_000_000;
        const totalPayout = settledBetsAll
          .filter((b) => b.status === "settled_won")
          .reduce((s, b) => s + b.current_amount * b.odds, 0);
        const platformRev = Math.max(0, totalPool - totalPayout);

        return (
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-lg px-4 py-2.5 text-xs text-green-400 font-medium">
              <span>✅</span>
              <span>
                CRE settlement complete — users can call{" "}
                <code className="text-green-300">withdraw()</code>
              </span>
            </div>

            {settledBetsAll.length > 0 && (
              <div className="bg-gray-950/60 border border-white/6 rounded-lg p-3 space-y-2.5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
                  On-Chain Balances
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-[10px] text-gray-600 uppercase tracking-wide">Pool</div>
                    <div className="text-sm font-bold text-white">${totalPool.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-green-700 uppercase tracking-wide">Players</div>
                    <div className="text-sm font-bold text-green-400">${totalPayout.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-orange-700 uppercase tracking-wide">Platform</div>
                    <div className="text-sm font-bold text-orange-400">${platformRev.toFixed(2)}</div>
                  </div>
                </div>

                {/* Per-wallet withdrawable */}
                <div className="space-y-1 pt-1 border-t border-white/5">
                  {(() => {
                    const byWallet: Record<string, number> = {};
                    for (const b of settledBetsAll) {
                      if (!byWallet[b.bettor_wallet]) byWallet[b.bettor_wallet] = 0;
                      if (b.status === "settled_won")
                        byWallet[b.bettor_wallet] += b.current_amount * b.odds;
                    }
                    return Object.entries(byWallet).map(([wallet, payout]) => (
                      <div key={wallet} className="flex items-center justify-between text-[11px]">
                        <a
                          href={`https://sepolia.etherscan.io/address/${wallet}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-gray-500 hover:text-gray-300 transition-colors"
                        >
                          {wallet.slice(0, 8)}…{wallet.slice(-4)}
                        </a>
                        {payout > 0 ? (
                          <span className="text-green-400 font-semibold">
                            ↑ ${payout.toFixed(2)} withdrawable
                          </span>
                        ) : (
                          <span className="text-gray-600">lost · $0</span>
                        )}
                      </div>
                    ));
                  })()}
                </div>

                {settleTx && (
                  <div className="text-[10px] pt-1 border-t border-white/5">
                    <a
                      href={`https://sepolia.etherscan.io/tx/${settleTx}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-indigo-400/70 hover:text-indigo-300 transition-colors underline"
                    >
                      settle tx: {settleTx.slice(0, 14)}…
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
