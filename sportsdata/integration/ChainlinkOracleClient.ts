/**
 * Chainlink Oracle Integration
 * Handles requests to Chainlink Functions and VRF for sports data and randomness
 */

import { OddsSnapshot, ChainlinkOracleConfig } from "../types/sports";

export class ChainlinkOracleClient {
  private config: ChainlinkOracleConfig;
  private requestLog: Map<string, any> = new Map();

  constructor(config: ChainlinkOracleConfig) {
    this.config = config;
  }

  /**
   * Request live odds data from Chainlink Functions
   * In production, this will call the actual Chainlink oracle
   * For MVP, this returns mock data with oracle metadata
   */
  async requestOddsData(
    matchId: string,
    leagueCode: string = "PL",
  ): Promise<OddsSnapshot> {
    const requestId = this.generateRequestId();

    // Mock implementation - in production, this calls Chainlink Functions
    const oddsData: OddsSnapshot = {
      id: requestId,
      matchId,
      timestamp: Math.floor(Date.now() / 1000),
      source: "CHAINLINK",
      odds: {
        homeWin: (1.5 + Math.random() * 1.5).toFixed(4),
        draw: (3 + Math.random() * 1).toFixed(4),
        awayWin: (2 + Math.random() * 2).toFixed(4),
      },
      vrfRequestId: requestId,
      blockNumber: Math.floor(Math.random() * 1000000), // Mock block number
      confirmations: Math.floor(Math.random() * 12) + 1,
    };

    this.requestLog.set(requestId, {
      matchId,
      leagueCode,
      timestamp: oddsData.timestamp,
      status: "fulfilled",
    });

    return oddsData;
  }

  /**
   * Request VRF randomness for bet resolution
   * Used to generate the random value for selecting winning outcomes
   */
  async requestVRFRandomness(): Promise<{
    requestId: string;
    randomWord: string;
  }> {
    const requestId = this.generateRequestId();

    // Mock implementation - in production, this calls Chainlink VRF
    const randomWord = this.generateMockRandomness();

    this.requestLog.set(requestId, {
      type: "VRF",
      requestId,
      randomWord,
      timestamp: Math.floor(Date.now() / 1000),
      status: "fulfilled",
    });

    return {
      requestId,
      randomWord,
    };
  }

  /**
   * Verify Chainlink oracle response has required confirmations
   */
  verifyOracleResponse(
    odds: OddsSnapshot,
    requiredConfirmations: number = 3,
  ): boolean {
    if (!odds.blockNumber || !odds.confirmations) {
      return false;
    }

    return odds.confirmations >= requiredConfirmations;
  }

  /**
   * Get historical request status from oracle
   */
  getRequestStatus(requestId: string): any {
    return this.requestLog.get(requestId) || null;
  }

  /**
   * Estimate gas cost for oracle callback
   */
  estimateCallbackGasCost(): string {
    // Chainlink Functions callback typically costs 100-200k gas
    const gasUnits = 150000;
    const gasPriceGwei = 30; // Mock gas price in gwei
    return (gasUnits * gasPriceGwei).toString();
  }

  private generateRequestId(): string {
    return `0x${Math.random().toString(16).substr(2, 64)}`;
  }

  private generateMockRandomness(): string {
    // Generate a 32-byte hex string (256-bit random number)
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let hex = "0x";
    for (let i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  }
}

/**
 * Helper to create oracle config from environment variables
 */
export function createOracleConfigFromEnv(): ChainlinkOracleConfig {
  return {
    routerAddress:
      process.env.CHAINLINK_ROUTER_ADDRESS ||
      "0x0000000000000000000000000000000000000000",
    donId: process.env.CHAINLINK_DON_ID || "fun-solana-devnet-1",
    subscriptionId: parseInt(process.env.CHAINLINK_SUBSCRIPTION_ID || "0", 10),
    gasLimit: parseInt(process.env.CHAINLINK_GAS_LIMIT || "200000", 10),
    callbackFunction:
      process.env.CHAINLINK_CALLBACK_FUNCTION || "fulfillOddsRequest",
  };
}
