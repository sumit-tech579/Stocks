import { StockQuote, PricePoint, TimeFrame, IndexOverview } from '../types/stock';
import { 
  Order, 
  Holding, 
  Transaction, 
  AccountSummary, 
  OrderRequest, 
  OrderResult 
} from '../types/trading';

export interface ITradingDataProvider {
  // Market Data
  getStocks(): Promise<StockQuote[]>;
  getStock(symbol: string): Promise<StockQuote | null>;
  getIndices(): Promise<IndexOverview[]>;
  getHistoricalData(symbol: string, timeframe: TimeFrame): Promise<PricePoint[]>;

  // Portfolio & Account
  getAccountSummary(): Promise<AccountSummary>;
  getHoldings(): Promise<Holding[]>;
  getOrders(): Promise<Order[]>;
  getTransactions(): Promise<Transaction[]>;

  // Trading Actions
  placeOrder(request: OrderRequest): Promise<OrderResult>;
  cancelOrder(orderId: string): Promise<boolean>;

  // Watchlist
  getWatchlist(): Promise<string[]>;
  toggleWatchlist(symbol: string): Promise<string[]>;

  // Demo Controls
  resetAccount(): Promise<void>;
  
  // Real-time Tick Subscription
  subscribeMarketTicks(
    callback: (stocks: StockQuote[], indices: IndexOverview[], executedOrders?: Order[]) => void
  ): () => void;
}
