import { StockQuote, PricePoint, TimeFrame, IndexOverview } from '../types/stock';
import { round2 } from '../utils/math';

/**
 * Generates slight simulated price tick based on volatility
 */
export function simulatePriceTick(stock: StockQuote): StockQuote {
  // Micro fluctuation between -0.35% and +0.35% with realistic slight bias
  const volatility = 0.0035;
  const delta = (Math.random() - 0.495) * 2 * volatility;
  const newPrice = round2(stock.price * (1 + delta));

  const change = round2(newPrice - stock.previousClose);
  const changePercent = round2((change / stock.previousClose) * 100);

  const dayHigh = Math.max(stock.dayHigh, newPrice);
  const dayLow = Math.min(stock.dayLow, newPrice);
  const volumeIncrement = Math.floor(Math.random() * 800 + 50);

  return {
    ...stock,
    price: newPrice,
    change,
    changePercent,
    dayHigh,
    dayLow,
    volume: stock.volume + volumeIncrement,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Generates slight index fluctuations
 */
export function simulateIndexTick(index: IndexOverview): IndexOverview {
  const delta = (Math.random() - 0.495) * 0.0015;
  const newValue = round2(index.value * (1 + delta));
  const change = round2(newValue - index.previousClose);
  const changePercent = round2((change / index.previousClose) * 100);

  return {
    ...index,
    value: newValue,
    change,
    changePercent,
    high: Math.max(index.high, newValue),
    low: Math.min(index.low, newValue),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Seeded pseudo-random generator for consistent charts
 */
function createSeededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 12345;
}

/**
 * Generates consistent historical price points ending exactly at current stock price
 */
export function generateConsistentHistory(
  stock: StockQuote,
  timeframe: TimeFrame
): PricePoint[] {
  const points: PricePoint[] = [];
  const currentPrice = stock.price;
  const prevClose = stock.previousClose;
  const seed = stringToSeed(stock.symbol + timeframe);
  const rand = createSeededRandom(seed);

  if (timeframe === '1D') {
    // 1D: From 09:15 to 15:30 (typical NSE trading hours), 5-minute intervals -> ~75 points
    const totalPoints = 75;
    const startPrice = stock.open || prevClose;

    // We build a Brownian bridge from startPrice to currentPrice
    const rawValues: number[] = [startPrice];
    let running = startPrice;

    for (let i = 1; i < totalPoints - 1; i++) {
      // Drift towards target + noise
      const progress = i / totalPoints;
      const expectedAtStep = startPrice + (currentPrice - startPrice) * progress;
      const noise = (rand() - 0.5) * (startPrice * 0.008);
      running = running * 0.7 + expectedAtStep * 0.3 + noise;

      // Keep within realistic day range bounds
      const bounded = Math.max(stock.dayLow * 0.998, Math.min(stock.dayHigh * 1.002, running));
      rawValues.push(bounded);
    }
    rawValues.push(currentPrice);

    // Format timestamps from 09:15 AM
    let currentMinute = 9 * 60 + 15;
    for (let i = 0; i < totalPoints; i++) {
      const h = Math.floor(currentMinute / 60);
      const m = currentMinute % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const price = round2(rawValues[i]);
      const change = round2(price - prevClose);
      const changePercent = round2((change / prevClose) * 100);

      points.push({
        time: timeStr,
        price,
        change,
        changePercent,
      });
      currentMinute += 5;
    }
    return points;
  }

  // Multi-day timeframes: 1W (7 days, 4 pts/day), 1M (30 days), 3M (90 days), 1Y (250 days)
  let count = 28;
  let daysBack = 7;
  let basePriceRatio = 0.98;

  if (timeframe === '1W') {
    count = 35;
    daysBack = 7;
    basePriceRatio = 1 - (stock.changePercent * 0.005);
  } else if (timeframe === '1M') {
    count = 30;
    daysBack = 30;
    basePriceRatio = 0.95;
  } else if (timeframe === '3M') {
    count = 60;
    daysBack = 90;
    basePriceRatio = 0.91;
  } else if (timeframe === '1Y') {
    count = 120;
    daysBack = 365;
    basePriceRatio = 0.82;
  }

  const startPrice = round2(currentPrice * basePriceRatio);
  const now = new Date();

  const values: number[] = [];
  for (let i = 0; i < count - 1; i++) {
    const progress = i / (count - 1);
    const target = startPrice + (currentPrice - startPrice) * progress;
    const volatility = timeframe === '1Y' ? 0.025 : 0.015;
    const noise = (rand() - 0.48) * currentPrice * volatility;
    const p = Math.max(startPrice * 0.7, target + noise);
    values.push(round2(p));
  }
  values.push(currentPrice); // Strictly guarantee final point equals current live price!

  for (let i = 0; i < count; i++) {
    const pointDate = new Date(now.getTime() - (count - 1 - i) * ((daysBack * 86400000) / count));
    const timeStr = timeframe === '1W'
      ? pointDate.toLocaleDateString('en-IN', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
      : pointDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    const price = values[i];
    const change = round2(price - startPrice);
    const changePercent = round2((change / startPrice) * 100);

    points.push({
      time: timeStr,
      price,
      change,
      changePercent,
    });
  }

  return points;
}
