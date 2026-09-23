import { ITradingDataProvider } from './dataProvider';
import { StockQuote, PricePoint, TimeFrame, IndexOverview } from '../types/stock';
import { 
  Order, 
  Holding, 
  Transaction, 
  AccountSummary, 
  OrderRequest, 
  OrderResult 
} from '../types/trading';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { DemoDataProvider } from './demoDataProvider';

/**
 * Supabase Data Provider connects to Supabase database when authenticated.
 * Seamlessly delegates to DemoDataProvider if Supabase is unconfigured or in demo mode.
 */
export class SupabaseDataProvider implements ITradingDataProvider {
  private fallbackProvider: DemoDataProvider;

  constructor(fallbackProvider: DemoDataProvider) {
    this.fallbackProvider = fallbackProvider;
  }

  private async getUserId(): Promise<string | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  }

  async getStocks(): Promise<StockQuote[]> {
    return this.fallbackProvider.getStocks();
  }

  async getStock(symbol: string): Promise<StockQuote | null> {
    return this.fallbackProvider.getStock(symbol);
  }

  async getIndices(): Promise<IndexOverview[]> {
    return this.fallbackProvider.getIndices();
  }

  async getHistoricalData(symbol: string, timeframe: TimeFrame): Promise<PricePoint[]> {
    return this.fallbackProvider.getHistoricalData(symbol, timeframe);
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.getAccountSummary();
    }

    try {
      const { data: accountData, error: accountError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (accountError || !accountData) {
        return this.fallbackProvider.getAccountSummary();
      }

      const holdings = await this.getHoldings();
      const portfolioMarketValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
      const unrealizedPnl = portfolioMarketValue - totalInvested;
      const unrealizedPnlPercent = totalInvested > 0 ? (unrealizedPnl / totalInvested) * 100 : 0;
      const virtualCash = Number(accountData.cash_balance);
      const reservedCash = Number(accountData.reserved_cash);
      const availableCash = virtualCash - reservedCash;
      const totalAccountValue = virtualCash + portfolioMarketValue;

      return {
        virtualCash,
        reservedCash,
        availableCash,
        portfolioMarketValue,
        totalAccountValue,
        totalInvested,
        unrealizedPnl,
        unrealizedPnlPercent,
        realizedPnl: Number(accountData.realized_pnl),
        lastUpdated: new Date().toISOString(),
      };
    } catch {
      return this.fallbackProvider.getAccountSummary();
    }
  }

  async getHoldings(): Promise<Holding[]> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.getHoldings();
    }

    try {
      const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .eq('user_id', userId)
        .gt('quantity', 0);

      if (error || !data) {
        return this.fallbackProvider.getHoldings();
      }

      const stocks = await this.getStocks();
      const stockMap = new Map(stocks.map(s => [s.symbol, s]));

      const list: Holding[] = [];
      let totalPortfolioValue = 0;

      data.forEach(h => {
        const stock = stockMap.get(h.symbol);
        if (stock) {
          const qty = Number(h.quantity);
          const currentVal = qty * stock.price;
          totalPortfolioValue += currentVal;
        }
      });

      data.forEach(h => {
        const stock = stockMap.get(h.symbol);
        if (stock) {
          const qty = Number(h.quantity);
          const reservedQty = Number(h.reserved_quantity || 0);
          const avgPrice = Number(h.average_buy_price);
          const investedValue = qty * avgPrice;
          const currentValue = qty * stock.price;
          const unrealizedPnl = currentValue - investedValue;
          const unrealizedPnlPercent = investedValue > 0 ? (unrealizedPnl / investedValue) * 100 : 0;
          const allocationPercent = totalPortfolioValue > 0 ? (currentValue / totalPortfolioValue) * 100 : 0;

          list.push({
            symbol: stock.symbol,
            companyName: stock.name,
            sector: stock.sector,
            quantity: qty,
            reservedQuantity: reservedQty,
            availableQuantity: Math.max(0, qty - reservedQty),
            averageBuyPrice: avgPrice,
            currentPrice: stock.price,
            investedValue,
            currentValue,
            unrealizedPnl,
            unrealizedPnlPercent,
            allocationPercent,
          });
        }
      });

      return list.sort((a, b) => b.currentValue - a.currentValue);
    } catch {
      return this.fallbackProvider.getHoldings();
    }
  }

  async getOrders(): Promise<Order[]> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.getOrders();
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return this.fallbackProvider.getOrders();
      }

      return data.map(d => ({
        id: d.id,
        userId: d.user_id,
        symbol: d.symbol,
        companyName: d.company_name,
        side: d.side,
        orderType: d.order_type,
        quantity: d.quantity,
        limitPrice: d.limit_price ? Number(d.limit_price) : undefined,
        executionPrice: d.execution_price ? Number(d.execution_price) : undefined,
        totalAmount: Number(d.total_amount),
        status: d.status,
        rejectionReason: d.rejection_reason,
        createdAt: d.created_at,
        executedAt: d.executed_at,
        cancelledAt: d.cancelled_at,
      }));
    } catch {
      return this.fallbackProvider.getOrders();
    }
  }

  async getTransactions(): Promise<Transaction[]> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.getTransactions();
    }

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error || !data) {
        return this.fallbackProvider.getTransactions();
      }

      return data.map(d => ({
        id: d.id,
        orderId: d.order_id,
        symbol: d.symbol,
        companyName: d.company_name,
        side: d.side,
        quantity: d.quantity,
        price: Number(d.price),
        totalValue: Number(d.total_value),
        realizedPnl: d.realized_pnl ? Number(d.realized_pnl) : undefined,
        createdAt: d.created_at,
      }));
    } catch {
      return this.fallbackProvider.getTransactions();
    }
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.placeOrder(request);
    }

    // When logged in via Supabase, we can use the DemoDataProvider simulation engine
    // or perform direct mutations, sync to Supabase table
    return this.fallbackProvider.placeOrder(request);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.cancelOrder(orderId);
    }
    return this.fallbackProvider.cancelOrder(orderId);
  }

  async getWatchlist(): Promise<string[]> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.getWatchlist();
    }

    try {
      const { data, error } = await supabase
        .from('watchlists')
        .select('symbol')
        .eq('user_id', userId);

      if (error || !data) {
        return this.fallbackProvider.getWatchlist();
      }

      return data.map(d => d.symbol);
    } catch {
      return this.fallbackProvider.getWatchlist();
    }
  }

  async toggleWatchlist(symbol: string): Promise<string[]> {
    const userId = await this.getUserId();
    if (!userId || !supabase) {
      return this.fallbackProvider.toggleWatchlist(symbol);
    }

    try {
      const current = await this.getWatchlist();
      const has = current.includes(symbol);

      if (has) {
        await supabase
          .from('watchlists')
          .delete()
          .eq('user_id', userId)
          .eq('symbol', symbol);
      } else {
        await supabase
          .from('watchlists')
          .insert({ user_id: userId, symbol });
      }

      return this.getWatchlist();
    } catch {
      return this.fallbackProvider.toggleWatchlist(symbol);
    }
  }

  async resetAccount(): Promise<void> {
    return this.fallbackProvider.resetAccount();
  }

  subscribeMarketTicks(
    callback: (stocks: StockQuote[], indices: IndexOverview[], executedOrders?: Order[]) => void
  ): () => void {
    return this.fallbackProvider.subscribeMarketTicks(callback);
  }
}
