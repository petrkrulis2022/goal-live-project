/**
 * Sports Data Types for Goal.Live Betting Platform
 * Defines all data structures for odds, matches, and betting
 */

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  startTime: number; // Unix timestamp
  status: MatchStatus;
  score?: {
    home: number;
    away: number;
  };
  odds?: OddsSnapshot;
}

export enum MatchStatus {
  SCHEDULED = "SCHEDULED",
  LIVE = "LIVE",
  HALFTIME = "HALFTIME",
  FINISHED = "FINISHED",
  CANCELLED = "CANCELLED",
}

export interface OddsSnapshot {
  id: string;
  matchId: string;
  timestamp: number;
  source: "CHAINLINK" | "MOCK" | "EXTERNAL";
  odds: {
    homeWin: string; // Decimal odds as string for precision
    draw: string;
    awayWin: string;
  };
  // Metadata for Chainlink integration
  vrfRequestId?: string;
  blockNumber?: number;
  confirmations?: number;
}

export interface SportsDataProvider {
  name: string;
  getMatchById(matchId: string): Promise<Match | null>;
  getUpcomingMatches(limit?: number): Promise<Match[]>;
  getLiveMatches(): Promise<Match[]>;
  getOdds(matchId: string): Promise<OddsSnapshot | null>;
  subscribeToLiveOdds(
    matchId: string,
    callback: (odds: OddsSnapshot) => void,
  ): () => void;
}

export interface ChainlinkOracleConfig {
  routerAddress: string;
  donId: string; // Decentralized Oracle Network ID
  subscriptionId: number;
  gasLimit: number;
  callbackFunction: string;
}

export interface BetResolution {
  matchId: string;
  finalScore: {
    home: number;
    away: number;
  };
  result: "HOME_WIN" | "DRAW" | "AWAY_WIN";
  resolvedAt: number;
  chainlinkVRFProof?: string;
  blockConfirmation: number;
}

export const ODDS_DECIMAL_PLACES = 6; // For Solana precision
export const BET_AMOUNT_DECIMALS = 6; // USDC decimals
