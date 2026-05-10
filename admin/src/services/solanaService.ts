/**
 * solanaService — GoalLiveBetting match-pool management on Solana Devnet.
 *
 * Architecture (no custom Anchor program required):
 *   - "Deploy contract" = derive a deterministic pool public key from the match
 *     ID and save it as the contract_address in Supabase.  The pool address is
 *     a valid Solana devnet address derived via SHA-256(adminPubkey + matchId).
 *   - "Fund pool"       = SPL transfer of dev USDC from the admin wallet
 *     (Phantom) to the pool's associated token account.
 *   - Settlement is handled server-side (edge function) — no on-chain program
 *     call needed from the admin UI.
 *
 * When a real Anchor program exists:
 *   Replace `derivePoolAddress` with `PublicKey.findProgramAddressSync` using
 *   the program ID, and replace `fundPoolTx` with the program's `fundPool`
 *   instruction.
 *
 * Dev USDC mint (Solana devnet):
 *   Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
 * SOL is used for tx fees only.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import {
  connectPhantom,
  getPhantomPublicKey,
  signAndSendTransaction,
} from "../utils/phantomWallet";

// ─── Constants ────────────────────────────────────────────────────────────────

export const SOLANA_DEVNET_RPC =
  (import.meta.env.VITE_SOLANA_DEVNET_RPC as string | undefined) ??
  "https://api.devnet.solana.com";

export const SOLANA_DEVNET_USDC_MINT =
  (import.meta.env.VITE_SOLANA_DEVNET_USDC_MINT as string | undefined) ??
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const SOLANA_USDC_DECIMALS = 6;

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
   * Fund the match pool — transfer dev USDC from admin to pool ATA.
   *
   * @param matchId    — the external match ID
   * @param amountUsdc — amount in USDC units (e.g. 10.5)
   * @returns transaction signature
   */
  async fundPool(matchId: string, amountUsdc: number): Promise<string> {
    let adminPubkeyStr = getPhantomPublicKey();
    if (!adminPubkeyStr) {
      adminPubkeyStr = await connectPhantom();
    }
    const adminPubkey = new PublicKey(adminPubkeyStr);
    const connection = getConnection();
    const usdcMint = new PublicKey(SOLANA_DEVNET_USDC_MINT);

    const poolAddressStr =
      getStoredMatchPoolAddress(matchId) ??
      (await this.deployContract(matchId));
    const poolAddress = new PublicKey(poolAddressStr);

    // Admin USDC ATA (source) and pool USDC ATA (destination).
    const adminUsdcAta = await getAssociatedTokenAddress(
      usdcMint,
      adminPubkey,
      true,
    );
    const poolUsdcAta = await getAssociatedTokenAddress(
      usdcMint,
      poolAddress,
      true,
    );

    const rawAmount = Math.round(amountUsdc * 10 ** SOLANA_USDC_DECIMALS);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
      throw new Error("Invalid USDC amount. Enter a positive value.");
    }

    const instructions = [];
    const poolAtaInfo = await connection.getAccountInfo(poolUsdcAta);
    if (!poolAtaInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          adminPubkey,
          poolUsdcAta,
          poolAddress,
          usdcMint,
        ),
      );
    }
    instructions.push(
      createTransferCheckedInstruction(
        adminUsdcAta,
        usdcMint,
        poolUsdcAta,
        adminPubkey,
        BigInt(rawAmount),
        SOLANA_USDC_DECIMALS,
      ),
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();

    const tx = new Transaction({
      feePayer: adminPubkey,
      recentBlockhash: blockhash,
    });
    for (const ix of instructions) tx.add(ix);

    const sig = await signAndSendTransaction(connection, tx);
    console.log(
      "[solanaService] funded pool with",
      amountUsdc,
      "USDC-dev, sig:",
      sig,
    );

    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return sig;
  },

  /** Get the pool USDC-dev balance for the pool owner address. */
  async getPoolBalance(poolAddressStr: string): Promise<number> {
    const connection = getConnection();
    const poolAddress = new PublicKey(poolAddressStr);
    const usdcMint = new PublicKey(SOLANA_DEVNET_USDC_MINT);
    const poolUsdcAta = await getAssociatedTokenAddress(
      usdcMint,
      poolAddress,
      true,
    );
    const info = await connection
      .getTokenAccountBalance(poolUsdcAta)
      .catch(() => null);
    return info?.value?.uiAmount ?? 0;
  },

  /**
   * Emergency withdraw — transfer pool USDC back to admin.
   * (Requires program authority in production; on devnet the pool account
   * owner is deterministic and not signable directly, so we can't drain it
   * without a custom program.
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
