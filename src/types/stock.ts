export type Sector = 
  | 'All'
  | 'Banking & Finance'
  | 'IT Services'
  | 'Oil, Gas & Energy'
  | 'Consumer Goods'
  | 'Automobile'
  | 'Pharmaceuticals'
  | 'Infrastructure & Metals';

export type TimeFrame = '1D' | '1W' | '1M' | '3M' | '1Y';

export interface PricePoint {
  time: string; // ISO string or time label like '09:15', '10:30' or '2024-01-01'
  price: number;
  change?: number;
  changePercent?: number;
}

export interface StockQuote {
  symbol: string;
  name: string;
  sector: Sector;
  exchange: 'NSE' | 'BSE';
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  week52High: number;
  week52Low: number;
  marketCap: number; // In Crores (INR)
  peRatio: number;
  about: string;
  lastUpdated: string;
}

export interface IndexOverview {
  symbol: string;
  name: string;
  value: number;
  previousClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  lastUpdated: string;
}
