import { useState, useEffect } from "react";
import { Interface } from "ethers";

const SEPOLIA_RPC = "https://sepolia.drpc.org";
const POLL_MS = 60_000; // refresh every 60 s

// Minimal ABI for the public matches(string) getter.
// V1 struct (mapping fields excluded from getter):
//   (isActive, isSettled, balancesSettled, poolSize, createdAt, finalOutcome, homeGoals, awayGoals)
const IFACE = new Interface([
  "function matches(string) view returns (bool, bool, bool, uint256, uint256, uint8, uint8, uint8)",
]);

/**
 * Polls the on-chain poolSize for a specific match inside the singleton
 * GoalLiveBetting contract.  Returns null while loading or when params missing.
 *
 * @param contractAddress  The singleton contract address
 * @param onChainMatchId   The external_match_id string used as the mapping key
 */
export function usePoolBalance(
  contractAddress: string | null | undefined,
  onChainMatchId: string | null | undefined,
): number | null {
  const [poolBalance, setPoolBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!contractAddress || !onChainMatchId) {
      setPoolBalance(null);
      return;
    }

    let cancelled = false;

    async function fetch_() {
      try {
        const data = IFACE.encodeFunctionData("matches", [onChainMatchId]);
        const res = await fetch(SEPOLIA_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{ to: contractAddress, data }, "latest"],
            id: 1,
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.result || json.result === "0x") {
          setPoolBalance(0);
          return;
        }
        // Decoded tuple: [matchId(str), isActive, isSettled, poolSize(uint256), ...]
        const decoded = IFACE.decodeFunctionResult("matches", json.result);
        const poolSizeWei = decoded[3] as bigint; // poolSize is index 3
        setPoolBalance(Number(poolSizeWei) / 1_000_000);
      } catch {
        // silently ignore — stale value stays displayed
      }
    }

    fetch_();
    const iv = setInterval(fetch_, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [contractAddress, onChainMatchId]);

  return poolBalance;
}
