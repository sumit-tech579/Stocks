import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bookmark, 
  Trash2, 
  TrendingUp, 
  TrendingDown, 
  Clock
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { formatINR, formatPercent, formatVolume, formatTime } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { OrderModal } from '../components/trading/OrderModal';
import { StockQuote } from '../types/stock';
import { OrderSide } from '../types/trading';

export const WatchlistPage: React.FC = () => {
  const { watchlist, stocks, toggleWatchlist, lastTickTime } = useTrading();
  const navigate = useNavigate();

  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [tradeSide, setTradeSide] = useState<OrderSide>('BUY');

  const watchlistStocks = stocks.filter(s => watchlist.includes(s.symbol));

  const handleOpenTrade = (e: React.MouseEvent, stock: StockQuote, side: OrderSide) => {
    e.stopPropagation();
    setSelectedStock(stock);
    setTradeSide(side);
  };

  const handleRemove = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    toggleWatchlist(symbol);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              My Watchlist
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-bold font-mono-numeric">
              {watchlistStocks.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Keep an eye on key stocks and execute quick paper trades when conditions align.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-numeric">
          <Clock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Last quote tick: {formatTime(lastTickTime)}</span>
        </div>
      </div>

      {watchlistStocks.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="w-7 h-7" />}
          title="Your watchlist is empty"
          description="Track top Indian companies to monitor simulated price fluctuations and seize trading opportunities."
          actionText="Explore Stocks to Watch"
          onAction={() => navigate('/explore')}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlistStocks.map(stock => {
            const isPositive = stock.change >= 0;
            return (
              <Card
                key={stock.symbol}
                hoverable
                onClick={() => navigate(`/stocks/${stock.symbol}`)}
                className="p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-base">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                          {stock.exchange}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[180px] mt-0.5">
                        {stock.name}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleRemove(e, stock.symbol)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mt-2">
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                      {stock.sector}
                    </span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Price</span>
                      <span className="font-mono-numeric text-lg font-bold text-slate-900 dark:text-white">
                        {formatINR(stock.price)}
                      </span>
                    </div>

                    <div className="text-right">
                      <div className={`font-mono-numeric text-xs font-semibold flex items-center justify-end ${
                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                        <span>{isPositive ? '+' : ''}{formatINR(stock.change)} ({formatPercent(stock.changePercent)})</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Vol: {formatVolume(stock.volume)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Trade Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => handleOpenTrade(e, stock, 'SELL')}
                    >
                      Sell
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={(e) => handleOpenTrade(e, stock, 'BUY')}
                    >
                      Buy
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selectedStock && (
        <OrderModal
          isOpen={Boolean(selectedStock)}
          onClose={() => setSelectedStock(null)}
          stock={selectedStock}
          initialSide={tradeSide}
        />
      )}
    </div>
  );
};
