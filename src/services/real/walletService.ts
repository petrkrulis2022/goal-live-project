// ─────────────────────────────────────────────
//  Real Wallet Service — MetaMask + Sepolia USDC
//  Activated when VITE_USE_REAL_WALLET=true
// ─────────────────────────────────────────────
import type { IWalletService, WalletState } from "../../types/services.types";
import { supabase } from "../../lib/supabase";

// EIP-1193 provider
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, cb: (...args: unknown[]) => void) => void;
      removeListener: (event: string, cb: (...args: unknown[]) => void) => void;
      selectedAddress: string | null;
      isMetaMask?: boolean;
    };
  }
}

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111
// Official Circle USDC on Sepolia — 6 decimals
const USDC_CONTRACT = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDC_DECIMALS = 6;

// Platform escrow address — Phase 1 placeholder.
// Set VITE_PLATFORM_WALLET in .env to your real escrow address.
const PLATFORM_WALLET: string =
  (import.meta.env.VITE_PLATFORM_WALLET as string) ?? "";

const balanceOfData = (addr: string) =>
  "0x70a08231" + addr.replace("0x", "").padStart(64, "0");

const transferData = (to: string, rawAmount: bigint) =>
  "0xa9059cbb" +
  to.replace("0x", "").padStart(64, "0") +
  rawAmount.toString(16).padStart(64, "0");

class RealWalletService implements IWalletService {
  private state: WalletState | null = null;
  private listeners: Array<(s: WalletState | null) => void> = [];

  private emit(s: WalletState | null) {
    this.state = s;
    this.listeners.forEach((cb) => cb(s));
  }

  /** Read in-app balance from player_balances table (total_deposited - total_withdrawn). */
  private async fetchInAppBalance(address: string): Promise<number> {
    const { data } = await supabase
      .from("player_balances")
      .select("total_deposited, total_withdrawn")
      .eq("wallet_address", address.toLowerCase())
      .maybeSingle();
    if (!data) return 0;
    return Math.max(
      0,
      Math.round(
        (Number(data.total_deposited) - Number(data.total_withdrawn)) * 100,
      ) / 100,
    );
  }

