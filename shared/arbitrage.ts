/** 2-way Over/Under arbitrage helpers — mirrored from data-platform analytics.arbitrage */

export function americanToImplied(american: number): number {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

export function americanToDecimal(american: number): number {
  if (american > 0) return 1 + american / 100;
  return 1 + 100 / Math.abs(american);
}

export type ArbStakeSplit = {
  profitPct: number;
  sumImplied: number;
  stakeOver: number;
  stakeUnder: number;
  expectedReturn: number;
  profit: number;
};

/** Guaranteed profit when best Over + best Under implied probs sum below 1. */
export function computeTwoWayArb(
  overAmerican: number,
  underAmerican: number,
  totalStake = 100,
): ArbStakeSplit | null {
  const invO = americanToImplied(overAmerican);
  const invU = americanToImplied(underAmerican);
  const sum = invO + invU;
  if (sum >= 1) return null;
  const stakeOver = totalStake * (invO / sum);
  const stakeUnder = totalStake * (invU / sum);
  const expectedReturn = totalStake / sum;
  return {
    profitPct: (1 / sum - 1) * 100,
    sumImplied: sum,
    stakeOver,
    stakeUnder,
    expectedReturn,
    profit: expectedReturn - totalStake,
  };
}
