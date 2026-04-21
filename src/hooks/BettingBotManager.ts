/**
 * Betting Bot Manager
 * Orchestrates sports data fetching and automated betting logic
 * Integrates with Chainlink oracle for trustless odds
 */

import {
  createSportsDataProvider,
  ChainlinkOracleClient,
  createOracleConfigFromEnv,
} from "@/sportsdata";
import type { Match, OddsSnapshot, SportsDataProvider } from "@/sportsdata";

export interface BettingBotConfig {
  enabled: boolean;
  maxBetSize: number;
  minOddsThreshold: number;
  maxOddsThreshold: number;
  refreshIntervalMs: number;
  useChainlinkOracle: boolean;
  chain: "solana" | "eth";
}

export interface BotState {
  isActive: boolean;
  currentMatch: Match | null;
  currentOdds: OddsSnapshot | null;
  lastRefetch: number;
  totalBetsPlaced: number;
  totalProfit: number;
}

export class BettingBotManager {
  private sportsDataProvider: SportsDataProvider;
  private oracle: ChainlinkOracleClient | null;
  private config: BettingBotConfig;
  private state: BotState;
  private refreshInterval: NodeJS.Timeout | null = null;
  private oddsSubscriptions: Map<string, () => void> = new Map();

  constructor(config: BettingBotConfig) {
    this.config = config;
    this.sportsDataProvider = createSportsDataProvider(
      process.env.NODE_ENV || "development",
    );
    this.oracle = this.config.useChainlinkOracle
      ? new ChainlinkOracleClient(createOracleConfigFromEnv())
      : null;
    this.state = {
      isActive: config.enabled,
      currentMatch: null,
      currentOdds: null,
      lastRefetch: 0,
      totalBetsPlaced: 0,
      totalProfit: 0,
    };
  }

  /**
   * Start the betting bot
   */
  async start(): Promise<void> {
    if (this.state.isActive) {
      console.log("[BettingBot] Bot already running");
      return;
    }

    this.state.isActive = true;
    await this.refreshMatchAndOdds();

    // Set up periodic refresh
    this.refreshInterval = setInterval(() => {
      this.refreshMatchAndOdds().catch((err) => {
        console.error("[BettingBot] Refresh error:", err);
      });
    }, this.config.refreshIntervalMs);

    console.log("[BettingBot] Bot started");
  }

  /**
   * Stop the betting bot
   */
  stop(): void {
    if (!this.state.isActive) {
      console.log("[BettingBot] Bot already stopped");
      return;
    }

    this.state.isActive = false;

    // Clear refresh interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    // Unsubscribe from all odds streams
    this.oddsSubscriptions.forEach((unsubscribe) => unsubscribe());
    this.oddsSubscriptions.clear();

    console.log("[BettingBot] Bot stopped");
  }

  /**
   * Refresh match and odds data
   */
  private async refreshMatchAndOdds(): Promise<void> {
    try {
      // Get upcoming matches
      const upcomingMatches =
        await this.sportsDataProvider.getUpcomingMatches(5);

      if (upcomingMatches.length === 0) {
        console.log("[BettingBot] No upcoming matches found");
        return;
      }

      // Use first match
      const match = upcomingMatches[0];
      this.state.currentMatch = match;

      // Get or request odds
      let odds = await this.sportsDataProvider.getOdds(match.id);

      if (!odds && this.oracle) {
        // Request from Chainlink if not available
        console.log("[BettingBot] Requesting odds from Chainlink oracle...");
        odds = await this.oracle.requestOddsData(match.id);
      }

      if (odds) {
        this.state.currentOdds = odds;
        this.subscribeToOddsUpdates(match.id);

        // Check if betting conditions are met
        if (this.shouldPlaceBet(match, odds)) {
          await this.executeBet(match, odds);
        }
      }

      this.state.lastRefetch = Date.now();
    } catch (err) {
      console.error("[BettingBot] Failed to refresh match/odds:", err);
    }
  }

