// ─────────────────────────────────────────────
//  Mock Wallet Service
// ─────────────────────────────────────────────
import type { IWalletService, WalletState } from "../../types/services.types";

const STORAGE_KEY = "gl_mock_wallet";
const INITIAL_BALANCE = 500; // USDC

function load(): WalletState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WalletState) : null;
  } catch {
    return null;
  }
}

function save(state: WalletState | null) {
  if (state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

class MockWalletService implements IWalletService {
  private state: WalletState | null = load();
  private listeners: Array<(s: WalletState | null) => void> = [];

  private notify() {
    this.listeners.forEach((cb) => cb(this.state));
  }

  async connect(): Promise<WalletState> {
    if (this.state) return this.state;
    this.state = {
      address: "0xMockWallet1234567890abcdef1234567890ABCDEF",
      balance: INITIAL_BALANCE,
      inAppBalance: 0,
      connected: true,
    };
    save(this.state);
    this.notify();
    return this.state;
  }

  disconnect(): void {
    this.state = null;
    save(null);
    this.notify();
  }

  getState(): WalletState | null {
    return this.state;
  }

  async getBalance(): Promise<number> {
    return this.state?.balance ?? 0;
  }

  async deductBalance(amount: number): Promise<void> {
    if (!this.state) throw new Error("Wallet not connected");
    this.state = {
      ...this.state,
      inAppBalance: Math.max(
        0,
        Math.round((this.state.inAppBalance - amount) * 100) / 100,
      ),
    };
    save(this.state);
    this.notify();
  }

  async addBalance(amount: number): Promise<void> {
    if (!this.state) throw new Error("Wallet not connected");
    this.state = {
      ...this.state,
      inAppBalance: Math.round((this.state.inAppBalance + amount) * 100) / 100,
    };
    save(this.state);
    this.notify();
  }

  async topUp(amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    this.state = {
      ...this.state,
      balance: Math.max(0, this.state.balance - amount),
      inAppBalance: Math.round((this.state.inAppBalance + amount) * 100) / 100,
    };
    save(this.state);
    this.notify();
    return "0xmock_topup_" + Date.now();
  }

  async withdraw(amount: number): Promise<string> {
    if (!this.state) throw new Error("Wallet not connected");
    if (amount <= 0) throw new Error("Amount must be greater than 0");
    if (amount > this.state.inAppBalance)
      throw new Error(
        `Insufficient in-app balance ($${this.state.inAppBalance.toFixed(2)})`,
      );
    this.state = {
      ...this.state,
      balance: Math.round((this.state.balance + amount) * 100) / 100,
      inAppBalance: Math.max(
        0,
        Math.round((this.state.inAppBalance - amount) * 100) / 100,
      ),
    };
    save(this.state);
    this.notify();
    return "0xmock_withdraw_" + Date.now();
  }

  setPlayerAddress(address: string): void {
    if (!this.state) return;
    this.state = { ...this.state, playerAddress: address };
    save(this.state);
    this.notify();
  }

  onStateChange(cb: (state: WalletState | null) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }
}

export const mockWalletService = new MockWalletService();
