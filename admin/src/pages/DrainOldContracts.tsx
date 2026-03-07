import { useState } from "react";
import { contractService } from "../services/contractService";

const OLD_CONTRACT = "0xEf00b13a1Ef5a8E05f6cADa24C0fF72F5d8635F4";

const STUCK_MATCHES = [
  {
    match: "Bournemouth vs Brentford",
    matchId: "0514ff63edc959b9fedb8a345a5417a6",
  },
  {
    match: "Wolverhampton vs Liverpool",
    matchId: "d558849331cb2c112e9cce7219e46efd",
  },
  {
    match: "Aston Villa vs Chelsea",
    matchId: "d65b11b8411415cf9d8744dfdfa5d638",
  },
];

type RowStatus = "idle" | "draining" | "done" | "error";

export default function DrainOldContracts() {
  const [rows, setRows] = useState<
    Record<string, { status: RowStatus; txHash?: string; error?: string }>
  >(
    Object.fromEntries(
      STUCK_MATCHES.map((m) => [m.matchId, { status: "idle" }]),
    ),
  );

  async function drain(matchId: string) {
    setRows((r) => ({ ...r, [matchId]: { status: "draining" } }));
    try {
      const txHash = await contractService.drainOldContract(
        OLD_CONTRACT,
        matchId,
      );
      setRows((r) => ({ ...r, [matchId]: { status: "done", txHash } }));
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      setRows((r) => ({ ...r, [matchId]: { status: "error", error } }));
    }
  }

  async function drainAll() {
    for (const { matchId } of STUCK_MATCHES) {
      if (rows[matchId]?.status === "idle") {
        await drain(matchId);
      }
    }
  }

  const allDone = STUCK_MATCHES.every(
    (m) => rows[m.matchId]?.status === "done",
  );
  const anyDraining = STUCK_MATCHES.some(
    (m) => rows[m.matchId]?.status === "draining",
  );

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Drain Old Contract</h1>
      <p className="text-gray-500 text-sm mb-1">
        Contract: <span className="font-mono">{OLD_CONTRACT}</span>
      </p>
      <p className="text-gray-400 text-xs mb-6">
        These matches have USDC locked in the old contract. Calling{" "}
        <code>emergencyWithdrawPool</code> sends all funds back to your wallet.
        The match must not be settled on-chain and the pool must be non-empty.
      </p>

      <div className="space-y-3 mb-6">
        {STUCK_MATCHES.map(({ match, matchId }) => {
          const row = rows[matchId];
          return (
            <div
              key={matchId}
              className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-3 border border-gray-700"
            >
              <div>
                <p className="font-semibold text-sm">{match}</p>
                <p className="text-gray-500 text-xs font-mono">{matchId}</p>
                {row.status === "done" && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${row.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 text-xs"
                  >
                    ✓ Drained — view tx ↗
                  </a>
                )}
                {row.status === "error" && (
                  <p className="text-red-400 text-xs">{row.error}</p>
                )}
              </div>
              <button
                onClick={() => drain(matchId)}
                disabled={row.status === "draining" || row.status === "done"}
                className="px-3 py-1.5 rounded text-sm font-semibold disabled:opacity-40
                  bg-orange-600 hover:bg-orange-500 text-white transition"
              >
                {row.status === "draining"
                  ? "Draining…"
                  : row.status === "done"
                    ? "Done"
                    : "Drain"}
              </button>
            </div>
          );
        })}
      </div>

      {!allDone && (
        <button
          onClick={drainAll}
          disabled={anyDraining}
          className="w-full py-3 rounded-lg font-bold text-white bg-red-700 hover:bg-red-600
            disabled:opacity-40 transition"
        >
          {anyDraining ? "Draining…" : "Drain All (3 txs in MetaMask)"}
        </button>
      )}

      {allDone && (
        <div className="text-center text-emerald-400 font-semibold mt-4">
          ✓ All pools drained — USDC is back in your wallet
        </div>
      )}
    </div>
  );
}
