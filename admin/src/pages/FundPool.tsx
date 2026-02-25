import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../../src/lib/supabase";
import type { DbMatch } from "../../src/lib/supabase";
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
        match.contract_address!,
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

  if (!match) return <p className="text-gray-500">Loading…</p>;

  return (
    <div className="max-w-lg mx-auto">
      <Link
        to={`/events/${matchId}`}
        className="text-xs text-gray-500 hover:text-gray-300 mb-4 block"
      >
        ← Back to Event
      </Link>
      <h1 className="text-2xl font-bold mb-2">Fund Pool</h1>
      <p className="text-gray-400 text-sm mb-8">
        {match.home_team} vs {match.away_team}
      </p>

      {/* Contract status */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
        <div className="text-xs text-gray-500 mb-1">Contract Address</div>
        {match.contract_address ? (
          <div className="font-mono text-sm text-green-400 break-all">
            {match.contract_address}
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="text-yellow-400 text-sm">Not deployed yet</span>
            <button
              onClick={handleDeploy}
              disabled={funding}
              className="px-3 py-1.5 text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 rounded-md transition-colors disabled:opacity-50"
            >
              {funding ? "Deploying…" : "Deploy Contract"}
            </button>
          </div>
        )}
      </div>

      {/* Fund amount */}
      {match.contract_address && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <label className="block text-sm font-medium text-gray-300 mb-2">
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
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
            <button
              onClick={handleFund}
              disabled={funding || !amount}
              className="px-4 py-2 bg-green-500 text-black text-sm font-semibold rounded-md hover:bg-green-400 disabled:opacity-50 transition-colors"
            >
              {funding ? "Sending…" : "Fund"}
            </button>
          </div>

          {txHash && (
            <p className="mt-3 text-xs text-green-400 font-mono break-all">
              Tx: {txHash}
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {/* Info box */}
      <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-md p-4 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-400 mb-1">How it works</p>
        <p>
          Pool funding calls <code className="text-gray-300">fundPool()</code>{" "}
          on the deployed escrow contract. The contract holds USDC until bets
          are settled. Admin wallet must be approved as operator. Contract
          deployment requires Hardhat or direct RPC — not available until Phase
          2 contract is live.
        </p>
      </div>
    </div>
  );
}
