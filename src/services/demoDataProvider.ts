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
import { INITIAL_STOCKS } from '../data/stocks';
import { INITIAL_INDICES } from '../data/indices';
import { 
  simulatePriceTick, 
  simulateIndexTick, 
  generateConsistentHistory 
} from './marketSimulator';
import { 
  round2, 
  calculateWeightedAverage, 
  calculateRealizedPnL, 
  calculateUnrealizedPnL 
} from '../utils/math';

const STORAGE_KEY_PREFIX = 'tradenest_demo_';
const INITIAL_CASH = 100000; // ₹1,00,000

interface StoredHolding {
  symbol: string;
  quantity: number;
  reservedQuantity: number;
  averageBuyPrice: number;
}

interface StoredAccount {
  virtualCash: number;
  reservedCash: number;
  realizedPnl: number;
}

export class DemoDataProvider implements ITradingDataProvider {
  private stocks: Map<string, StockQuote> = new Map();
  private indices: IndexOverview[] = [];
  private holdings: Map<string, StoredHolding> = new Map();
  private orders: Order[] = [];
  private transactions: Transaction[] = [];
  private watchlist: Set<string> = new Set();
  private account: StoredAccount = {
    virtualCash: INITIAL_CASH,
    reservedCash: 0,
    realizedPnl: 0,
  };
  private isProcessing = false;
  private tickSubscribers: Set<(stocks: StockQuote[], indices: IndexOverview[], executedOrders?: Order[]) => void> = new Set();
  private intervalId: number | null = null;

  public destroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  constructor() {
    this.initializeData();
    this.startSimulationEngine();
  }

