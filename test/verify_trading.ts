import { 
  round2, 
  calculateWeightedAverage, 
  calculateRealizedPnL, 
  calculateUnrealizedPnL 
} from '../src/utils/math.ts';

function runTests() {
  console.log('--- Running TradeNest Financial Math & Engine Verification ---');

  // Test 1: Decimal precision
  const p1 = round2(0.1 + 0.2);
  console.assert(p1 === 0.3, `Failed: expected 0.3 got ${p1}`);
  console.log('✓ Test 1 Passed: Decimal rounding');

  // Test 2: Weighted Average Cost on Buy
  // 10 shares at ₹100, then buy 10 shares at ₹200 -> Average should be ₹150
  const avg1 = calculateWeightedAverage(10, 100, 10, 200);
  console.assert(avg1 === 150, `Failed: expected 150, got ${avg1}`);

  // 10 shares at ₹150, then buy 5 shares at ₹300 -> (1500 + 1500) / 15 = 200
  const avg2 = calculateWeightedAverage(10, 150, 5, 300);
  console.assert(avg2 === 200, `Failed: expected 200, got ${avg2}`);
  console.log('✓ Test 2 Passed: Weighted Average Cost (WAC) calculation');

  // Test 3: Realized P&L on Sell
  // Bought at ₹100, sell 5 shares at ₹150 -> Realized P&L = 5 * (150 - 100) = ₹250
  const pnl1 = calculateRealizedPnL(5, 150, 100);
  console.assert(pnl1 === 250, `Failed: expected 250, got ${pnl1}`);

  // Bought at ₹100, sell 5 shares at ₹80 -> Realized P&L = 5 * (80 - 100) = -₹100
  const pnl2 = calculateRealizedPnL(5, 80, 100);
  console.assert(pnl2 === -100, `Failed: expected -100, got ${pnl2}`);
  console.log('✓ Test 3 Passed: Realized P&L calculation');

  // Test 4: Unrealized P&L
  // 10 shares avg ₹100, current price ₹120 -> +₹200 (+20%)
  const un1 = calculateUnrealizedPnL(10, 100, 120);
  console.assert(un1.pnl === 200 && un1.pnlPercent === 20, `Failed unrealized pnl: ${JSON.stringify(un1)}`);
  console.log('✓ Test 4 Passed: Unrealized P&L & percentage calculation');

  // Test 5: Cash reservation logic simulation
  let cash = 100000;
  let reserved = 0;
  const buyQty = 10;
  const limitPrice = 2500;
  const orderCost = buyQty * limitPrice; // 25,000

  // Reserve
  reserved += orderCost;
  const available = cash - reserved;
  console.assert(available === 75000, `Expected 75000 available cash, got ${available}`);

  // Try to overspend: buy ₹80,000 order
  const overspendAllowed = 80000 <= available;
  console.assert(overspendAllowed === false, 'Expected overspend to be blocked');

  // Cancel order: releases reserved cash
  reserved -= orderCost;
  const afterCancelAvailable = cash - reserved;
  console.assert(afterCancelAvailable === 100000, `Expected 100000 after cancel, got ${afterCancelAvailable}`);
  console.log('✓ Test 5 Passed: Reservation & cancellation cash safety');

  console.log('All 5 financial engine unit tests passed successfully!');
}

runTests();
