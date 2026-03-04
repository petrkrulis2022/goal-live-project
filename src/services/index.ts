// ─────────────────────────────────────────────
//  Service Factory — goal.live
//  All services are real (Supabase + MetaMask bridge).
//
//  ✅ ALWAYS import from here:
//     import { services } from '../services'
// ─────────────────────────────────────────────
import { realDataService } from "./real/dataService";
import { realBettingService } from "./real/bettingService";
import { walletBridgeService } from "./bridge/walletBridgeService";

export const services = {
  data: realDataService,
  betting: realBettingService,
  wallet: walletBridgeService,
} as const;

// Expose to content-script dev tools (window.__goalLive)
if (import.meta.env.VITE_DEBUG === "true") {
  (window as unknown as Record<string, unknown>).__goalLive = services;
}
