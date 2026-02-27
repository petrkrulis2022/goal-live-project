import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@shared/lib/supabase";
import type { DbMatch } from "@shared/lib/supabase";
import { contractService } from "../services/contractService";

export default function FundPool() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<DbMatch | null>(null);
  const [amount, setAmount] = useState("");
  const [funding, setFunding] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    supabase
      .from("matches")
      .select("*")
      .eq("external_match_id", matchId)
      .single()
      .then(({ data }) => setMatch(data));
  }, [matchId]);

  async function handleFund() {
    if (!match || !amount) return;
    setError(null);
    setFunding(true);
    try {
      const tx = await contractService.fundPool(
        match.external_match_id,
        parseFloat(amount),
      );
      setTxHash(tx);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  }

  async function handleDeploy() {
    if (!match) return;
    setError(null);
    setFunding(true);
    try {
      const address = await contractService.deployContract(
        match.external_match_id,
      );
      await supabase
        .from("matches")
        .update({ contract_address: address })
        .eq("id", match.id);
      setMatch((m) => (m ? { ...m, contract_address: address } : m));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFunding(false);
    }
  }

  if (!match)
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900/50 border border-white/5 rounded-xl h-16 animate-pulse"
          />
        ))}
      </div>
    );

  return (
    <div className="max-w-lg">
      <Link
        to={`/events/${matchId}`}
        className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-300 transition-colors mb-6"
      >
        ← Back to Event
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Fund Pool</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {match.home_team} vs {match.away_team}
        </p>
      </div>

      {/* Contract status */}
      <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-4">
        <div className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-2">
          Contract Address
        </div>
        {match.contract_address ? (
          <div className="font-mono text-sm text-green-400 break-all leading-relaxed">
            {match.contract_address}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-yellow-500 text-sm font-medium">
              Not deployed yet
            </span>
            <button
              onClick={handleDeploy}
              disabled={funding}
              className="px-3.5 py-2 text-xs bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/18 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {funding ? "Deploying…" : "Deploy Contract"}
            </button>
          </div>
        )}
      </div>

      {/* Fund amount */}
      {match.contract_address && (
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-4">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Amount (USDC)
          </label>
          <div className="flex gap-3">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="1000.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-gray-950 border border-white/8 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500/60 focus:ring-1 focus:ring-green-500/30 transition-all"
            />
            <button
              onClick={handleFund}
              disabled={funding || !amount}
              className="px-5 py-2.5 bg-green-500 text-black text-sm font-bold rounded-lg hover:bg-green-400 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/20"
            >
              {funding ? "Sending…" : "Fund"}
            </button>
          </div>

          {txHash && (
            <div className="mt-3 flex items-start gap-2 text-green-400 text-xs bg-green-500/8 border border-green-500/20 px-3 py-2.5 rounded-lg">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="font-mono break-all">{txHash}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-xl mb-4">
          <span className="mt-0.5">⚠</span> {error}
        </div>
      )}

      {/* Info box */}
      <div className="bg-gray-900/40 border border-white/4 rounded-xl p-4 text-xs text-gray-600 leading-relaxed">
        <p className="font-semibold text-gray-500 mb-1.5">How it works</p>
        <p>
          Pool funding calls{" "}
          <code className="text-gray-400 bg-gray-800 px-1 py-0.5 rounded">
            fundPool()
          </code>{" "}
          on the deployed escrow contract. The contract holds USDC until bets
          are settled. Admin wallet must have sufficient Sepolia USDC. Deploy
          via the admin UI using MetaMask (Foundry artifact embedded).
        </p>
      </div>
    </div>
  );
}
