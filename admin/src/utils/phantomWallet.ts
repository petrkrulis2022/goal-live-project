/**
 * phantomWallet — thin wrapper around window.solana (Phantom browser extension).
 *
 * Deliberately import-free (no @solana/web3.js) so this can be used anywhere
 * without triggering the heavy Solana bundle. The caller is responsible for
 * constructing Connection / Transaction objects.
 */

import type { Connection, Transaction } from "@solana/web3.js";

// ─── Phantom window type ──────────────────────────────────────────────────────
interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string; toBytes(): Uint8Array } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{
    publicKey: { toString(): string; toBytes(): Uint8Array };
  }>;
  disconnect(): Promise<void>;
  signTransaction(tx: Transaction): Promise<Transaction>;
  signAllTransactions(txs: Transaction[]): Promise<Transaction[]>;
  signAndSendTransaction(
    tx: Transaction,
    opts?: { skipPreflight?: boolean },
  ): Promise<{ signature: string }>;
  request(args: { method: string; params?: unknown }): Promise<unknown>;
}

interface PhantomWindow extends Window {
  solana?: PhantomProvider;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPhantom(): PhantomProvider {
  const w = window as unknown as PhantomWindow;
  if (!w.solana?.isPhantom) {
    throw new Error(
      "Phantom wallet not detected. Please install the Phantom browser extension.",
    );
  }
  return w.solana;
}

export function isPhantomInstalled(): boolean {
  try {
    const w = window as unknown as PhantomWindow;
    return !!w.solana?.isPhantom;
  } catch {
    return false;
  }
}

/** Connect Phantom and return the base58 public key string. */
export async function connectPhantom(): Promise<string> {
  const phantom = getPhantom();
  const response = await phantom.connect();
  return response.publicKey.toString();
}

/** Return the currently connected Phantom public key (null if disconnected). */
export function getPhantomPublicKey(): string | null {
  try {
    const w = window as unknown as PhantomWindow;
    return w.solana?.publicKey?.toString() ?? null;
  } catch {
    return null;
  }
}

/** Disconnect Phantom. */
export async function disconnectPhantom(): Promise<void> {
  const w = window as unknown as PhantomWindow;
  if (w.solana?.disconnect) await w.solana.disconnect();
}

/**
 * Sign and send a transaction via Phantom.
 * Returns the transaction signature (base58).
 */
export async function signAndSendTransaction(
  connection: Connection,
  tx: Transaction,
): Promise<string> {
  const phantom = getPhantom();

  // Use Phantom's signAndSendTransaction if available (preferred)
  if (phantom.signAndSendTransaction) {
    const { signature } = await phantom.signAndSendTransaction(tx);
    return signature;
  }

  // Fallback: sign then send
  const signed = await phantom.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  return sig;
}
