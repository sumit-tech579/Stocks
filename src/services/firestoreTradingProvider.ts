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
import { 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs,
  serverTimestamp 
} from './firebaseClient';

const INITIAL_CASH = 100000; // ₹1,00,000 initial virtual cash

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

export class FirestoreTradingProvider implements ITradingDataProvider {
  private userId: string;
  private storagePrefix: string;
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

  constructor(userId: string) {
    this.userId = userId;
    this.storagePrefix = `tradenest_user_${userId}_`;
    this.initializeData();
    this.startSimulationEngine();
    this.syncFromFirestore();
  }

  public destroy(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.tickSubscribers.clear();
  }

  private initializeData(): void {
    INITIAL_STOCKS.forEach(stock => {
      this.stocks.set(stock.symbol, { ...stock });
    });
    this.indices = INITIAL_INDICES.map(idx => ({ ...idx }));

    // Load from user-scoped localStorage as initial cache
    try {
      const storedAccount = localStorage.getItem(this.storagePrefix + 'account');
      if (storedAccount) {
        this.account = JSON.parse(storedAccount);
      }

      const storedHoldings = localStorage.getItem(this.storagePrefix + 'holdings');
      if (storedHoldings) {
        const parsed: StoredHolding[] = JSON.parse(storedHoldings);
        parsed.forEach(h => this.holdings.set(h.symbol, h));
      }

      const storedOrders = localStorage.getItem(this.storagePrefix + 'orders');
      if (storedOrders) {
        this.orders = JSON.parse(storedOrders);
      }

      const storedTransactions = localStorage.getItem(this.storagePrefix + 'transactions');
      if (storedTransactions) {
        this.transactions = JSON.parse(storedTransactions);
      }

      const storedWatchlist = localStorage.getItem(this.storagePrefix + 'watchlist');
      if (storedWatchlist) {
        const parsed: string[] = JSON.parse(storedWatchlist);
        this.watchlist = new Set(parsed);
      } else {
        this.watchlist = new Set(['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'TATAMOTORS']);
        this.saveLocalWatchlist();
      }
    } catch (e) {
      console.warn('Failed to load user local cache', e);
    }
  }

  private async syncFromFirestore(): Promise<void> {
    if (!db || !this.userId) return;

    try {
      // 1. Fetch user doc for balance and watchlist
      const userDocRef = doc(db, 'users', this.userId);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (typeof data.virtualCash === 'number') {
          this.account.virtualCash = data.virtualCash;
          this.account.reservedCash = data.reservedCash ?? 0;
          this.account.realizedPnl = data.realizedPnl ?? 0;
          this.saveLocalAccount();
        } else {
          // Initialize balance in Firestore if missing
          await setDoc(userDocRef, {
            virtualCash: INITIAL_CASH,
            reservedCash: 0,
            realizedPnl: 0,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }

        if (Array.isArray(data.watchlist)) {
          this.watchlist = new Set(data.watchlist);
          this.saveLocalWatchlist();
        }
      }

      // 2. Fetch Holdings subcollection
      const holdingsCol = collection(db, 'users', this.userId, 'holdings');
      const holdingsSnap = await getDocs(holdingsCol);
      if (!holdingsSnap.empty) {
        this.holdings.clear();
        holdingsSnap.forEach(d => {
          const h = d.data() as StoredHolding;
          this.holdings.set(h.symbol, h);
        });
        this.saveLocalHoldings();
      }

      // 3. Fetch Orders subcollection
      const ordersCol = collection(db, 'users', this.userId, 'orders');
      const ordersSnap = await getDocs(ordersCol);
      if (!ordersSnap.empty) {
        const loadedOrders: Order[] = [];
        ordersSnap.forEach(d => {
          loadedOrders.push(d.data() as Order);
        });
        loadedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.orders = loadedOrders;
        this.saveLocalOrders();
      }

      // 4. Fetch Transactions subcollection
      const txnCol = collection(db, 'users', this.userId, 'transactions');
      const txnSnap = await getDocs(txnCol);
      if (!txnSnap.empty) {
        const loadedTxns: Transaction[] = [];
        txnSnap.forEach(d => {
          loadedTxns.push(d.data() as Transaction);
        });
        loadedTxns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.transactions = loadedTxns;
        this.saveLocalTransactions();
      }
    } catch (e) {
      console.warn('Could not sync user data with Cloud Firestore (using local cached state):', e);
    }
  }

  private saveLocalAccount(): void {
    try {
      localStorage.setItem(this.storagePrefix + 'account', JSON.stringify(this.account));
    } catch (e) {
      console.error('Error saving account to localStorage', e);
    }
  }

  private saveLocalHoldings(): void {
    try {
      const list = Array.from(this.holdings.values());
      localStorage.setItem(this.storagePrefix + 'holdings', JSON.stringify(list));
    } catch (e) {
      console.error('Error saving holdings to localStorage', e);
    }
  }

  private saveLocalOrders(): void {
    try {
      localStorage.setItem(this.storagePrefix + 'orders', JSON.stringify(this.orders));
    } catch (e) {
      console.error('Error saving orders to localStorage', e);
    }
  }

  private saveLocalTransactions(): void {
    try {
      localStorage.setItem(this.storagePrefix + 'transactions', JSON.stringify(this.transactions));
    } catch (e) {
      console.error('Error saving transactions to localStorage', e);
    }
  }

  private saveLocalWatchlist(): void {
    try {
      localStorage.setItem(this.storagePrefix + 'watchlist', JSON.stringify(Array.from(this.watchlist)));
    } catch (e) {
      console.error('Error saving watchlist to localStorage', e);
    }
  }

  private async persistAccountCloud(): Promise<void> {
    if (!db || !this.userId) return;
    try {
      const userDocRef = doc(db, 'users', this.userId);
      await updateDoc(userDocRef, {
        virtualCash: this.account.virtualCash,
        reservedCash: this.account.reservedCash,
        realizedPnl: this.account.realizedPnl,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to update account in Firestore:', e);
    }
  }

  private async persistHoldingCloud(symbol: string): Promise<void> {
    if (!db || !this.userId) return;
    try {
      const holding = this.holdings.get(symbol);
      const holdingDocRef = doc(db, 'users', this.userId, 'holdings', symbol);
      if (holding && holding.quantity > 0) {
        await setDoc(holdingDocRef, holding, { merge: true });
      } else {
        await setDoc(holdingDocRef, { symbol, quantity: 0, reservedQuantity: 0, averageBuyPrice: 0 }, { merge: true });
      }
    } catch (e) {
      console.warn('Failed to update holding in Firestore:', e);
    }
  }

  private async persistOrderCloud(order: Order): Promise<void> {
    if (!db || !this.userId) return;
    try {
      const orderDocRef = doc(db, 'users', this.userId, 'orders', order.id);
      await setDoc(orderDocRef, order);
    } catch (e) {
      console.warn('Failed to save order in Firestore:', e);
    }
  }

  private async persistTransactionCloud(txn: Transaction): Promise<void> {
    if (!db || !this.userId) return;
    try {
      const txnDocRef = doc(db, 'users', this.userId, 'transactions', txn.id);
      await setDoc(txnDocRef, txn);
    } catch (e) {
      console.warn('Failed to save transaction in Firestore:', e);
    }
  }

  private async persistWatchlistCloud(): Promise<void> {
    if (!db || !this.userId) return;
    try {
      const userDocRef = doc(db, 'users', this.userId);
      await updateDoc(userDocRef, {
        watchlist: Array.from(this.watchlist),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Failed to save watchlist in Firestore:', e);
    }
  }

  // --- Real-time Simulation Engine ---
  private startSimulationEngine(): void {
    if (typeof window === 'undefined') return;

    this.intervalId = window.setInterval(() => {
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

      this.indices = this.indices.map(idx => simulateIndexTick(idx));

      const executedOrders = this.checkAndMatchLimitOrders();

      const allStocks = Array.from(this.stocks.values());
      this.tickSubscribers.forEach(cb => cb(allStocks, this.indices, executedOrders));
    }, 3500);
  }

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

      if (order.side === 'BUY' && currentPrice <= order.limitPrice) {
        const execPrice = currentPrice;
        const actualCost = round2(order.quantity * execPrice);
        const reservedCost = round2(order.quantity * order.limitPrice);

        this.account.virtualCash = round2(this.account.virtualCash - actualCost);
        this.account.reservedCash = Math.max(0, round2(this.account.reservedCash - reservedCost));

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

        order.status = 'EXECUTED';
        order.executionPrice = execPrice;
        order.totalAmount = actualCost;
        order.executedAt = new Date().toISOString();

        const transaction: Transaction = {
          id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          orderId: order.id,
          symbol: order.symbol,
          companyName: order.companyName,
          side: 'BUY',
          quantity: order.quantity,
          price: execPrice,
          totalValue: actualCost,
          createdAt: order.executedAt,
        };
        this.transactions.unshift(transaction);
        executed.push(order);
        stateChanged = true;

        this.persistOrderCloud(order);
        this.persistTransactionCloud(transaction);
        this.persistHoldingCloud(order.symbol);
      } else if (order.side === 'SELL' && currentPrice >= order.limitPrice) {
        const execPrice = currentPrice;
        const totalCredit = round2(order.quantity * execPrice);

        const holding = this.holdings.get(order.symbol);
        if (holding) {
          holding.reservedQuantity = Math.max(0, holding.reservedQuantity - order.quantity);
          const pnl = calculateRealizedPnL(holding.quantity, execPrice, holding.averageBuyPrice);
          this.account.realizedPnl = round2(this.account.realizedPnl + pnl);

          if (holding.quantity <= 0) {
            this.holdings.delete(order.symbol);
          } else {
            this.holdings.set(order.symbol, holding);
          }
        }

        this.account.virtualCash = round2(this.account.virtualCash + totalCredit);

        order.status = 'EXECUTED';
        order.executionPrice = execPrice;
        order.totalAmount = totalCredit;
        order.executedAt = new Date().toISOString();

        const transaction: Transaction = {
          id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          orderId: order.id,
          symbol: order.symbol,
          companyName: order.companyName,
          side: 'SELL',
          quantity: order.quantity,
          price: execPrice,
          totalValue: totalCredit,
          createdAt: order.executedAt,
        };
        this.transactions.unshift(transaction);
        executed.push(order);
        stateChanged = true;

        this.persistOrderCloud(order);
        this.persistTransactionCloud(transaction);
        this.persistHoldingCloud(order.symbol);
      }
    }

    if (stateChanged) {
      this.saveLocalAccount();
      this.saveLocalHoldings();
      this.saveLocalOrders();
      this.saveLocalTransactions();
      this.persistAccountCloud();
    }

    return executed;
  }

  // --- ITradingDataProvider Implementation ---

  public async getStocks(): Promise<StockQuote[]> {
    return Array.from(this.stocks.values());
  }

  public async getStock(symbol: string): Promise<StockQuote | null> {
    return this.stocks.get(symbol.toUpperCase()) || null;
  }

  public async getIndices(): Promise<IndexOverview[]> {
    return [...this.indices];
  }

  public async getHistoricalData(symbol: string, timeframe: TimeFrame): Promise<PricePoint[]> {
    const stock = this.stocks.get(symbol.toUpperCase());
    if (!stock) return [];
    return generateConsistentHistory(stock, timeframe);
  }

  public async getAccountSummary(): Promise<AccountSummary> {
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

  public async getHoldings(): Promise<Holding[]> {
    const result: Holding[] = [];
    let totalPortfolioValue = 0;

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

  public async getOrders(): Promise<Order[]> {
    return [...this.orders];
  }

  public async getTransactions(): Promise<Transaction[]> {
    return [...this.transactions];
  }

  public async placeOrder(request: OrderRequest): Promise<OrderResult> {
    if (this.isProcessing) {
      return { success: false, error: 'Another order is currently processing. Please wait.' };
    }

    this.isProcessing = true;

    try {
      const stock = this.stocks.get(request.symbol.toUpperCase());
      if (!stock) {
        return { success: false, error: `Stock ${request.symbol} not found.` };
      }

      const qty = Math.floor(request.quantity);
      if (qty <= 0) {
        return { success: false, error: 'Quantity must be at least 1 share.' };
      }

      const currentPrice = stock.price;
      const isLimit = request.orderType === 'LIMIT';
      const limitPrice = isLimit ? Number(request.limitPrice) : undefined;

      if (isLimit && (!limitPrice || limitPrice <= 0)) {
        return { success: false, error: 'Please enter a valid limit price.' };
      }

      const effectivePrice = isLimit ? limitPrice! : currentPrice;
      const estimatedTotal = round2(qty * effectivePrice);

      if (request.side === 'BUY') {
        if (this.account.virtualCash < estimatedTotal) {
          return {
            success: false,
            error: `Insufficient virtual cash. Required: ₹${estimatedTotal}, Available: ₹${this.account.virtualCash}.`,
          };
        }

        if (isLimit) {
          this.account.virtualCash = round2(this.account.virtualCash - estimatedTotal);
          this.account.reservedCash = round2(this.account.reservedCash + estimatedTotal);

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: this.userId,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            orderType: 'LIMIT',
            quantity: qty,
            limitPrice,
            totalAmount: estimatedTotal,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };

          this.orders.unshift(order);
          this.saveLocalAccount();
          this.saveLocalOrders();
          this.persistAccountCloud();
          this.persistOrderCloud(order);

          return {
            success: true,
            order,
            message: `Limit Buy placed for ${qty}x ${stock.symbol} at ₹${limitPrice}. ₹${estimatedTotal} reserved.`,
          };
        } else {
          this.account.virtualCash = round2(this.account.virtualCash - estimatedTotal);

          const existing = this.holdings.get(stock.symbol);
          if (existing) {
            const newAvg = calculateWeightedAverage(
              existing.quantity,
              existing.averageBuyPrice,
              qty,
              currentPrice
            );
            existing.quantity += qty;
            existing.averageBuyPrice = newAvg;
            this.holdings.set(stock.symbol, existing);
          } else {
            this.holdings.set(stock.symbol, {
              symbol: stock.symbol,
              quantity: qty,
              reservedQuantity: 0,
              averageBuyPrice: currentPrice,
            });
          }

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: this.userId,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            orderType: 'MARKET',
            quantity: qty,
            executionPrice: currentPrice,
            totalAmount: estimatedTotal,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
          };

          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'BUY',
            quantity: qty,
            price: currentPrice,
            totalValue: estimatedTotal,
            createdAt: order.executedAt!,
          };

          this.orders.unshift(order);
          this.transactions.unshift(transaction);
          this.saveLocalAccount();
          this.saveLocalHoldings();
          this.saveLocalOrders();
          this.saveLocalTransactions();
          this.persistAccountCloud();
          this.persistOrderCloud(order);
          this.persistTransactionCloud(transaction);
          this.persistHoldingCloud(stock.symbol);

          return {
            success: true,
            order,
            message: `Successfully bought ${qty} shares of ${stock.symbol} at ₹${currentPrice}!`,
          };
        }
      } else {
        // SELL
        const holding = this.holdings.get(stock.symbol);
        const availableShares = holding ? holding.quantity : 0;

        if (availableShares < qty) {
          return {
            success: false,
            error: `Insufficient shares to sell. Available: ${availableShares} shares, Requested: ${qty}.`,
          };
        }

        if (isLimit) {
          holding!.quantity -= qty;
          holding!.reservedQuantity += qty;
          this.holdings.set(stock.symbol, holding!);

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: this.userId,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            orderType: 'LIMIT',
            quantity: qty,
            limitPrice,
            totalAmount: estimatedTotal,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
          };

          this.orders.unshift(order);
          this.saveLocalHoldings();
          this.saveLocalOrders();
          this.persistOrderCloud(order);
          this.persistHoldingCloud(stock.symbol);

          return {
            success: true,
            order,
            message: `Limit Sell placed for ${qty}x ${stock.symbol} at ₹${limitPrice}. Shares reserved.`,
          };
        } else {
          holding!.quantity -= qty;
          const pnl = calculateRealizedPnL(qty, currentPrice, holding!.averageBuyPrice);
          this.account.realizedPnl = round2(this.account.realizedPnl + pnl);
          this.account.virtualCash = round2(this.account.virtualCash + estimatedTotal);

          if (holding!.quantity <= 0 && holding!.reservedQuantity <= 0) {
            this.holdings.delete(stock.symbol);
          } else {
            this.holdings.set(stock.symbol, holding!);
          }

          const order: Order = {
            id: 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            userId: this.userId,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            orderType: 'MARKET',
            quantity: qty,
            executionPrice: currentPrice,
            totalAmount: estimatedTotal,
            status: 'EXECUTED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
          };

          const transaction: Transaction = {
            id: 'txn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            orderId: order.id,
            symbol: stock.symbol,
            companyName: stock.name,
            side: 'SELL',
            quantity: qty,
            price: currentPrice,
            totalValue: estimatedTotal,
            realizedPnl: pnl,
            createdAt: order.executedAt!,
          };

          this.orders.unshift(order);
          this.transactions.unshift(transaction);
          this.saveLocalAccount();
          this.saveLocalHoldings();
          this.saveLocalOrders();
          this.saveLocalTransactions();
          this.persistAccountCloud();
          this.persistOrderCloud(order);
          this.persistTransactionCloud(transaction);
          this.persistHoldingCloud(stock.symbol);

          return {
            success: true,
            order,
            message: `Successfully sold ${qty} shares of ${stock.symbol} at ₹${currentPrice}!`,
          };
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  public async cancelOrder(orderId: string): Promise<boolean> {
    const orderIndex = this.orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return false;

    const order = this.orders[orderIndex];
    if (order.status !== 'PENDING') return false;

    if (order.side === 'BUY') {
      const reservedCost = round2(order.quantity * (order.limitPrice || 0));
      this.account.reservedCash = Math.max(0, round2(this.account.reservedCash - reservedCost));
      this.account.virtualCash = round2(this.account.virtualCash + reservedCost);
    } else {
      const holding = this.holdings.get(order.symbol);
      if (holding) {
        holding.reservedQuantity = Math.max(0, holding.reservedQuantity - order.quantity);
        holding.quantity += order.quantity;
        this.holdings.set(order.symbol, holding);
      }
    }

    order.status = 'CANCELLED';
    order.cancelledAt = new Date().toISOString();
    this.saveLocalAccount();
    this.saveLocalHoldings();
    this.saveLocalOrders();
    this.persistAccountCloud();
    this.persistOrderCloud(order);
    this.persistHoldingCloud(order.symbol);

    return true;
  }

  public async getWatchlist(): Promise<string[]> {
    return Array.from(this.watchlist);
  }

  public async toggleWatchlist(symbol: string): Promise<string[]> {
    const s = symbol.toUpperCase();
    if (this.watchlist.has(s)) {
      this.watchlist.delete(s);
    } else {
      this.watchlist.add(s);
    }
    this.saveLocalWatchlist();
    this.persistWatchlistCloud();
    return Array.from(this.watchlist);
  }

  public async resetAccount(): Promise<void> {
    this.account = {
      virtualCash: INITIAL_CASH,
      reservedCash: 0,
      realizedPnl: 0,
    };
    this.holdings.clear();
    this.orders = [];
    this.transactions = [];
    this.saveLocalAccount();
    this.saveLocalHoldings();
    this.saveLocalOrders();
    this.saveLocalTransactions();
    this.persistAccountCloud();
  }

  public subscribeMarketTicks(
    callback: (stocks: StockQuote[], indices: IndexOverview[], executedOrders?: Order[]) => void
  ): () => void {
    this.tickSubscribers.add(callback);
    return () => {
      this.tickSubscribers.delete(callback);
    };
  }
}
