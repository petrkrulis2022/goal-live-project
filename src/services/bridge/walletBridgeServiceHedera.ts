// ─────────────────────────────────────────────────────────────────────────────
//  Wallet Bridge Service — Hedera Testnet
//  Talks to MetaMask via the injected.js page-world bridge (postMessage).
//  Content-script world cannot see window.ethereum directly — this bridges it.
//
//  This is the Hedera-testnet version of walletBridgeService.ts.
//  Network: Hedera Testnet (Chain ID 296 / 0x128), HBAR for gas, USDC for bets.
//  Keep walletBridgeService.ts (Sepolia/CRE) unchanged — this is a NEW service.
// ─────────────────────────────────────────────────────────────────────────────
import type { IWalletService, WalletState } from "../../types/services.types";

// Hedera Testnet — Chain ID 296 (0x128)
const HEDERA_TESTNET_CHAIN_ID = "0x128";
// USDd stablecoin on Hedera Testnet (0x00000000000000000000000000000000006e169c)
const USDC_CONTRACT = "0x00000000000000000000000000000000006e169c";
const USDC_DECIMALS = 6;
const PLAYER_ADDR_KEY = "gl_hedera_player_address";

// Clear any stale fake-balance keys from previous builds
try {
  localStorage.removeItem("gl_inapp_balance");
  localStorage.removeItem("gl_last_chain_balance");
} catch {
  /* ignore */
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

let reqCounter = 0;
const pending = new Map<
  number,
  { resolve: (v: unknown) => void; reject: (e: Error) => void }
>();

// ── postMessage transport ─────────────────────────────────────────────────────

function ethRequest(method: string, params?: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reqId = ++reqCounter;
    pending.set(reqId, { resolve, reject });
    window.postMessage({ type: "GL_ETH_REQUEST", reqId, method, params }, "*");
    // 30 s timeout
    setTimeout(() => {
      if (pending.has(reqId)) {
        pending.delete(reqId);
        reject(new Error(`MetaMask request timed out: ${method}`));
      }
    }, 30_000);
  });
}

// Listen for responses + events from injected.js
if (typeof window !== "undefined") {
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data) return;

    if (event.data.type === "GL_ETH_RESPONSE") {
      const { reqId, result, error, code } = event.data;
      const p = pending.get(reqId);
      if (!p) return;
      pending.delete(reqId);
      if (error) {
        const err = new Error(error) as Error & { code?: number };
        if (code !== undefined) err.code = code;
        p.reject(err);
      } else {
        p.resolve(result);
      }
    }

    if (event.data.type === "GL_ETH_EVENT") {
      const { event: evtName, data } = event.data;
      if (evtName === "accountsChanged") {
        walletBridgeServiceHedera["onAccountsChangedBridge"](data as string[]);
      }
    }
  });
}

// ── Helper encoders ───────────────────────────────────────────────────────────

function balanceOfData(addr: string) {
  return "0x70a08231" + addr.replace("0x", "").padStart(64, "0");
}
function transferData(to: string, rawAmount: bigint) {
  return (
    "0xa9059cbb" +
    to.replace("0x", "").padStart(64, "0") +
    rawAmount.toString(16).padStart(64, "0")
  );
}

// ── Service class ─────────────────────────────────────────────────────────────

class WalletBridgeServiceHedera implements IWalletService {
  private state: WalletState | null = null;
  private playerAddress: string = loadPlayerAddress();
  private listeners: Array<(s: WalletState | null) => void> = [];

  private emit(s: WalletState | null) {
    this.state = s;
    this.listeners.forEach((cb) => cb(s));
  }

  /** Called when MetaMask fires accountsChanged via the bridge */
  private async onAccountsChangedBridge(accounts: string[]) {
    if (!accounts.length) {
      this.emit(null);
    } else {
      const balance = await this.fetchUsdc(accounts[0]);
      this.emit({
        address: accounts[0],
        balance,
        inAppBalance: balance,
        playerAddress: this.playerAddress || undefined,
        connected: true,
      });
    }
  }

  private async ensureHederaTestnet(): Promise<void> {
    const chainId = (await ethRequest("eth_chainId")) as string;
    if (chainId.toLowerCase() !== HEDERA_TESTNET_CHAIN_ID) {
      try {
        await ethRequest("wallet_switchEthereumChain", [
          { chainId: HEDERA_TESTNET_CHAIN_ID },
        ]);
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 4902) {
          await ethRequest("wallet_addEthereumChain", [
            {
              chainId: HEDERA_TESTNET_CHAIN_ID,
              chainName: "Hedera Testnet",
              nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
              rpcUrls: ["https://testnet.hashio.io/api"],
              blockExplorerUrls: ["https://hashscan.io/testnet/"],
            },
          ]);
        } else {
          throw err;
        }
      }
    }
  }

  async fetchUsdc(address: string): Promise<number> {
    try {
      await this.ensureHederaTestnet();
      const hex = (await ethRequest("eth_call", [
        { to: USDC_CONTRACT, data: balanceOfData(address) },
        "latest",
      ])) as string;
      return Number(BigInt(hex === "0x" ? "0x0" : hex)) / 10 ** USDC_DECIMALS;
    } catch {
      return 0;
    }
  }

  // ── IWalletService ────────────────────────────────────────────────────────

  async connect(): Promise<WalletState> {
    await this.ensureHederaTestnet();
    const accounts = (await ethRequest("eth_requestAccounts")) as string[];
    if (!accounts.length) throw new Error("No accounts returned from MetaMask");
    const address = accounts[0];
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
    if (amount > this.state.balance)
      throw new Error(
        `Insufficient balance ($${this.state.balance.toFixed(2)})`,
      );
    if (!this.playerAddress)
      throw new Error(
        "Player wallet address not set — enter it in the Withdraw modal",
      );

    await this.ensureHederaTestnet();

    const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    const data = transferData(this.playerAddress, rawAmount);
    const txHash = (await ethRequest("eth_sendTransaction", [
      { from: this.state.address, to: USDC_CONTRACT, data },
    ])) as string;

    // Optimistic deduction while waiting for chain confirmation
    const optimistic = Math.max(
      0,
      Math.round((this.state.balance - amount) * 100) / 100,
    );
    this.emit({ ...this.state, balance: optimistic, inAppBalance: optimistic });

    // Poll for on-chain confirmation
    const snapBalance = this.state.balance;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const confirmed = await this.fetchUsdc(this.state!.address);
      if (confirmed < snapBalance || attempts >= 10) {
        this.emit({
          ...this.state!,
          balance: confirmed,
          inAppBalance: confirmed,
        });
      } else {
        setTimeout(poll, 3_000);
      }
    };
    setTimeout(poll, 3_000);

    return txHash;
  }

  setPlayerAddress(address: string): void {
    this.playerAddress = address;
    savePlayerAddress(address);
    if (this.state) {
      this.emit({ ...this.state, playerAddress: address });
    }
  }

  onStateChange(cb: (state: WalletState | null) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
}

export const walletBridgeServiceHedera = new WalletBridgeServiceHedera();