  /** Persist a deposit delta into player_balances. */
  private async recordDeposit(address: string, delta: number): Promise<void> {
    // First read current, then upsert with incremented value
    const { data } = await supabase
      .from("player_balances")
      .select("total_deposited")
      .eq("wallet_address", address.toLowerCase())
      .maybeSingle();
    const current = Number(data?.total_deposited ?? 0);
    await supabase.from("player_balances").upsert(
      {
        wallet_address: address.toLowerCase(),
        total_deposited: Math.round((current + delta) * 1e6) / 1e6,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" },
    );
  }

  /** Persist a withdrawal into player_balances. */
  private async recordWithdrawal(
    address: string,
    amount: number,
  ): Promise<void> {
    const { data } = await supabase
      .from("player_balances")
      .select("total_withdrawn")
      .eq("wallet_address", address.toLowerCase())
      .maybeSingle();
    const current = Number(data?.total_withdrawn ?? 0);
    await supabase.from("player_balances").upsert(
      {
        wallet_address: address.toLowerCase(),
        total_withdrawn: Math.round((current + amount) * 1e6) / 1e6,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address" },
    );
  }

  /** Switch MetaMask network to Sepolia. */
  private async ensureSepolia(): Promise<void> {
    if (!window.ethereum) throw new Error("MetaMask not found");
    const chainId = (await window.ethereum.request({
      method: "eth_chainId",
    })) as string;
    if (chainId.toLowerCase() !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch (switchErr: unknown) {
        // Chain not added — add it
        if ((switchErr as { code: number }).code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } else {
          throw switchErr;
        }
      }
    }
  }

  /** Fetch Sepolia USDC balance for an address. Returns display units (not raw). */
  async fetchUsdc(address: string): Promise<number> {
    if (!window.ethereum) return 0;
    try {
      await this.ensureSepolia();
      const hex = (await window.ethereum.request({
        method: "eth_call",
        params: [{ to: USDC_CONTRACT, data: balanceOfData(address) }, "latest"],
      })) as string;
      return Number(BigInt(hex === "0x" ? "0x0" : hex)) / 10 ** USDC_DECIMALS;
    } catch {
      return 0;
    }
  }

  private onAccountsChanged = async (raw: unknown) => {
    const accounts = raw as string[];
    if (!accounts.length) {
      this.emit(null);
    } else {
      const [balance, inAppBalance] = await Promise.all([
        this.fetchUsdc(accounts[0]),
        this.fetchInAppBalance(accounts[0]),
      ]);
      this.emit({
        address: accounts[0],
        balance,
        inAppBalance,
        connected: true,
      });
    }
  };

  // ── IWalletService ────────────────────────────

  async connect(): Promise<WalletState> {
    if (!window.ethereum) {
      throw new Error("MetaMask not detected — install MetaMask and reload.");
    }
    await this.ensureSepolia();
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const address = accounts[0];
    const [balance, inAppBalance] = await Promise.all([
      this.fetchUsdc(address),
      this.fetchInAppBalance(address),
    ]);
    const ws: WalletState = {
      address,
      balance,
      inAppBalance,
      connected: true,
    };
    this.emit(ws);
    window.ethereum.on("accountsChanged", this.onAccountsChanged);
    return ws;
  }

  disconnect(): void {
    window.ethereum?.removeListener("accountsChanged", this.onAccountsChanged);
    this.emit(null);
  }

  getState(): WalletState | null {
    return this.state;
  }

  async getBalance(): Promise<number> {
    if (!this.state) return 0;
    const balance = await this.fetchUsdc(this.state.address);
    this.emit({ ...this.state, balance });
    return balance;
  }

  // Phase 1: optimistic in-app accounting — Phase 2 replaces with CRE escrow txn.
  async deductBalance(amount: number): Promise<void> {
    if (!this.state) throw new Error("Wallet not connected");
    this.emit({
      ...this.state,
      inAppBalance: Math.max(0, (this.state.inAppBalance ?? 0) - amount),
    });
  }

  async addBalance(amount: number): Promise<void> {
    if (!this.state) throw new Error("Wallet not connected");
    this.emit({
      ...this.state,
      inAppBalance:
        Math.round(((this.state.inAppBalance ?? 0) + amount) * 100) / 100,
    });
  }

  /**
   * Polymarket-style top-up: returns the in-app wallet address for the user to
   * send USDC to. Polls for incoming balance automatically.
   */
  async topUp(_amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    if (!window.ethereum) throw new Error("MetaMask not available");
    const address = this.state.address;
    const snapshotBalance = this.state.balance;
    let attempts = 0;
    const poll = async () => {
      attempts++;
      const confirmed = await this.fetchUsdc(address);
      if (confirmed !== snapshotBalance) {
        const delta = Math.max(0, confirmed - snapshotBalance);
        // Persist deposit to player_balances so it survives reloads
        await this.recordDeposit(address, delta).catch(() => {});
        const newInApp = await this.fetchInAppBalance(address);
        this.emit({
          ...this.state!,
          balance: confirmed,
          inAppBalance: newInApp,
        });
      } else if (attempts < 30) {
        setTimeout(poll, 5_000);
      }
    };
    setTimeout(poll, 5_000);
    return address; // deposit address shown in TopUpModal
  }

  /**
   * Withdraw: sign from in-app wallet (connected) → player's external wallet.
   */
  async withdraw(amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    if (!window.ethereum) throw new Error("MetaMask not available");
    if (amount <= 0) throw new Error("Amount must be greater than 0");
    const currentInApp = this.state.inAppBalance ?? 0;
    if (amount > currentInApp)
      throw new Error(
        `Insufficient in-app balance ($${currentInApp.toFixed(2)})`,
      );
    const playerAddress =
      this.state.playerAddress ??
      localStorage.getItem("gl_player_address") ??
      "";
    if (!playerAddress)
      throw new Error(
        "Player wallet address not set — enter it in the Withdraw modal",
      );

    await this.ensureSepolia();
    const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    const data = transferData(playerAddress, rawAmount);

    // MetaMask signs from in-app wallet (currently connected account)
    const txHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: this.state.address, to: USDC_CONTRACT, data }],
    })) as string;

    // Record withdrawal in DB (persisted) and update in-memory state
    await this.recordWithdrawal(this.state.address, amount).catch(() => {});
    const newInApp = Math.max(
      0,
      Math.round((currentInApp - amount) * 100) / 100,
    );
    const newBalance = Math.max(
      0,
      Math.round((this.state.balance - amount) * 100) / 100,
    );
    this.emit({ ...this.state, balance: newBalance, inAppBalance: newInApp });
    return txHash;
  }

  setPlayerAddress(address: string): void {
    localStorage.setItem("gl_player_address", address);
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

export const realWalletService = new RealWalletService();
