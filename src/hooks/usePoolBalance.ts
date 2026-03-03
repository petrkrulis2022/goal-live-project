import { useState, useEffect } from "react";

const USDC_CONTRACT = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const SEPOLIA_RPC = "https://sepolia.drpc.org";
const POLL_MS = 60_000; // refresh every 60 s

/**
 * Polls the on-chain USDC balance of a GoalLiveBetting contract.
 * Returns null while loading / no address provided.
 */
export function usePoolBalance(contractAddress: string | null | undefined): number | null {
  const [poolBalance, setPoolBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!contractAddress) {
      setPoolBalance(null);
      return;
    }

    let cancelled = false;

    async function fetch_() {
      try {
        const data =
          "0x70a08231" + contractAddress!.slice(2).padStart(64, "0");
        const res = await fetch(SEPOLIA_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_call",
            params: [{ to: USDC_CONTRACT, data }, "latest"],
            id: 1,
          }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.result || json.result === "0x") {
          setPoolBalance(0);
        } else {
          setPoolBalance(parseInt(json.result, 16) / 1_000_000);
        }
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
  }, [contractAddress]);

  return poolBalance;
}
