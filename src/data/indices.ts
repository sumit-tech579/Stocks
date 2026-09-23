import { IndexOverview } from '../types/stock';

export const INITIAL_INDICES: IndexOverview[] = [
  {
    symbol: 'NIFTY 50',
    name: 'NIFTY 50',
    value: 25418.50,
    previousClose: 25305.20,
    change: 113.30,
    changePercent: 0.45,
    high: 25480.00,
    low: 25290.10,
    lastUpdated: new Date().toISOString(),
  },
  {
    symbol: 'SENSEX',
    name: 'BSE SENSEX',
    value: 83120.40,
    previousClose: 82780.00,
    change: 340.40,
    changePercent: 0.41,
    high: 83310.20,
    low: 82750.00,
    lastUpdated: new Date().toISOString(),
  },
  {
    symbol: 'NIFTY BANK',
    name: 'NIFTY BANK',
    value: 52180.75,
    previousClose: 51850.50,
    change: 330.25,
    changePercent: 0.64,
    high: 52350.00,
    low: 51810.00,
    lastUpdated: new Date().toISOString(),
  }
];
