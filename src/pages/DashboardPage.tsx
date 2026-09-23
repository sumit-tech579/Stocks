import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Bookmark,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { formatINR, formatPercent, formatTime } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PortfolioChart } from '../components/charts/PortfolioChart';
import { OrderModal } from '../components/trading/OrderModal';
import { StockQuote } from '../types/stock';

export const DashboardPage: React.FC = () => {
  const { 
    accountSummary, 
    indices, 
    stocks, 
    watchlist, 
    lastTickTime 
  } = useTrading();
  
  const navigate = useNavigate();
  const [selectedStockForTrade, setSelectedStockForTrade] = useState<StockQuote | null>(null);

  // Top Gainers & Losers (sorted by daily changePercent)
  const sortedStocks = [...stocks].sort((a, b) => b.changePercent - a.changePercent);
  const topGainers = sortedStocks.slice(0, 4);
  const topLosers = sortedStocks.slice(-4).reverse();

  // Watchlist preview stocks
  const watchlistStocks = stocks.filter(s => watchlist.includes(s.symbol)).slice(0, 5);

  const availableCash = accountSummary?.availableCash ?? 100000;
  const portfolioMarketValue = accountSummary?.portfolioMarketValue ?? 0;
  const totalInvested = accountSummary?.totalInvested ?? 0;
  const unrealizedPnl = accountSummary?.unrealizedPnl ?? 0;
  const unrealizedPnlPercent = accountSummary?.unrealizedPnlPercent ?? 0;
  const realizedPnl = accountSummary?.realizedPnl ?? 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Welcome & Market Overview Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Market Dashboard
            </h1>
            <Badge variant="green" size="sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Simulation
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulated Indian equity trading with ₹1,00,000 virtual cash. Quotes update in real-time.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-numeric">
          <Clock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Simulated quote time: {formatTime(lastTickTime)}</span>
        </div>
      </div>

      {/* Major Indices Cards: NIFTY 50, SENSEX, NIFTY BANK */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {indices.map(index => {
          const isPositive = index.change >= 0;
          return (
            <Card key={index.symbol} className="p-4" hoverable onClick={() => navigate('/explore')}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {index.symbol}
                  </span>
                  <div className="font-mono-numeric text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {index.value.toFixed(2)}
                  </div>
                </div>
                <div className={`flex items-center text-xs font-semibold px-2 py-1 rounded-lg ${
                  isPositive 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                }`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                  <span>{isPositive ? '+' : ''}{index.change.toFixed(2)} ({formatPercent(index.changePercent)})</span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2 font-mono-numeric">
                <span>Low: {index.low.toFixed(2)}</span>
                <span>High: {index.high.toFixed(2)}</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Account Performance Summary & Performance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Portfolio Chart & Core Balances */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-5 sm:p-6">
            <PortfolioChart />
          </Card>

          {/* Core Balance Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800 shadow-subtle">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Available Cash</span>
              <div className="font-mono-numeric text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
                {formatINR(availableCash)}
              </div>
              <span className="text-[10px] text-slate-400">Virtual balance</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800 shadow-subtle">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Portfolio Value</span>
              <div className="font-mono-numeric text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
                {formatINR(portfolioMarketValue)}
              </div>
              <span className="text-[10px] text-slate-400">Current market value</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800 shadow-subtle">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Invested Amount</span>
              <div className="font-mono-numeric text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">
                {formatINR(totalInvested)}
              </div>
              <span className="text-[10px] text-slate-400">Total purchase cost</span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800 shadow-subtle">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unrealised P&L</span>
              <div className={`font-mono-numeric text-base sm:text-lg font-bold mt-1 truncate ${
                unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {unrealizedPnl >= 0 ? '+' : ''}{formatINR(unrealizedPnl)}
              </div>
              <span className={`text-[10px] font-semibold ${
                unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatPercent(unrealizedPnlPercent)}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800 shadow-subtle col-span-2 sm:col-span-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Realised P&L</span>
              <div className={`font-mono-numeric text-base sm:text-lg font-bold mt-1 truncate ${
                realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {realizedPnl >= 0 ? '+' : ''}{formatINR(realizedPnl)}
              </div>
              <span className="text-[10px] text-slate-400">From completed sales</span>
            </div>
          </div>
        </div>

        {/* Right Col: Watchlist Preview */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Watchlist
                </h3>
              </div>
              <Link 
                to="/watchlist" 
                className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {watchlistStocks.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Your watchlist is empty.</p>
                <Button size="sm" variant="outline" onClick={() => navigate('/explore')}>
                  Explore Stocks
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {watchlistStocks.map(stock => {
                  const isPositive = stock.change >= 0;
                  return (
                    <div 
                      key={stock.symbol}
                      className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 -mx-2 rounded-xl transition-colors"
                      onClick={() => navigate(`/stocks/${stock.symbol}`)}
                    >
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {stock.symbol}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                          {stock.name}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono-numeric font-medium text-slate-900 dark:text-slate-100 text-xs sm:text-sm">
                          {formatINR(stock.price)}
                        </div>
                        <div className={`text-[11px] font-semibold flex items-center justify-end ${
                          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {isPositive ? '+' : ''}{formatPercent(stock.changePercent)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick Paper Trading Disclaimer Card */}
          <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>100% Risk-Free Simulation</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              TradeNest provides authentic market dynamics for learning without risking capital. Market and limit orders are processed against simulated quotes with zero real financial exposure.
            </p>
          </div>
        </div>
      </div>

      {/* Simulated Top Gainers & Top Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Top Gainers
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Simulated today</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topGainers.map(stock => (
              <div
                key={stock.symbol}
                onClick={() => navigate(`/stocks/${stock.symbol}`)}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-800 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {stock.symbol}
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono-numeric">
                    +{formatPercent(stock.changePercent)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-400 truncate max-w-[100px]">{stock.name}</span>
                  <span className="font-mono-numeric text-xs font-medium text-slate-900 dark:text-white">
                    {formatINR(stock.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Losers */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Top Losers
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Simulated today</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {topLosers.map(stock => (
              <div
                key={stock.symbol}
                onClick={() => navigate(`/stocks/${stock.symbol}`)}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {stock.symbol}
                  </span>
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 font-mono-numeric">
                    {formatPercent(stock.changePercent)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-slate-400 truncate max-w-[100px]">{stock.name}</span>
                  <span className="font-mono-numeric text-xs font-medium text-slate-900 dark:text-white">
                    {formatINR(stock.price)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Order Modal if user clicked quick buy */}
      {selectedStockForTrade && (
        <OrderModal
          isOpen={Boolean(selectedStockForTrade)}
          onClose={() => setSelectedStockForTrade(null)}
          stock={selectedStockForTrade}
        />
      )}
    </div>
  );
};
