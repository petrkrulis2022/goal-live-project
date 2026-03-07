/**
 * Minimal on-chain interactions for the user-facing extension frontend.
 * Only the functions users sign: fundMatch() and withdraw().
 *
 * Admin/relayer calls (settleUserBalances, recordBet, etc.) live in
 * admin/src/services/contractService.ts.
 *
 * NOTE: Content scripts run in an isolated world where window.ethereum is
 * NOT available. We bridge via the same GL_ETH_REQUEST postMessage channel
 * that walletBridgeService uses (injected.js runs in the page world).
 */
import { ethers } from "ethers";

const ABI = [
  "function fundMatch(string matchId, uint256 amount)",
  "function withdraw(string matchId)",
];

const USDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// ── postMessage bridge (mirrors walletBridgeService) ─────────────────────────
let _reqCounter = 0;
const _pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type === "GL_ETH_RESPONSE") {
      const { reqId, result, error, code } = event.data as {
        reqId: number;
        result?: unknown;
        error?: string;
        code?: number;
      };
      const p = _pending.get(reqId);
      if (!p) return;
      _pending.delete(reqId);
      if (error) {
        const err = new Error(error) as Error & { code?: number };
        if (code !== undefined) err.code = code;
        p.reject(err);
      } else {
        p.resolve(result);
      }
    }
  });
}

function _bridgeRequest(method: string, params?: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reqId = ++_reqCounter;
    _pending.set(reqId, { resolve, reject });
    window.postMessage({ type: "GL_ETH_REQUEST", reqId, method, params }, "*");
    setTimeout(() => {
      if (_pending.has(reqId)) {
        _pending.delete(reqId);
        reject(new Error(`MetaMask request timed out: ${method}`));
      }
    }, 30_000);
  });
}

/** EIP-1193 wrapper around the postMessage bridge. */
const _bridgeEip1193 = {
  request: ({ method, params }: { method: string; params?: unknown[] }) =>
    _bridgeRequest(method, params),
};

function getProvider(): ethers.BrowserProvider {
  // In a regular page (admin panel), window.ethereum is available directly.
  // In the content-script isolated world it is undefined — use the bridge.
  if (
    typeof window !== "undefined" &&
    (window as Window & { ethereum?: unknown }).ethereum
  ) {
    return new ethers.BrowserProvider(
      (window as Window & { ethereum: ethers.Eip1193Provider }).ethereum,
    );
  }
  return new ethers.BrowserProvider(
    _bridgeEip1193 as unknown as ethers.Eip1193Provider,
  );
}

async function getSigner() {
  return getProvider().getSigner();
}

export const matchContractService = {
  /**
   * User withdraws their settled payout. Requires balancesSettled == true.
   * Returns the tx hash.
   */
  async withdraw(contractAddress: string, matchId: string): Promise<string> {
    const signer = await getSigner();
    const contract = new ethers.Contract(contractAddress, ABI, signer);
    const tx = await contract.withdraw(matchId);
    await tx.wait();
    return tx.hash as string;
  },

  /**
   * User deposits USDC into a match pool.
   * Approves MAX_UINT once then calls fundMatch.
   * Returns the tx hash.
   */
  async fundMatch(
    contractAddress: string,
    matchId: string,
    amountUsdc: number,
  ): Promise<string> {
    const signer = await getSigner();
    const userAddress = await signer.getAddress();
    const amount = ethers.parseUnits(amountUsdc.toString(), 6);

    const usdc = new ethers.Contract(USDC_SEPOLIA, USDC_ABI, signer);
    const allowance: bigint = await usdc.allowance(
      userAddress,
      contractAddress,
    );
    if (allowance < amount) {
      const approveTx = await usdc.approve(contractAddress, ethers.MaxUint256);
      await approveTx.wait();
    }

    const contract = new ethers.Contract(contractAddress, ABI, signer);
    const tx = await contract.fundMatch(matchId, amount);
    await tx.wait();
    return tx.hash as string;
  },
};