  /**
   * Subscribe to live odds updates for a match
   */
  private subscribeToOddsUpdates(matchId: string): void {
    // Unsubscribe from previous subscription if any
    const prevUnsubscribe = this.oddsSubscriptions.get(matchId);
    if (prevUnsubscribe) {
      prevUnsubscribe();
    }

    const unsubscribe = this.sportsDataProvider.subscribeToLiveOdds(
      matchId,
      (newOdds) => {
        this.state.currentOdds = newOdds;
        console.log(`[BettingBot] Odds updated for ${matchId}:`, newOdds.odds);

        // Re-check betting conditions
        if (
          this.state.currentMatch &&
          this.shouldPlaceBet(this.state.currentMatch, newOdds)
        ) {
          this.executeBet(this.state.currentMatch, newOdds).catch((err) => {
            console.error("[BettingBot] Bet execution error:", err);
          });
        }
      },
    );

    this.oddsSubscriptions.set(matchId, unsubscribe);
  }

  /**
   * Determine if betting conditions are met
   */
  private shouldPlaceBet(match: Match, odds: OddsSnapshot): boolean {
    // Don't bet if match already started
    if (match.status !== "SCHEDULED") {
      return false;
    }

    const homeOdds = parseFloat(odds.odds.homeWin);
    const drawOdds = parseFloat(odds.odds.draw);
    const awayOdds = parseFloat(odds.odds.awayWin);

    // Check if any odds are within betting threshold
    const oddsArray = [homeOdds, drawOdds, awayOdds];
    const isWithinBounds = oddsArray.some(
      (o) =>
        o >= this.config.minOddsThreshold && o <= this.config.maxOddsThreshold,
    );

    return isWithinBounds;
  }

  /**
   * Execute a bet (placeholder - implement with actual wallet/contract interaction)
   */
  private async executeBet(match: Match, odds: OddsSnapshot): Promise<void> {
    const betAmount = this.config.maxBetSize;

    console.log(
      `[BettingBot] Placing bet on ${match.homeTeam} vs ${match.awayTeam}`,
    );
    console.log(`  Amount: ${betAmount}`);
    console.log(`  Odds: ${JSON.stringify(odds.odds)}`);

    // TODO: Implement actual bet placement via wallet/smart contract

    this.state.totalBetsPlaced += 1;
  }

  /**
   * Get current bot state
   */
  getState(): BotState {
    return { ...this.state };
  }

  /**
   * Get configured limits
   */
  getConfig(): BettingBotConfig {
    return { ...this.config };
  }

  /**
   * Estimate gas cost for next oracle callback
   */
  estimateOracleCost(): string | null {
    return this.oracle ? this.oracle.estimateCallbackGasCost() : null;
  }

  /**
   * Verify oracle response integrity
   */
  verifyOracleResponse(requiredConfirmations: number = 3): boolean {
    if (!this.state.currentOdds || !this.oracle) {
      return false;
    }
    return this.oracle.verifyOracleResponse(
      this.state.currentOdds,
      requiredConfirmations,
    );
  }

  /**
   * Destroy and clean up resources
   */
  destroy(): void {
    this.stop();
    if (this.sportsDataProvider && "destroy" in this.sportsDataProvider) {
      (this.sportsDataProvider as any).destroy();
    }
  }
}

/**
 * Factory function to create a betting bot with sensible defaults
 */
export function createBettingBot(
  overrides?: Partial<BettingBotConfig>,
): BettingBotManager {
  const defaultConfig: BettingBotConfig = {
    enabled: true,
    maxBetSize: 5, // USDC tokens
    minOddsThreshold: 1.1,
    maxOddsThreshold: 10,
    refreshIntervalMs: 10000, // 10 seconds
    useChainlinkOracle: process.env.NODE_ENV === "production",
    chain: (process.env.VITE_CHAIN || "solana") as "solana" | "eth",
  };

  return new BettingBotManager({ ...defaultConfig, ...overrides });
}
