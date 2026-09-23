import React, { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { StockQuote, IndexOverview, PricePoint, TimeFrame } from '../types/stock';
import { 
  Order, 
  Holding, 
  Transaction, 
  AccountSummary, 
  OrderRequest, 
  OrderResult 
} from '../types/trading';
import { ITradingDataProvider } from '../services/dataProvider';
import { DemoDataProvider } from '../services/demoDataProvider';
import { FirestoreTradingProvider } from '../services/firestoreTradingProvider';
import { useAuth } from './AuthContext';
import confetti from 'canvas-confetti';

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface TradingContextType {
  stocks: StockQuote[];
  indices: IndexOverview[];
  holdings: Holding[];
  orders: Order[];
  transactions: Transaction[];
  accountSummary: AccountSummary | null;
  watchlist: string[];
  lastTickTime: string;
  isSimulatedData: boolean;
  toasts: ToastNotification[];
  dismissToast: (id: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  toggleWatchlist: (symbol: string) => Promise<void>;
  placeOrder: (req: OrderRequest) => Promise<OrderResult>;
  cancelOrder: (orderId: string) => Promise<boolean>;
  resetAccount: () => Promise<void>;
  getStock: (symbol: string) => StockQuote | undefined;
  getHistoricalData: (symbol: string, timeframe: TimeFrame) => Promise<PricePoint[]>;
  refreshData: () => Promise<void>;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const TradingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemo } = useAuth();
  
  // Track active provider reference for cleanup
  const activeProviderRef = useRef<any>(null);

  // Select active provider based on current authenticated UID or Demo
  const dataProvider: ITradingDataProvider = useMemo(() => {
    // Clean up previous provider simulation interval if exists
    if (activeProviderRef.current && typeof activeProviderRef.current.destroy === 'function') {
      activeProviderRef.current.destroy();
    }

    let provider: ITradingDataProvider;
    if (user && !isDemo) {
      provider = new FirestoreTradingProvider(user.uid || user.id);
    } else {
      provider = new DemoDataProvider('demo_user');
    }

    activeProviderRef.current = provider;
    return provider;
  }, [user?.id, isDemo]);

  const [stocks, setStocks] = useState<StockQuote[]>([]);
  const [indices, setIndices] = useState<IndexOverview[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [lastTickTime, setLastTickTime] = useState<string>(new Date().toISOString());
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Clear in-memory state when user changes or signs out to prevent data leaking
  useEffect(() => {
    setHoldings([]);
    setOrders([]);
    setTransactions([]);
    setAccountSummary(null);
    setWatchlist([]);
  }, [user?.id, isDemo]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const triggerConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#00D09C', '#10B981', '#34D399', '#6EE7B7'],
      });
    } catch {
      // Ignore if confetti fails
    }
  }, []);

  const refreshData = useCallback(async () => {
    try {
      const [s, idx, h, o, t, acc, wl] = await Promise.all([
        dataProvider.getStocks(),
        dataProvider.getIndices(),
        dataProvider.getHoldings(),
        dataProvider.getOrders(),
        dataProvider.getTransactions(),
        dataProvider.getAccountSummary(),
        dataProvider.getWatchlist(),
      ]);

      setStocks(s);
      setIndices(idx);
      setHoldings(h);
      setOrders(o);
      setTransactions(t);
      setAccountSummary(acc);
      setWatchlist(wl);
    } catch (e) {
      console.error('Error refreshing trading data:', e);
    }
  }, [dataProvider]);

  // Initial load when provider changes
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Clean up provider on unmount
  useEffect(() => {
    return () => {
      if (activeProviderRef.current && typeof activeProviderRef.current.destroy === 'function') {
        activeProviderRef.current.destroy();
      }
    };
  }, []);

  // Subscribe to real-time market ticks & limit order matching
  useEffect(() => {
    const unsubscribe = dataProvider.subscribeMarketTicks((updatedStocks, updatedIndices, executedOrders) => {
      setStocks(updatedStocks);
      setIndices(updatedIndices);
      setLastTickTime(new Date().toISOString());

      // If pending limit orders were automatically filled by the market tick!
      if (executedOrders && executedOrders.length > 0) {
        executedOrders.forEach(ord => {
          showToast(`Limit order triggered! ${ord.side} ${ord.quantity}x ${ord.symbol} filled at ₹${ord.executionPrice}`, 'success');
          triggerConfetti();
        });
        refreshData();
      } else {
        // Recalculate portfolio market value with new prices
        dataProvider.getHoldings().then(h => setHoldings(h));
        dataProvider.getAccountSummary().then(acc => setAccountSummary(acc));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dataProvider, refreshData, showToast, triggerConfetti]);

  const toggleWatchlist = async (symbol: string) => {
    const updated = await dataProvider.toggleWatchlist(symbol);
    setWatchlist(updated);
  };

  const placeOrder = async (req: OrderRequest): Promise<OrderResult> => {
    const result = await dataProvider.placeOrder(req);
    if (result.success) {
      await refreshData();
      if (result.order?.status === 'EXECUTED') {
        triggerConfetti();
        showToast(result.message || 'Order executed successfully!', 'success');
      } else if (result.order?.status === 'PENDING') {
        showToast(result.message || 'Limit order placed successfully.', 'info');
      }
    } else {
      showToast(result.error || 'Failed to place order.', 'error');
    }
    return result;
  };

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    const success = await dataProvider.cancelOrder(orderId);
    if (success) {
      await refreshData();
      showToast('Pending order cancelled. Reserved funds/shares released.', 'info');
    } else {
      showToast('Could not cancel order.', 'error');
    }
    return success;
  };

  const resetAccount = async (): Promise<void> => {
    await dataProvider.resetAccount();
    await refreshData();
    showToast('Account reset to ₹1,00,000 virtual cash.', 'info');
  };

  const getStock = useCallback((symbol: string): StockQuote | undefined => {
    return stocks.find(s => s.symbol.toUpperCase() === symbol.toUpperCase());
  }, [stocks]);

  const getHistoricalData = useCallback(async (symbol: string, timeframe: TimeFrame): Promise<PricePoint[]> => {
    return dataProvider.getHistoricalData(symbol, timeframe);
  }, [dataProvider]);

  return (
    <TradingContext.Provider
      value={{
        stocks,
        indices,
        holdings,
        orders,
        transactions,
        accountSummary,
        watchlist,
        lastTickTime,
        isSimulatedData: true,
        toasts,
        dismissToast,
        showToast,
        toggleWatchlist,
        placeOrder,
        cancelOrder,
        resetAccount,
        getStock,
        getHistoricalData,
        refreshData,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = (): TradingContextType => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};
