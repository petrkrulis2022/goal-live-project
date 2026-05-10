/**
 * solanaService — GoalLiveBetting match-pool management on Solana Devnet.
 *
 * Architecture (no custom Anchor program required):
 *   - "Deploy contract" = derive a deterministic pool public key from the match
 *     ID and save it as the contract_address in Supabase.  The pool address is
 *     a valid Solana devnet address derived via SHA-256(adminPubkey + matchId).
 *   - "Fund pool"       = SystemProgram.transfer SOL from the admin wallet
 *     (Phantom) to the pool address.
 *   - Settlement is handled server-side (edge function) — no on-chain program
 *     call needed from the admin UI.
 *
 * When a real Anchor program exists:
 *   Replace `derivePoolAddress` with `PublicKey.findProgramAddressSync` using
 *   the program ID, and replace `fundPoolTx` with the program's `fundPool`
 *   instruction.
 *
 * USDC on Devnet: devnet uses fake SPL tokens; we use SOL as the pool currency
 * for now (1 SOL = 1 "unit" in devnet testing).  Switch to devUSDC once a
 * faucet address is configured via VITE_SOLANA_DEVNET_USDC_MINT.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  connectPhantom,
  getPhantomPublicKey,
  signAndSendTransaction,
} from "../utils/phantomWallet";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SOLANA_DEVNET_RPC =
  (import.meta.env.VITE_SOLANA_DEVNET_RPC as string | undefined) ??
  "https://api.devnet.solana.com";

const POOL_KEY = "gl_solana_pool_address";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getConnection(): Connection {
  return new Connection(SOLANA_DEVNET_RPC, "confirmed");
}

/**
 * Derive a deterministic "pool address" for a match.
 * Uses the admin public key + match ID bytes as seeds via
 * PublicKey.createWithSeed — no custom program needed, valid on-chain address.
 */
async function derivePoolAddress(
  adminPubkey: PublicKey,
  matchId: string,
): Promise<PublicKey> {
  // createWithSeed: fromPublicKey, seed (≤32 chars), programId
  const seed = matchId.slice(0, 32).padEnd(32, "0");
  return PublicKey.createWithSeed(adminPubkey, seed, SystemProgram.programId);
}

function getStoredPoolAddress(): string | null {
  return (
    (import.meta.env.VITE_SOLANA_CONTRACT_ADDRESS as string | undefined) ||
    localStorage.getItem(POOL_KEY) ||
    null
  );
}

function savePoolAddress(addr: string): void {
  localStorage.setItem(POOL_KEY, addr);
}

// Per-match storage key so the service can handle multiple matches
function matchPoolKey(matchId: string): string {
  return `${POOL_KEY}_${matchId}`;
}
function getStoredMatchPoolAddress(matchId: string): string | null {
  return localStorage.getItem(matchPoolKey(matchId)) ?? null;
}
function saveMatchPoolAddress(matchId: string, addr: string): void {
  localStorage.setItem(matchPoolKey(matchId), addr);
  // Also save as the latest so getContractAddress() returns it
  savePoolAddress(addr);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const solanaService = {
  /** Return the latest stored pool address (or null). */
  getContractAddress(): string | null {
    return getStoredPoolAddress();
  },

  /**
   * "Deploy" the match pool on Solana Devnet.
   *
   * Derives a deterministic pool address from the admin's public key and the
   * match ID.  Transfers minimum-rent-exemption lamports to that address so it
   * exists on-chain.  Saves the address and returns it.
   */
  async deployContract(matchId: string): Promise<string> {
    // Ensure Phantom is connected
    let adminPubkeyStr = getPhantomPublicKey();
    if (!adminPubkeyStr) {
      adminPubkeyStr = await connectPhantom();
    }
    const adminPubkey = new PublicKey(adminPubkeyStr);
    const connection = getConnection();

    // Check if already deployed for this match
    const existing = getStoredMatchPoolAddress(matchId);
    if (existing) {
      console.log("[solanaService] reusing pool address", existing);
      return existing;
    }

    // Derive pool address
    const poolAddress = await derivePoolAddress(adminPubkey, matchId);
    const poolAddressStr = poolAddress.toBase58();
    console.log("[solanaService] derived pool address", poolAddressStr);

    // Check if the account already has lamports (already funded on a previous run)
    const existingBalance = await connection.getBalance(poolAddress);
    if (existingBalance === 0) {
      // Fund the account with minimum rent-exempt balance so it exists on-chain
      const minRent = await connection.getMinimumBalanceForRentExemption(0); // 0 data bytes

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      const tx = new Transaction({
        feePayer: adminPubkey,
        recentBlockhash: blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: adminPubkey,
          toPubkey: poolAddress,
          lamports: minRent,
        }),
      );

      const sig = await signAndSendTransaction(connection, tx);
      console.log("[solanaService] pool account created, sig:", sig);

      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        "confirmed",
      );
    } else {
      console.log(
        "[solanaService] pool address already has",
        existingBalance,
        "lamports",
      );
    }

    saveMatchPoolAddress(matchId, poolAddressStr);
    return poolAddressStr;
  },

  /**
   * Fund the match pool — transfer SOL from admin wallet to the pool address.
   *
   * @param matchId   — the external match ID
   * @param amountSol — amount in SOL (e.g. 0.1 = 0.1 SOL on devnet)
   * @returns transaction signature
   */
  async fundPool(matchId: string, amountSol: number): Promise<string> {
    let adminPubkeyStr = getPhantomPublicKey();
    if (!adminPubkeyStr) {
      adminPubkeyStr = await connectPhantom();
    }
    const adminPubkey = new PublicKey(adminPubkeyStr);
    const connection = getConnection();

    const poolAddressStr =
      getStoredMatchPoolAddress(matchId) ??
      (await this.deployContract(matchId));
    const poolAddress = new PublicKey(poolAddressStr);

    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: adminPubkey,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: adminPubkey,
        toPubkey: poolAddress,
        lamports,
      }),
    );

    const sig = await signAndSendTransaction(connection, tx);
    console.log(
      "[solanaService] funded pool with",
      amountSol,
      "SOL, sig:",
      sig,
    );

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return sig;
  },

  /** Get the SOL balance of a pool address (in SOL). */
  async getPoolBalance(poolAddressStr: string): Promise<number> {
    const connection = getConnection();
    const poolAddress = new PublicKey(poolAddressStr);
    const lamports = await connection.getBalance(poolAddress);
    return lamports / LAMPORTS_PER_SOL;
  },

  /**
   * Emergency withdraw — transfer all SOL from pool back to admin.
   * (Requires program authority in production; on devnet the pool account
   * is owned by System Program so we can't drain it without a custom program.
   * This returns a helpful message for now.)
   */
  async emergencyWithdrawPool(_matchId: string): Promise<string> {
    throw new Error(
      "Emergency withdraw requires a deployed Anchor program. " +
        "On Solana devnet, use the Solana Explorer to manually track the pool account. " +
        "Pool address: " +
        (getStoredPoolAddress() ?? "unknown"),
    );
  },
};
