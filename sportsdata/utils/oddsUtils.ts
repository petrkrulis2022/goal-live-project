/**
 * Sports Data Utilities
 * Helpers for odds validation, conversion, and blockchain integration
 */

import { OddsSnapshot, ODDS_DECIMAL_PLACES } from "../types/sports";

/**
 * Validate odds values are within acceptable ranges
 */
export function validateOdds(odds: OddsSnapshot): boolean {
  const minOdds = 1.01;
  const maxOdds = 1000;

  const homeOdds = parseFloat(odds.odds.homeWin);
  const drawOdds = parseFloat(odds.odds.draw);
  const awayOdds = parseFloat(odds.odds.awayWin);

  if (homeOdds < minOdds || homeOdds > maxOdds) return false;
  if (drawOdds < minOdds || drawOdds > maxOdds) return false;
  if (awayOdds < minOdds || awayOdds > maxOdds) return false;

  // Implied probability should be reasonable
  const impliedProb = 1 / homeOdds + 1 / drawOdds + 1 / awayOdds;
  if (impliedProb < 0.95 || impliedProb > 1.15) return false; // Allow for vig

  return true;
}

/**
 * Convert decimal odds to implied probability
 */
export function oddsToImpliedProbability(decimalOdds: string): number {
  return 1 / parseFloat(decimalOdds);
}

/**
 * Convert decimal odds to moneyline format (American odds)
 */
export function oddsToMoneyline(decimalOdds: string): number {
  const odds = parseFloat(decimalOdds);
  if (odds >= 2) {
    return Math.round((odds - 1) * 100);
  } else {
    return Math.round(-100 / (odds - 1));
  }
}

/**
 * Convert odds to fixed precision for blockchain uint representation
 * Multiplies by 10^ODDS_DECIMAL_PLACES to avoid floating point issues
 */
export function oddsToBlockchainFormat(decimalOdds: string): string {
  const odds = parseFloat(decimalOdds);
  const multiplier = Math.pow(10, ODDS_DECIMAL_PLACES);
  return Math.floor(odds * multiplier).toString();
}

/**
 * Convert blockchain uint format back to decimal odds
 */
export function blockchainFormatToOdds(
  blockchainValue: string | number,
): string {
  const divisor = Math.pow(10, ODDS_DECIMAL_PLACES);
  const odds = parseFloat(blockchainValue.toString()) / divisor;
  return odds.toFixed(4);
}

/**
 * Calculate no-vig (true) odds from market odds
 * Removes the house edge to show real probabilities
 */
export function calculateNoVigOdds(
  homeOdds: string,
  drawOdds: string,
  awayOdds: string,
): { home: string; draw: string; away: string } {
  const home = 1 / parseFloat(homeOdds);
  const draw = 1 / parseFloat(drawOdds);
  const away = 1 / parseFloat(awayOdds);
  const total = home + draw + away;

  return {
    home: (1 / (home / total)).toFixed(4),
    draw: (1 / (draw / total)).toFixed(4),
    away: (1 / (away / total)).toFixed(4),
  };
}

/**
 * Check if odds have stale data (older than threshold)
 */
export function isOddsStale(
  odds: OddsSnapshot,
  maxAgeSeconds: number = 300,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - odds.timestamp > maxAgeSeconds;
}

/**
 * Calculate potential payout from odds and bet amount
 */
export function calculatePayout(oddsString: string, betAmount: number): number {
  const odds = parseFloat(oddsString);
  return betAmount * odds;
}

/**
 * Calculate bet return (profit) from odds and bet amount
 */
export function calculateProfit(oddsString: string, betAmount: number): number {
  return calculatePayout(oddsString, betAmount) - betAmount;
}

/**
 * Format odds string for display with rounding
 */
export function formatOddsDisplay(
  oddsString: string,
  decimals: number = 2,
): string {
  return parseFloat(oddsString).toFixed(decimals);
}

/**
 * Detect if odds have moved significantly
 */
export function detectOddsMovement(
  previousOdds: OddsSnapshot,
  currentOdds: OddsSnapshot,
  thresholdPercent: number = 5,
): {
  homeMoved: boolean;
  drawMoved: boolean;
  awayMoved: boolean;
  totalMovement: number;
} {
  const homeChange = Math.abs(
    ((parseFloat(currentOdds.odds.homeWin) -
      parseFloat(previousOdds.odds.homeWin)) /
      parseFloat(previousOdds.odds.homeWin)) *
      100,
  );
  const drawChange = Math.abs(
    ((parseFloat(currentOdds.odds.draw) - parseFloat(previousOdds.odds.draw)) /
      parseFloat(previousOdds.odds.draw)) *
      100,
  );
  const awayChange = Math.abs(
    ((parseFloat(currentOdds.odds.awayWin) -
      parseFloat(previousOdds.odds.awayWin)) /
      parseFloat(previousOdds.odds.awayWin)) *
      100,
  );

  return {
    homeMoved: homeChange > thresholdPercent,
    drawMoved: drawChange > thresholdPercent,
    awayMoved: awayChange > thresholdPercent,
    totalMovement: (homeChange + drawChange + awayChange) / 3,
  };
}
