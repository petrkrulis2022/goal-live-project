// ─────────────────────────────────────────────
//  Hybrid Penalty Calculator
//  penalty = base[changeCount] × (1 - minute/90)
// ─────────────────────────────────────────────
import type { PenaltyPreview } from "../types";

const BASE_RATES = [0, 0.03, 0.05, 0.08, 0.12, 0.15]; // index = change number (1-indexed)

export function getBasePenaltyRate(changeNumber: number): number {
  if (changeNumber <= 0) return 0;
  if (changeNumber >= BASE_RATES.length)
    return BASE_RATES[BASE_RATES.length - 1];
  return BASE_RATES[changeNumber] ?? 0.15;
}

export function calcTimedecay(minute: number): number {
  const clamped = Math.max(0, Math.min(90, minute));
  return 1 - clamped / 90;
}

/**
 * Calculate penalty for a bet change.
 * @param currentAmount  The bet amount BEFORE this change
 * @param changeNumber   1-indexed change number (1 = first change, 2 = second…)
 * @param minute         Current match minute (0-90)
 */
export function calcPenalty(
  currentAmount: number,
  changeNumber: number,
  minute: number,
): PenaltyPreview {
  const base = getBasePenaltyRate(changeNumber);
  const decay = calcTimedecay(minute);
  const penaltyPct = base * decay;
  const penaltyAmount = currentAmount * penaltyPct;
  const newEffectiveAmount = currentAmount - penaltyAmount;

  return {
    penaltyPct,
    penaltyAmount,
    newEffectiveAmount,
    changeNumber,
  };
}

/** Format a penalty percentage for display, e.g. "2.34%" */
export function formatPenaltyPct(penaltyPct: number): string {
  return `${(penaltyPct * 100).toFixed(2)}%`;
}