  private initializeData(): void {
    // 1. Initialize stocks
    INITIAL_STOCKS.forEach(stock => {
      this.stocks.set(stock.symbol, { ...stock });
    });

    // 2. Initialize indices
    this.indices = INITIAL_INDICES.map(idx => ({ ...idx }));

    // 3. Load persisted state from localStorage
    try {
      const storedAccount = localStorage.getItem(STORAGE_KEY_PREFIX + 'account');
      if (storedAccount) {
        this.account = JSON.parse(storedAccount);
      }

      const storedHoldings = localStorage.getItem(STORAGE_KEY_PREFIX + 'holdings');
      if (storedHoldings) {
        const parsed: StoredHolding[] = JSON.parse(storedHoldings);
        parsed.forEach(h => this.holdings.set(h.symbol, h));
      }

      const storedOrders = localStorage.getItem(STORAGE_KEY_PREFIX + 'orders');
      if (storedOrders) {
        this.orders = JSON.parse(storedOrders);
      }

      const storedTransactions = localStorage.getItem(STORAGE_KEY_PREFIX + 'transactions');
      if (storedTransactions) {
        this.transactions = JSON.parse(storedTransactions);
      }

      const storedWatchlist = localStorage.getItem(STORAGE_KEY_PREFIX + 'watchlist');
      if (storedWatchlist) {
        const parsed: string[] = JSON.parse(storedWatchlist);
        this.watchlist = new Set(parsed);
      } else {
        // Default popular stocks in watchlist
        this.watchlist = new Set(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS']);
        this.saveWatchlist();
      }
    } catch (e) {
      console.warn('Failed to load demo data from localStorage, using initial defaults', e);
    }
  }

  private saveAccount(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'account', JSON.stringify(this.account));
    } catch (e) {
      console.error('Error saving account to localStorage', e);
    }
  }

  private saveHoldings(): void {
    try {
      const list = Array.from(this.holdings.values());
      localStorage.setItem(STORAGE_KEY_PREFIX + 'holdings', JSON.stringify(list));
    } catch (e) {
      console.error('Error saving holdings to localStorage', e);
    }
  }

  private saveOrders(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'orders', JSON.stringify(this.orders));
    } catch (e) {
      console.error('Error saving orders to localStorage', e);
    }
  }

  private saveTransactions(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'transactions', JSON.stringify(this.transactions));
    } catch (e) {
      console.error('Error saving transactions to localStorage', e);
    }
  }

  private saveWatchlist(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'watchlist', JSON.stringify(Array.from(this.watchlist)));
    } catch (e) {
      console.error('Error saving watchlist to localStorage', e);
    }
  }

  // --- Start Real-time Simulation Engine ---
  private startSimulationEngine(): void {
    if (typeof window === 'undefined') return;

    // Tick every 3.5 seconds
    this.intervalId = window.setInterval(() => {
      // Pick 4 to 8 random stocks to update per tick for realistic activity
      const stockKeys = Array.from(this.stocks.keys());
      const shuffled = stockKeys.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.floor(Math.random() * 5) + 4);

      selected.forEach(symbol => {
        const stock = this.stocks.get(symbol);
        if (stock) {
          const updated = simulatePriceTick(stock);
          this.stocks.set(symbol, updated);
        }
      });

      // Update indices
      this.indices = this.indices.map(idx => simulateIndexTick(idx));

      // Match pending limit orders against updated market prices!
      const executedOrders = this.checkAndMatchLimitOrders();

      // Notify subscribers
      const allStocks = Array.from(this.stocks.values());
      this.tickSubscribers.forEach(cb => cb(allStocks, this.indices, executedOrders));
    }, 3500);
  }

  /**
   * Matches pending limit orders when prices cross thresholds
   */
  private checkAndMatchLimitOrders(): Order[] {
    const executed: Order[] = [];
    let stateChanged = false;

    for (let i = 0; i < this.orders.length; i++) {
      const order = this.orders[i];
      if (order.status !== 'PENDING' || order.orderType !== 'LIMIT' || !order.limitPrice) {
        continue;
      }

      const stock = this.stocks.get(order.symbol);
      if (!stock) continue;

      const currentPrice = stock.price;

      // BUY LIMIT: executes when current price <= limit price
      if (order.side === 'BUY' && currentPrice <= order.limitPrice) {
        const execPrice = currentPrice;
        const actualCost = round2(order.quantity * execPrice);
        const reservedCost = round2(order.quantity * order.limitPrice);

        // Deduct actual cost from virtualCash, release reservedCash
        this.account.virtualCash = round2(this.account.virtualCash - actualCost);
        this.account.reservedCash = Math.max(0, round2(this.account.reservedCash - reservedCost));

        // Update Holdings
        const existing = this.holdings.get(order.symbol);
        if (existing) {
          const newAvg = calculateWeightedAverage(
            existing.quantity,
            existing.averageBuyPrice,
            order.quantity,
            execPrice
          );
          existing.quantity += order.quantity;
          existing.averageBuyPrice = newAvg;
          this.holdings.set(order.symbol, existing);
        } else {
          this.holdings.set(order.symbol, {
            symbol: order.symbol,
            quantity: order.quantity,
            reservedQuantity: 0,
            averageBuyPrice: execPrice,
          });
        }

        // Update order status
        order.status = 'EXECUTED';
        order.executionPrice = execPrice;
        order.totalAmount = actualCost;
        order.executedAt = new Date().toISOString();

        // Create transaction record
        const transaction: Transaction = {
          id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          orderId: order.id,
          symbol: order.symbol,
          companyName: order.companyName,
          side: 'BUY',
          quantity: order.quantity,
          price: execPrice,
          totalValue: actualCost,
          createdAt: new Date().toISOString(),
        };
        this.transactions.unshift(transaction);

        executed.push(order);
        stateChanged = true;
      }

      // SELL LIMIT: executes when current price >= limit price
      else if (order.side === 'SELL' && currentPrice >= order.limitPrice) {
        const execPrice = currentPrice;
        const totalSaleValue = round2(order.quantity * execPrice);

        const holding = this.holdings.get(order.symbol);
        if (holding) {
          const realizedPnl = calculateRealizedPnL(order.quantity, execPrice, holding.averageBuyPrice);
          this.account.realizedPnl = round2(this.account.realizedPnl + realizedPnl);
          this.account.virtualCash = round2(this.account.virtualCash + totalSaleValue);

          holding.quantity -= order.quantity;
          holding.reservedQuantity = Math.max(0, holding.reservedQuantity - order.quantity);

          if (holding.quantity <= 0) {
            this.holdings.delete(order.symbol);
          } else {
            this.holdings.set(order.symbol, holding);
          }

          // Update order status
          order.status = 'EXECUTED';
          order.executionPrice = execPrice;
          order.totalAmount = totalSaleValue;
          order.executedAt = new Date().toISOString();

          // Create transaction record
          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: order.symbol,
            companyName: order.companyName,
            side: 'SELL',
            quantity: order.quantity,
            price: execPrice,
            totalValue: totalSaleValue,
            realizedPnl,
            createdAt: new Date().toISOString(),
          };
          this.transactions.unshift(transaction);

          executed.push(order);
          stateChanged = true;
        }
      }
    }

    if (stateChanged) {
      this.saveAccount();
      this.saveHoldings();
      this.saveOrders();
      this.saveTransactions();
    }

    return executed;
  }

  // --- Public Interface Implementations ---

  async getStocks(): Promise<StockQuote[]> {
    return Array.from(this.stocks.values());
  }

  async getStock(symbol: string): Promise<StockQuote | null> {
    const stock = this.stocks.get(symbol.toUpperCase());
    return stock ? { ...stock } : null;
  }

  async getIndices(): Promise<IndexOverview[]> {
    return [...this.indices];
  }

  async getHistoricalData(symbol: string, timeframe: TimeFrame): Promise<PricePoint[]> {
    const stock = this.stocks.get(symbol.toUpperCase());
    if (!stock) return [];
    return generateConsistentHistory(stock, timeframe);
  }

  async getAccountSummary(): Promise<AccountSummary> {
    const holdings = await this.getHoldings();
    const portfolioMarketValue = round2(holdings.reduce((sum, h) => sum + h.currentValue, 0));
    const totalInvested = round2(holdings.reduce((sum, h) => sum + h.investedValue, 0));
    const unrealizedPnl = round2(portfolioMarketValue - totalInvested);
    const unrealizedPnlPercent = totalInvested > 0 ? round2((unrealizedPnl / totalInvested) * 100) : 0;
    const availableCash = round2(this.account.virtualCash - this.account.reservedCash);
    const totalAccountValue = round2(this.account.virtualCash + portfolioMarketValue);

    return {
      virtualCash: this.account.virtualCash,
      reservedCash: this.account.reservedCash,
      availableCash,
      portfolioMarketValue,
      totalAccountValue,
      totalInvested,
      unrealizedPnl,
      unrealizedPnlPercent,
      realizedPnl: this.account.realizedPnl,
      lastUpdated: new Date().toISOString(),
    };
  }

  async getHoldings(): Promise<Holding[]> {
    const result: Holding[] = [];
    let totalPortfolioValue = 0;

    // First calculate current values
    const list: { holding: StoredHolding; stock: StockQuote; currentValue: number; investedValue: number }[] = [];

    this.holdings.forEach((stored, symbol) => {
      const stock = this.stocks.get(symbol);
      if (stock && stored.quantity > 0) {
        const investedValue = round2(stored.quantity * stored.averageBuyPrice);
        const currentValue = round2(stored.quantity * stock.price);
        totalPortfolioValue += currentValue;
        list.push({ holding: stored, stock, currentValue, investedValue });
      }
    });

    list.forEach(({ holding, stock, currentValue, investedValue }) => {
      const { pnl, pnlPercent } = calculateUnrealizedPnL(
        holding.quantity,
        holding.averageBuyPrice,
        stock.price
      );
      const availableQuantity = Math.max(0, holding.quantity - holding.reservedQuantity);
      const allocationPercent = totalPortfolioValue > 0 ? round2((currentValue / totalPortfolioValue) * 100) : 0;

      result.push({
        symbol: stock.symbol,
        companyName: stock.name,
        sector: stock.sector,
        quantity: holding.quantity,
        reservedQuantity: holding.reservedQuantity,
        availableQuantity,
        averageBuyPrice: holding.averageBuyPrice,
        currentPrice: stock.price,
        investedValue,
        currentValue,
        unrealizedPnl: pnl,
        unrealizedPnlPercent: pnlPercent,
        allocationPercent,
      });
    });

    return result.sort((a, b) => b.currentValue - a.currentValue);
  }

  async getOrders(): Promise<Order[]> {
    return [...this.orders];
  }

  async getTransactions(): Promise<Transaction[]> {
    return [...this.transactions];
  }

  /**
   * Places an order atomically with full validation and reservation logic
   */
  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    if (this.isProcessing) {
      return { success: false, error: 'A transaction is currently processing. Please wait.' };
    }
    this.isProcessing = true;

    try {
      const stock = this.stocks.get(request.symbol.toUpperCase());
      if (!stock) {
        return { success: false, error: `Stock ${request.symbol} not found.` };
      }

      // Quantity validation
      if (!Number.isInteger(request.quantity) || request.quantity <= 0) {
        return { success: false, error: 'Order quantity must be a positive whole number.' };
      }

      // Limit price validation
      if (request.orderType === 'LIMIT') {
        if (!request.limitPrice || request.limitPrice <= 0) {
          return { success: false, error: 'Please enter a valid limit price.' };
        }
      }

      const orderPrice = request.orderType === 'LIMIT' ? request.limitPrice! : stock.price;
      const totalAmount = round2(request.quantity * orderPrice);
      const availableCash = round2(this.account.virtualCash - this.account.reservedCash);

      // --- BUY ORDER VALIDATION ---
      if (request.side === 'BUY') {
        if (totalAmount > availableCash) {
          return {
            success: false,
            error: `Insufficient virtual cash. Available: ₹${availableCash.toLocaleString('en-IN')}, Required: ₹${totalAmount.toLocaleString('en-IN')}.`,
          };
        }

        // Market Buy executes immediately
        if (request.orderType === 'MARKET') {
          this.account.virtualCash = round2(this.account.virtualCash - totalAmount);

          const existing = this.holdings.get(stock.symbol);
          if (existing) {
            const newAvg = calculateWeightedAverage(
              existing.quantity,
              existing.averageBuyPrice,
              request.quantity,
              orderPrice
            );
            existing.quantity += request.quantity;
            existing.averageBuyPrice = newAvg;
            this.holdings.set(stock.symbol, existing);
          } else {
            this.holdings.set(stock.symbol, {
              symbol: stock.symbol,
              quantity: request.quantity,
              reservedQuantity: 0,
              averageBuyPrice: orderPrice,
            });
          }

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: 'demo_user',
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            orderType: 'MARKET',
            quantity: request.quantity,
            executionPrice: orderPrice,
            totalAmount,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
          };
          this.orders.unshift(order);

          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            quantity: request.quantity,
            price: orderPrice,
            totalValue: totalAmount,
            createdAt: new Date().toISOString(),
          };
          this.transactions.unshift(transaction);

          this.saveAccount();
          this.saveHoldings();
          this.saveOrders();
          this.saveTransactions();

          return { success: true, order, message: `Successfully bought ${request.quantity} shares of ${stock.symbol} at ₹${orderPrice}.` };
        }

        // Limit Buy: Check if price satisfies condition immediately or place pending order
        if (stock.price <= orderPrice) {
          // Immediately fills at market price
          const execCost = round2(request.quantity * stock.price);
          this.account.virtualCash = round2(this.account.virtualCash - execCost);

          const existing = this.holdings.get(stock.symbol);
          if (existing) {
            const newAvg = calculateWeightedAverage(
              existing.quantity,
              existing.averageBuyPrice,
              request.quantity,
              stock.price
            );
            existing.quantity += request.quantity;
            existing.averageBuyPrice = newAvg;
            this.holdings.set(stock.symbol, existing);
          } else {
            this.holdings.set(stock.symbol, {
              symbol: stock.symbol,
              quantity: request.quantity,
              reservedQuantity: 0,
              averageBuyPrice: stock.price,
            });
          }

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: 'demo_user',
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            orderType: 'LIMIT',
            quantity: request.quantity,
            limitPrice: orderPrice,
            executionPrice: stock.price,
            totalAmount: execCost,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
          };
          this.orders.unshift(order);

          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            quantity: request.quantity,
            price: stock.price,
            totalValue: execCost,
            createdAt: new Date().toISOString(),
          };
          this.transactions.unshift(transaction);

          this.saveAccount();
          this.saveHoldings();
          this.saveOrders();
          this.saveTransactions();

          return { success: true, order, message: `Limit order filled immediately at ₹${stock.price} (below limit ₹${orderPrice}).` };
        } else {
          // Reserve cash and record PENDING order
          this.account.reservedCash = round2(this.account.reservedCash + totalAmount);

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: 'demo_user',
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            orderType: 'LIMIT',
            quantity: request.quantity,
            limitPrice: orderPrice,
            totalAmount,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          this.orders.unshift(order);

          this.saveAccount();
          this.saveOrders();

          return { success: true, order, message: `Buy limit order placed for ${request.quantity} shares of ${stock.symbol} at ₹${orderPrice}. Funds reserved.` };
        }
      }

      // --- SELL ORDER VALIDATION ---
      if (request.side === 'SELL') {
        const holding = this.holdings.get(stock.symbol);
        const availableQty = holding ? Math.max(0, holding.quantity - holding.reservedQuantity) : 0;

        if (availableQty < request.quantity) {
          return {
            success: false,
            error: `Insufficient shares. Sellable holdings: ${availableQty} shares, Requested: ${request.quantity} shares.`,
          };
        }

        // Market Sell executes immediately
        if (request.orderType === 'MARKET') {
          const saleValue = round2(request.quantity * stock.price);
          const realizedPnl = calculateRealizedPnL(request.quantity, stock.price, holding!.averageBuyPrice);

          this.account.virtualCash = round2(this.account.virtualCash + saleValue);
          this.account.realizedPnl = round2(this.account.realizedPnl + realizedPnl);

          holding!.quantity -= request.quantity;
          if (holding!.quantity <= 0) {
            this.holdings.delete(stock.symbol);
          } else {
            this.holdings.set(stock.symbol, holding!);
          }

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: 'demo_user',
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            orderType: 'MARKET',
            quantity: request.quantity,
            executionPrice: stock.price,
            totalAmount: saleValue,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
          };
          this.orders.unshift(order);

          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            quantity: request.quantity,
            price: stock.price,
            totalValue: saleValue,
            realizedPnl,
            createdAt: new Date().toISOString(),
          };
          this.transactions.unshift(transaction);

          this.saveAccount();
          this.saveHoldings();
          this.saveOrders();
          this.saveTransactions();

          return { 
            success: true, 
            order, 
            message: `Successfully sold ${request.quantity} shares of ${stock.symbol} at ₹${stock.price}. Realized P&L: ₹${realizedPnl >= 0 ? '+' : ''}${realizedPnl}.` 
          };
        }

        // Limit Sell
        if (stock.price >= orderPrice) {
          // Immediately fills at market price
          const saleValue = round2(request.quantity * stock.price);
          const realizedPnl = calculateRealizedPnL(request.quantity, stock.price, holding!.averageBuyPrice);

          this.account.virtualCash = round2(this.account.virtualCash + saleValue);
          this.account.realizedPnl = round2(this.account.realizedPnl + realizedPnl);

          holding!.quantity -= request.quantity;
          if (holding!.quantity <= 0) {
            this.holdings.delete(stock.symbol);
          } else {
            this.holdings.set(stock.symbol, holding!);
          }

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: 'demo_user',
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            orderType: 'LIMIT',
            quantity: request.quantity,
            limitPrice: orderPrice,
            executionPrice: stock.price,
            totalAmount: saleValue,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
          };
          this.orders.unshift(order);

          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            quantity: request.quantity,
            price: stock.price,
            totalValue: saleValue,
            realizedPnl,
            createdAt: new Date().toISOString(),
          };
          this.transactions.unshift(transaction);

          this.saveAccount();
          this.saveHoldings();
          this.saveOrders();
          this.saveTransactions();

          return { success: true, order, message: `Sell limit order filled immediately at ₹${stock.price}.` };
        } else {
          // Reserve shares and record PENDING order
          holding!.reservedQuantity += request.quantity;
          this.holdings.set(stock.symbol, holding!);

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: 'demo_user',
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            orderType: 'LIMIT',
            quantity: request.quantity,
            limitPrice: orderPrice,
            totalAmount,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };
          this.orders.unshift(order);

          this.saveHoldings();
          this.saveOrders();

          return { success: true, order, message: `Sell limit order placed for ${request.quantity} shares of ${stock.symbol} at ₹${orderPrice}. Shares reserved.` };
        }
      }

      return { success: false, error: 'Invalid order side.' };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cancels a pending order and releases reserved cash/shares
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const order = this.orders.find(o => o.id === orderId);
    if (!order || order.status !== 'PENDING') {
      return false;
    }

    if (order.side === 'BUY' && order.limitPrice) {
      const reserved = round2(order.quantity * order.limitPrice);
      this.account.reservedCash = Math.max(0, round2(this.account.reservedCash - reserved));
      this.saveAccount();
    } else if (order.side === 'SELL') {
      const holding = this.holdings.get(order.symbol);
      if (holding) {
        holding.reservedQuantity = Math.max(0, holding.reservedQuantity - order.quantity);
        this.holdings.set(order.symbol, holding);
        this.saveHoldings();
      }
    }

    order.status = 'CANCELLED';
    order.cancelledAt = new Date().toISOString();
    this.saveOrders();

    return true;
  }

  async getWatchlist(): Promise<string[]> {
    return Array.from(this.watchlist);
  }

  async toggleWatchlist(symbol: string): Promise<string[]> {
    const upper = symbol.toUpperCase();
    if (this.watchlist.has(upper)) {
      this.watchlist.delete(upper);
    } else {
      this.watchlist.add(upper);
    }
    this.saveWatchlist();
    return Array.from(this.watchlist);
  }

  /**
   * Resets demo account to initial ₹1,00,000 cash and clears history
   */
  async resetAccount(): Promise<void> {
    this.account = {
      virtualCash: INITIAL_CASH,
      reservedCash: 0,
      realizedPnl: 0,
    };
    this.holdings.clear();
    this.orders = [];
    this.transactions = [];
    this.watchlist = new Set(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS']);

    this.saveAccount();
    this.saveHoldings();
    this.saveOrders();
    this.saveTransactions();
    this.saveWatchlist();
  }

  subscribeMarketTicks(
    callback: (stocks: StockQuote[], indices: IndexOverview[], executedOrders?: Order[]) => void
  ): () => void {
    this.tickSubscribers.add(callback);
    return () => {
      this.tickSubscribers.delete(callback);
    };
  }
}
