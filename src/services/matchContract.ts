import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toBase58: () => string };
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
  signAndSendTransaction: (
    tx: Transaction,
  ) => Promise<{ signature: string } | string>;
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

const SOLANA_DEVNET_RPC =
  (import.meta.env.VITE_SOLANA_DEVNET_RPC as string | undefined) ??
  "https://api.devnet.solana.com";
const SOLANA_DEVNET_USDC_MINT =
  (import.meta.env.VITE_SOLANA_DEVNET_USDC_MINT as string | undefined) ??
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const USDC_DECIMALS = 6;

let solReqCounter = 0;
const solPending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function toBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (bytes.length === 0) return "";
  const digits = [0];
  for (let i = 0; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      const x = digits[j] * 256 + carry;
      digits[j] = x % 58;
      carry = (x / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) out += alphabet[0];
  for (let i = digits.length - 1; i >= 0; i--) out += alphabet[digits[i]];
  return out;
}

function solBridgeRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reqId = ++solReqCounter;
    solPending.set(reqId, { resolve, reject });
    window.postMessage({ type: "GL_SOL_REQUEST", reqId, method, params }, "*");
    setTimeout(() => {
      if (solPending.has(reqId)) {
        solPending.delete(reqId);
        reject(new Error(`Phantom bridge request timed out: ${method}`));
      }
    }, 30_000);
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;
    if (event.data.type !== "GL_SOL_RESPONSE") return;

    const { reqId, result, error, code } = event.data as {
      reqId: number;
      result?: unknown;
      error?: string;
      code?: number;
    };
    const pending = solPending.get(reqId);
    if (!pending) return;
    solPending.delete(reqId);
    if (error) {
      const err = new Error(error) as Error & { code?: number };
      if (code !== undefined) err.code = code;
      pending.reject(err);
    } else {
      pending.resolve(result);
    }
  });
}

function getConnection(): Connection {
  return new Connection(SOLANA_DEVNET_RPC, "confirmed");
}

function getPhantom(): PhantomProvider {
  const provider = window.phantom?.solana ?? window.solana;
  if (!provider?.isPhantom) {
    throw new Error("Phantom not detected. Install Phantom and reload.");
  }
  return provider;
}

async function getConnectedOwner(): Promise<PublicKey> {
  try {
    const resp = (await solBridgeRequest("connect")) as { address?: string };
    if (resp?.address) return new PublicKey(resp.address);
  } catch {
    // fallback below
  }
  const phantom = getPhantom();
  if (phantom.publicKey) return new PublicKey(phantom.publicKey.toBase58());
  const resp = await phantom.connect();
  return new PublicKey(resp.publicKey.toBase58());
}

export const matchContractService = {
  /**
   * User withdraws their settled payout. Requires balancesSettled == true.
   * Returns the tx hash.
   */
  async withdraw(contractAddress: string, matchId: string): Promise<string> {
    void contractAddress;
    void matchId;
    throw new Error(
      "Post-match claim is handled by backend settlement on Solana in this branch.",
    );
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
    if (!contractAddress) {
      throw new Error("Match pool address is missing.");
    }
    if (!matchId) {
      throw new Error("Match id is missing.");
    }
    if (!Number.isFinite(amountUsdc) || amountUsdc <= 0) {
      throw new Error("Invalid USDC amount.");
    }

    const connection = getConnection();
    const owner = await getConnectedOwner();
    const pool = new PublicKey(contractAddress);
    const mint = new PublicKey(SOLANA_DEVNET_USDC_MINT);

    const ownerAta = await getAssociatedTokenAddress(mint, owner, true);
    const poolAta = await getAssociatedTokenAddress(mint, pool, true);

    const tx = new Transaction();
    const poolAtaInfo = await connection.getAccountInfo(poolAta);
    if (!poolAtaInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(owner, poolAta, pool, mint),
      );
    }

    const rawAmount = BigInt(Math.round(amountUsdc * 10 ** USDC_DECIMALS));
    tx.add(
      createTransferCheckedInstruction(
        ownerAta,
        mint,
        poolAta,
        owner,
        rawAmount,
        USDC_DECIMALS,
      ),
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.feePayer = owner;
    tx.recentBlockhash = blockhash;

    let signature: string;
    let bridgeErrMsg = "";
    try {
      const serializedBytes = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const serialized = toBase64(serializedBytes);
      const serializedBase58 = toBase58(serializedBytes);
      const bridgeRes = (await solBridgeRequest("signAndSendTransaction", {
        serializedTransaction: serialized,
        serializedTransactionBase58: serializedBase58,
      })) as { signature?: string };
      if (!bridgeRes?.signature) throw new Error("Missing signature");
      signature = bridgeRes.signature;
    } catch (e) {
      bridgeErrMsg = e instanceof Error ? e.message : String(e);
      // Fallback for non-isolated contexts where Phantom provider is directly visible.
      const provider = window.phantom?.solana ?? window.solana;
      if (!provider?.isPhantom || !provider.signAndSendTransaction) {
        throw new Error(
          `Phantom bridge failed: ${bridgeErrMsg || "unknown error"}`,
        );
      }
      const res = await provider.signAndSendTransaction(tx);
      signature = typeof res === "string" ? res : res.signature;
    }

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return signature;
  },
};
