// ─────────────────────────────────────────────
//  Service Factory — goal.live Hedera Testnet
//  Same data + betting services as the CRE extension,
//  but wallet uses the Hedera testnet wallet bridge.
//
//  Used ONLY by the hedera extension build.
//  vite.extension-hedera.config.ts aliases @/services → this file.
// ─────────────────────────────────────────────
import { realDataService } from "../real/dataService";
import { realBettingService } from "../real/bettingService";
import { walletBridgeServiceHedera } from "../bridge/walletBridgeServiceHedera";

export const services = {
  data: realDataService,
  betting: realBettingService,
  wallet: walletBridgeServiceHedera,
} as const;

if (import.meta.env.VITE_DEBUG === "true") {
  (window as unknown as Record<string, unknown>).__goalLive = services;
}
