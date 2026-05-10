import {
  Connection,
  PublicKey,
  Transaction,
  type Commitment,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import type { IWalletService, WalletState } from "../../types/services.types";

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toBase58: () => string };
  connect: () => Promise<{ publicKey: { toBase58: () => string } }>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAndSendTransaction?: (
    tx: Transaction,
  ) => Promise<{ signature: string } | string>;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

const SOLANA_DEVNET_RPC =
  (import.meta.env.VITE_SOLANA_DEVNET_RPC as string | undefined) ??
  "https://api.devnet.solana.com";
const SOLANA_DEVNET_USDC_MINT =
  (import.meta.env.VITE_SOLANA_DEVNET_USDC_MINT as string | undefined) ??
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const USDC_DECIMALS = 6;
const PLAYER_ADDR_KEY = "gl_player_address";

function getConnection(commitment: Commitment = "confirmed"): Connection {
  return new Connection(SOLANA_DEVNET_RPC, commitment);
}

function getPhantom(): PhantomProvider {
  if (!window.solana?.isPhantom) {
    throw new Error("Phantom not detected - install Phantom and reload.");
  }
  return window.solana;
}

function loadPlayerAddress(): string {
  try {
    return localStorage.getItem(PLAYER_ADDR_KEY) ?? "";
  } catch {
    return "";
  }
}

function savePlayerAddress(addr: string) {
  localStorage.setItem(PLAYER_ADDR_KEY, addr);
}

let solReqCounter = 0;
const solPending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

function solRequest(method: string, params?: unknown): Promise<unknown> {
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

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "GL_SOL_RESPONSE") {
      const { reqId, result, error, code } = event.data;
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
    }
  });
}

class WalletBridgeServiceSolana implements IWalletService {
  private state: WalletState | null = null;
  private playerAddress: string = loadPlayerAddress();
  private listeners: Array<(s: WalletState | null) => void> = [];

  private emit(s: WalletState | null) {
    this.state = s;
    this.listeners.forEach((cb) => cb(s));
  }

  private onDisconnect = () => {
    this.emit(null);
  };

  async fetchUsdc(ownerAddress: string): Promise<number> {
    try {
      const connection = getConnection();
      const owner = new PublicKey(ownerAddress);
      const mint = new PublicKey(SOLANA_DEVNET_USDC_MINT);
      const ata = await getAssociatedTokenAddress(mint, owner, true);
      const bal = await connection.getTokenAccountBalance(ata);
      return Number(bal.value.uiAmount ?? 0);
    } catch {
      return 0;
    }
  }

  async connect(): Promise<WalletState> {
    let address = "";

    // Preferred path for extension runtime: page-world bridge
    try {
      const resp = (await solRequest("connect")) as { address?: string };
      address = resp?.address ?? "";
    } catch {
      // Fallback for contexts where window.solana is directly accessible
      const phantom = getPhantom();
      const resp = await phantom.connect();
      address = resp.publicKey.toBase58();
      phantom.on("disconnect", this.onDisconnect);
    }

    if (!address) {
      throw new Error("Phantom connected but no public key was returned.");
    }

    const balance = await this.fetchUsdc(address);
    const ws: WalletState = {
      address,
      balance,
      inAppBalance: balance,
      playerAddress: this.playerAddress || undefined,
      connected: true,
    };
    this.emit(ws);
    return ws;
  }

  disconnect(): void {
    window.solana?.removeListener?.("disconnect", this.onDisconnect);
    this.emit(null);
  }

  getState(): WalletState | null {
    return this.state;
  }

  async getBalance(): Promise<number> {
    if (!this.state) return 0;
    const balance = await this.fetchUsdc(this.state.address);
    this.emit({ ...this.state, balance, inAppBalance: balance });
    return balance;
  }

  async deductBalance(_amount: number): Promise<void> {
    await this.getBalance();
  }

  async addBalance(_amount: number): Promise<void> {
    await this.getBalance();
  }

  async topUp(_amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    const address = this.state.address;
    const snapshotBalance = this.state.balance;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const confirmed = await this.fetchUsdc(address);
      if (confirmed !== snapshotBalance) {
        this.emit({
          ...this.state!,
          balance: confirmed,
          inAppBalance: confirmed,
        });
      } else if (attempts < 30) {
        setTimeout(poll, 5_000);
      }
    };
    setTimeout(poll, 5_000);
    return address;
  }

  async withdraw(amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    if (amount <= 0) throw new Error("Amount must be greater than 0");
    if (amount > this.state.balance) {
      throw new Error(
        `Insufficient balance ($${this.state.balance.toFixed(2)})`,
      );
    }
    if (!this.playerAddress) {
      throw new Error(
        "Player wallet address not set - enter it in the Withdraw modal",
      );
    }

    const phantom = getPhantom();
    const connection = getConnection();
    const owner = new PublicKey(this.state.address);
    const recipientOwner = new PublicKey(this.playerAddress);
    const mint = new PublicKey(SOLANA_DEVNET_USDC_MINT);

    const fromAta = await getAssociatedTokenAddress(mint, owner, true);
    const toAta = await getAssociatedTokenAddress(mint, recipientOwner, true);

    const tx = new Transaction();
    const toInfo = await connection.getAccountInfo(toAta);
    if (!toInfo) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          owner,
          toAta,
          recipientOwner,
          mint,
        ),
      );
    }

    const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    tx.add(
      createTransferCheckedInstruction(
        fromAta,
        mint,
        toAta,
        owner,
        rawAmount,
        USDC_DECIMALS,
      ),
    );

    tx.feePayer = owner;
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    let signature: string;
    try {
      const serialized = toBase64(
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
      );
      const bridgeRes = (await solRequest("signAndSendTransaction", {
        serializedTransaction: serialized,
      })) as { signature?: string };
      if (!bridgeRes?.signature) throw new Error("Missing signature");
      signature = bridgeRes.signature;
    } catch {
      if (phantom.signAndSendTransaction) {
        const res = await phantom.signAndSendTransaction(tx);
        signature = typeof res === "string" ? res : res.signature;
      } else {
        const signed = await phantom.signTransaction(tx);
        signature = await connection.sendRawTransaction(signed.serialize());
      }
    }

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    await this.getBalance();
    return signature;
  }

  setPlayerAddress(address: string): void {
    this.playerAddress = address.trim();
    savePlayerAddress(this.playerAddress);
    if (this.state) {
      this.emit({
        ...this.state,
        playerAddress: this.playerAddress || undefined,
      });
    }
  }

  onStateChange(cb: (state: WalletState | null) => void): () => void {
    this.listeners.push(cb);
    cb(this.state);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb);
    };
  }
}

export const walletBridgeServiceSolana = new WalletBridgeServiceSolana();
