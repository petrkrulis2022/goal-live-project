// ─────────────────────────────────────────────
//  Real Wallet Service — MetaMask + Sepolia USDC
//  Activated when VITE_USE_REAL_WALLET=true
// ─────────────────────────────────────────────
import type { IWalletService, WalletState } from "../../types/services.types";

// EIP-1193 provider
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
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
        params: [
          { to: USDC_CONTRACT, data: balanceOfData(address) },
          "latest",
        ],
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
      const balance = await this.fetchUsdc(accounts[0]);
      this.emit({ address: accounts[0], balance, connected: true });
    }
  };

  // ── IWalletService ────────────────────────────

  async connect(): Promise<WalletState> {
    if (!window.ethereum) {
      throw new Error(
        "MetaMask not detected — install MetaMask and reload.",
      );
    }
    await this.ensureSepolia();
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    const address = accounts[0];
    const balance = await this.fetchUsdc(address);
    const ws: WalletState = { address, balance, connected: true };
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
    this.emit({ ...this.state, balance: this.state.balance - amount });
  }

  async addBalance(amount: number): Promise<void> {
    if (!this.state) throw new Error("Wallet not connected");
    this.emit({ ...this.state, balance: this.state.balance + amount });
  }

  /**
   * Top-up: transfer `amount` USDC on Sepolia from user → platform escrow.
   * Returns the transaction hash.
   */
  async topUp(amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    if (!window.ethereum) throw new Error("MetaMask not available");
    if (!PLATFORM_WALLET) {
      throw new Error(
        "VITE_PLATFORM_WALLET is not set — add it to your .env file.",
      );
    }
    await this.ensureSepolia();
    const rawAmount = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    const data = transferData(PLATFORM_WALLET, rawAmount);
    const txHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{ from: this.state.address, to: USDC_CONTRACT, data }],
    })) as string;
    // Optimistically credit in-app balance after user signs
    await this.addBalance(amount);
    return txHash;
  }

  onStateChange(cb: (state: WalletState | null) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
}

export const realWalletService = new RealWalletService();
