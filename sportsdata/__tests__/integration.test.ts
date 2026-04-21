/**
 * Integration Tests for Sports Data Module
 * Tests mock provider, oracle client, and utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MockSportsDataProvider } from "../mock/MockSportsDataProvider";
import {
  ChainlinkOracleClient,
  createOracleConfigFromEnv,
} from "../integration/ChainlinkOracleClient";
import {
  validateOdds,
  oddsToImpliedProbability,
  oddsToMoneyline,
  oddsToBlockchainFormat,
  blockchainFormatToOdds,
  calculateNoVigOdds,
  isOddsStale,
  calculatePayout,
  calculateProfit,
  detectOddsMovement,
} from "../utils/oddsUtils";
import type { OddsSnapshot, Match } from "../types/sports";

describe("MockSportsDataProvider", () => {
  let provider: MockSportsDataProvider;

  beforeEach(() => {
    provider = new MockSportsDataProvider();
  });

  afterEach(() => {
    provider.destroy();
  });

  it("should return upcoming matches", async () => {
    const matches = await provider.getUpcomingMatches(5);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toHaveProperty("id");
    expect(matches[0]).toHaveProperty("homeTeam");
    expect(matches[0]).toHaveProperty("awayTeam");
  });

  it("should return live matches", async () => {
    const liveMatches = await provider.getLiveMatches();
    expect(Array.isArray(liveMatches)).toBe(true);
    liveMatches.forEach((match) => {
      expect(["LIVE", "HALFTIME"]).toContain(match.status);
    });
  });

  it("should get odds for a specific match", async () => {
    const odds = await provider.getOdds("match_001");
    expect(odds).toBeDefined();
    expect(odds?.odds).toHaveProperty("homeWin");
    expect(odds?.odds).toHaveProperty("draw");
    expect(odds?.odds).toHaveProperty("awayWin");
  });

  it("should return null for non-existent match", async () => {
    const odds = await provider.getOdds("non_existent");
    expect(odds).toBeNull();
  });

  it("should subscribe to live odds updates", async () => {
    const callback = vi.fn();
    const unsubscribe = provider.subscribeToLiveOdds("match_003", callback);

    // Wait for odds update (5 second interval)
    await new Promise((resolve) => setTimeout(resolve, 6000));

    expect(callback).toHaveBeenCalled();
    unsubscribe();
  });

  it("should work with match by ID", async () => {
    const match = await provider.getMatchById("match_001");
    expect(match).toBeDefined();
    expect(match?.id).toBe("match_001");
  });
});

describe("Odds Utilities", () => {
  const validOdds: OddsSnapshot = {
    id: "test_odds",
    matchId: "test_match",
    timestamp: Math.floor(Date.now() / 1000),
    source: "MOCK",
    odds: {
      homeWin: "2.50",
      draw: "3.00",
      awayWin: "2.80",
    },
  };

  it("should validate correct odds", () => {
    const result = validateOdds(validOdds);
    expect(result).toBe(true);
  });

  it("should reject odds below minimum", () => {
    const invalidOdds: OddsSnapshot = {
      ...validOdds,
      odds: {
        homeWin: "1.00",
        draw: "3.00",
        awayWin: "2.80",
      },
    };
    expect(validateOdds(invalidOdds)).toBe(false);
  });

  it("should calculate implied probability", () => {
    const prob = oddsToImpliedProbability("2.50");
    expect(prob).toBeCloseTo(0.4, 2);
  });

  it("should convert to moneyline", () => {
    const moneyline = oddsToMoneyline("2.50");
    expect(moneyline).toBe(150); // (2.5 - 1) * 100
  });

  it("should convert to blockchain format", () => {
    const blockchainValue = oddsToBlockchainFormat("2.50");
    expect(blockchainValue).toBe("2500000"); // 2.50 * 10^6
  });

  it("should round-trip blockchain format correctly", () => {
    const original = "2.50";
    const blockchain = oddsToBlockchainFormat(original);
    const roundTrip = blockchainFormatToOdds(blockchain);
    expect(parseFloat(roundTrip)).toBeCloseTo(parseFloat(original), 4);
  });

  it("should calculate no-vig odds", () => {
    const noVig = calculateNoVigOdds("2.50", "3.00", "2.80");
    expect(parseFloat(noVig.home)).toBeGreaterThan(2.4);
    expect(parseFloat(noVig.draw)).toBeGreaterThan(2.8);
    expect(parseFloat(noVig.away)).toBeGreaterThan(2.6);
  });

  it("should detect stale odds", () => {
    const oldOdds: OddsSnapshot = {
      ...validOdds,
      timestamp: Math.floor(Date.now() / 1000) - 400, // 400 seconds ago
    };
    expect(isOddsStale(oldOdds, 300)).toBe(true);
    expect(isOddsStale(oldOdds, 500)).toBe(false);
  });

  it("should calculate payout correctly", () => {
    const payout = calculatePayout("2.50", 100);
    expect(payout).toBe(250); // 100 * 2.50
  });

  it("should calculate profit correctly", () => {
    const profit = calculateProfit("2.50", 100);
    expect(profit).toBe(150); // (100 * 2.50) - 100
  });

  it("should detect odds movement", () => {
    const oldOdds: OddsSnapshot = {
      ...validOdds,
      odds: {
        homeWin: "2.50",
        draw: "3.00",
        awayWin: "2.80",
      },
    };

    const newOdds: OddsSnapshot = {
      ...validOdds,
      timestamp: Math.floor(Date.now() / 1000),
      odds: {
        homeWin: "2.70", // +8%
        draw: "3.00",
        awayWin: "2.80",
      },
    };

    const movement = detectOddsMovement(oldOdds, newOdds, 5);
    expect(movement.homeMoved).toBe(true);
    expect(movement.drawMoved).toBe(false);
    expect(movement.totalMovement).toBeGreaterThan(0);
  });
});

describe("ChainlinkOracleClient", () => {
  let oracle: ChainlinkOracleClient;

  beforeEach(() => {
    const config = {
      routerAddress: "0x0000000000000000000000000000000000000000",
      donId: "fun-solana-devnet-1",
      subscriptionId: 1,
      gasLimit: 200000,
      callbackFunction: "fulfillOddsRequest",
    };
    oracle = new ChainlinkOracleClient(config);
  });

  it("should request odds data", async () => {
    const oddsData = await oracle.requestOddsData("match_001", "PL");
    expect(oddsData).toBeDefined();
    expect(oddsData.source).toBe("CHAINLINK");
    expect(oddsData.vrfRequestId).toBeDefined();
    expect(oddsData.blockNumber).toBeDefined();
  });

  it("should request VRF randomness", async () => {
    const vrfResult = await oracle.requestVRFRandomness();
    expect(vrfResult.requestId).toBeDefined();
    expect(vrfResult.randomWord).toBeDefined();
    expect(vrfResult.randomWord.startsWith("0x")).toBe(true);
  });

  it("should verify oracle response", async () => {
    const oddsData = await oracle.requestOddsData("match_001");
    const isValid = oracle.verifyOracleResponse(oddsData, 1);
    expect(isValid).toBe(true);
  });

  it("should get request status", async () => {
    const oddsData = await oracle.requestOddsData("match_001");
    const status = oracle.getRequestStatus(oddsData.vrfRequestId || "");
    expect(status).toBeDefined();
    expect(status.status).toBe("fulfilled");
  });

  it("should estimate callback gas cost", () => {
    const estimate = oracle.estimateCallbackGasCost();
    expect(Number(estimate)).toBeGreaterThan(0);
  });

  it("should create oracle config from environment", () => {
    const config = createOracleConfigFromEnv();
    expect(config.routerAddress).toBeDefined();
    expect(config.donId).toBeDefined();
    expect(config.subscriptionId).toBeDefined();
  });
});

describe("End-to-End Integration", () => {
  let provider: MockSportsDataProvider;
  let oracle: ChainlinkOracleClient;

  beforeEach(() => {
    provider = new MockSportsDataProvider();
    oracle = new ChainlinkOracleClient(createOracleConfigFromEnv());
  });

  afterEach(() => {
    provider.destroy();
  });

  it("should flow from match data through odds to oracle", async () => {
    // Get a match
    const match = await provider.getMatchById("match_001");
    expect(match).toBeDefined();

    // Get odds for the match
    const odds = await provider.getOdds(match!.id);
    expect(odds).toBeDefined();

    // Request from oracle
    const oracleOdds = await oracle.requestOddsData(match!.id);
    expect(oracleOdds).toBeDefined();

    // Validate odds
    const isValid = validateOdds(oracleOdds);
    expect(isValid).toBe(true);

    // Calculate implied probabilities
    const homeProb = oddsToImpliedProbability(oracleOdds.odds.homeWin);
    const drawProb = oddsToImpliedProbability(oracleOdds.odds.draw);
    const awayProb = oddsToImpliedProbability(oracleOdds.odds.awayWin);

    const totalProb = homeProb + drawProb + awayProb;
    expect(totalProb).toBeGreaterThan(0.95); // Account for vig
    expect(totalProb).toBeLessThan(1.15);
  });

  it("should handle betting scenario", async () => {
    const betAmount = 100;
    const oddsString = "2.50";

    // Calculate potential return
    const payout = calculatePayout(oddsString, betAmount);
    const profit = calculateProfit(oddsString, betAmount);

    expect(payout).toBe(250);
    expect(profit).toBe(150);

    // Convert for blockchain
    const blockchainOdds = oddsToBlockchainFormat(oddsString);
    expect(blockchainOdds).toBe("2500000");

    // Verify round-trip
    const recovered = blockchainFormatToOdds(blockchainOdds);
    expect(parseFloat(recovered)).toBeCloseTo(2.5, 4);
  });

  it("should track odds changes over time", async () => {
    const match = await provider.getMatchById("match_003");
    expect(match).toBeDefined();

    // Get initial odds
    const initialOdds = await provider.getOdds(match!.id);
    expect(initialOdds).toBeDefined();

    // Subscribe and wait for update
    let latestOdds = initialOdds!;
    const unsubscribe = provider.subscribeToLiveOdds(match!.id, (newOdds) => {
      latestOdds = newOdds;
    });

    // Wait for update
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // Detect movement
    const movement = detectOddsMovement(initialOdds!, latestOdds);
    expect(movement.totalMovement).toBeGreaterThanOrEqual(0);

    unsubscribe();
  });
});
