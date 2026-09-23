export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED';

export interface Order {
  id: string;
  userId: string;
  symbol: string;
  companyName: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;
  executionPrice?: number;
  totalAmount: number;
  status: OrderStatus;
  rejectionReason?: string;
  createdAt: string;
  executedAt?: string;
  cancelledAt?: string;
}

export interface Holding {
  symbol: string;
  companyName: string;
  sector: string;
  quantity: number; // total shares owned
  reservedQuantity: number; // shares locked for pending sell limit orders
  availableQuantity: number; // quantity - reservedQuantity
  averageBuyPrice: number;
  currentPrice: number;
  investedValue: number; // quantity * averageBuyPrice
  currentValue: number; // quantity * currentPrice
  unrealizedPnl: number; // currentValue - investedValue
  unrealizedPnlPercent: number; // (unrealizedPnl / investedValue) * 100
  allocationPercent: number; // (currentValue / totalPortfolioValue) * 100
}

export interface Transaction {
  id: string;
  orderId: string;
  symbol: string;
  companyName: string;
  side: OrderSide;
  quantity: number;
  price: number;
  totalValue: number;
  realizedPnl?: number; // realized PnL on sell orders
  createdAt: string;
}

export interface AccountSummary {
  virtualCash: number; // total cash balance in account
  reservedCash: number; // cash reserved for pending buy limit orders
  availableCash: number; // virtualCash - reservedCash
  portfolioMarketValue: number;
  totalAccountValue: number; // virtualCash + portfolioMarketValue
  totalInvested: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  lastUpdated: string;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;
}

export interface OrderResult {
  success: boolean;
  order?: Order;
  error?: string;
  message?: string;
}
