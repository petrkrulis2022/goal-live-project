import { useState, useEffect } from "react";
import { Interface } from "ethers";

const SEPOLIA_RPC = "https://sepolia.drpc.org";
const POLL_MS = 15_000; // refresh every 15 s (balances change on settle)

const IFACE = new Interface([
  // V1: (isActive, isSettled, balancesSettled, poolSize, createdAt, finalOutcome, homeGoals, awayGoals)
  "function matches(string) view returns (bool, bool, bool, uint256, uint256, uint8, uint8, uint8)",
  "function matchBalance(string, address) view returns (uint256)",
  "function hasWithdrawn(string, address) view returns (bool)",
]);

export interface MatchBalanceInfo {
  /** USDC the user deposited into this match pool (human units, 6-decimal) */
  deposit: number;
  /** Current matchBalance — equals deposit until settleUserBalances, then final payout */
  balance: number;
  /** True once relayer has called settleUserBalances — user can now withdraw */
  balancesSettled: boolean;
  /** True after the user has already called withdraw() */
  withdrawn: boolean;
}

async function ethCall(
  rpc: string,
  to: string,
  data: string,
): Promise<string | null> {
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to, data }, "latest"],
        id: 1,
      }),
    });
    const json = await res.json();
    if (!json.result || json.result === "0x") return null;
    return json.result as string;
  } catch {
    return null;
  }
}

/**
 * Polls the on-chain match balance and settlement state for a specific user.
 *
 * Returns null while loading or when any required param is missing.
 *
 * @param contractAddress  The GoalLiveBetting singleton address
 * @param matchId          The Goalserve external_match_id (on-chain key)
 * @param userAddress      The bettor's wallet address
 */
export function useMatchBalance(
  contractAddress: string | null | undefined,
  matchId: string | null | undefined,
  userAddress: string | null | undefined,
): MatchBalanceInfo | null {
  const [info, setInfo] = useState<MatchBalanceInfo | null>(null);

  useEffect(() => {
    if (!contractAddress || !matchId || !userAddress) {
      setInfo(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        // Fire all three reads in parallel
        const [matchRaw, balanceRaw, withdrawnRaw] = await Promise.all([
          ethCall(
            SEPOLIA_RPC,
            contractAddress!,
            IFACE.encodeFunctionData("matches", [matchId]),
          ),
          ethCall(
            SEPOLIA_RPC,
            contractAddress!,
            IFACE.encodeFunctionData("matchBalance", [matchId, userAddress]),
          ),
          ethCall(
            SEPOLIA_RPC,
            contractAddress!,
            IFACE.encodeFunctionData("hasWithdrawn", [matchId, userAddress]),
          ),
        ]);

        if (cancelled) return;

        // balancesSettled is index 2 in the matches() tuple
        let balancesSettled = false;
        if (matchRaw) {
          const decoded = IFACE.decodeFunctionResult("matches", matchRaw);
          balancesSettled = decoded[2] as boolean;
        }

        const balance = balanceRaw
          ? Number(
              IFACE.decodeFunctionResult(
                "matchBalance",
                balanceRaw,
              )[0] as bigint,
            ) / 1_000_000
          : 0;

        const withdrawn = withdrawnRaw
          ? Boolean(IFACE.decodeFunctionResult("hasWithdrawn", withdrawnRaw)[0])
          : false;

        // userDeposit would ideally be read separately, but for the display we
        // can infer it: before settleUserBalances, balance === deposit.
        // After settlement balance is the payout. We only need "deposit" for
        // showing "you deposited X" pre-settlement, which is == balance at that time.
        setInfo({ deposit: balance, balance, balancesSettled, withdrawn });
      } catch {
        // silently ignore — stale value stays displayed
      }
    }

    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [contractAddress, matchId, userAddress]);

  return info;
}
