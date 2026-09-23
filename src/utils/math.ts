/**
 * Decimal-safe arithmetic helpers to avoid IEEE 754 floating-point inaccuracies
 */

export function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

export function round4(num: number): number {
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

/**
 * Calculates new weighted-average purchase cost after a buy order
 * WAC = ((OldQty * OldAvgPrice) + (NewQty * NewPrice)) / (OldQty + NewQty)
 */
export function calculateWeightedAverage(
  currentQty: number,
  currentAvgPrice: number,
  addedQty: number,
  addedPrice: number
): number {
  if (currentQty <= 0) return round2(addedPrice);
  const totalCost = (currentQty * currentAvgPrice) + (addedQty * addedPrice);
  const totalQty = currentQty + addedQty;
  return round2(totalCost / totalQty);
}

/**
 * Calculates realized P&L when selling shares
 * Realized PnL = SoldQty * (SellPrice - AvgBuyPrice)
 */
export function calculateRealizedPnL(
  soldQty: number,
  sellPrice: number,
  avgBuyPrice: number
): number {
  return round2(soldQty * (sellPrice - avgBuyPrice));
}

/**
 * Calculates unrealized P&L for a holding
 */
export function calculateUnrealizedPnL(
  qty: number,
  avgPrice: number,
  currentPrice: number
): { pnl: number; pnlPercent: number } {
  if (qty <= 0) return { pnl: 0, pnlPercent: 0 };
  const invested = qty * avgPrice;
  const current = qty * currentPrice;
  const pnl = round2(current - invested);
  const pnlPercent = invested > 0 ? round2((pnl / invested) * 100) : 0;
  return { pnl, pnlPercent };
}
