// ─────────────────────────────────────────────
//  Service Factory — goal.live
//  Single file that controls mock vs real.
//  To switch: change VITE_USE_MOCK in .env
//
//  ✅ ALWAYS import from here:
//     import { services } from '../services'
//  ❌ NEVER import mock/real directly in components
// ─────────────────────────────────────────────
import { mockDataService } from "./mock/mockDataService";
import { mockBettingService } from "./mock/mockBettingService";
import { mockWalletService } from "./mock/mockWalletService";
import { realDataService } from "./real/dataService";
import { realBettingService } from "./real/bettingService";
import { walletBridgeService } from "./bridge/walletBridgeService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";
// USE_REAL_WALLET=true → MetaMask bridge; false → instant mock wallet ($500)
const USE_REAL_WALLET = import.meta.env.VITE_USE_REAL_WALLET === "true";

export const services = {
  data: USE_MOCK ? mockDataService : realDataService,
  betting: USE_MOCK ? mockBettingService : realBettingService,
  // Bridge service uses postMessage to reach MetaMask through injected.js
  wallet: USE_REAL_WALLET ? walletBridgeService : mockWalletService,
} as const;

// Expose to content-script dev tools (window.__goalLive)
if (import.meta.env.VITE_DEBUG === "true") {
  (window as unknown as Record<string, unknown>).__goalLive = services;
}
