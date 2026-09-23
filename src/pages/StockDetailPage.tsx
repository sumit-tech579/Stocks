import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Bookmark, 
  Check
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { formatINR, formatPercent, formatVolume, formatMarketCap } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { StockPriceChart } from '../components/charts/StockPriceChart';
import { OrderModal } from '../components/trading/OrderModal';
import { OrderSide } from '../types/trading';

export const StockDetailPage: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { getStock, watchlist, toggleWatchlist, holdings } = useTrading();

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderSide, setOrderSide] = useState<OrderSide>('BUY');

  const stock = symbol ? getStock(symbol) : undefined;
  const inWatchlist = stock ? watchlist.includes(stock.symbol) : false;
  const holding = stock ? holdings.find(h => h.symbol === stock.symbol) : undefined;

  if (!stock) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
          Stock "{symbol}" Not Found
        </h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          The requested stock symbol does not exist in our simulated catalog.
        </p>
        <Button variant="primary" size="md" onClick={() => navigate('/explore')}>
          Browse All Stocks
        </Button>
      </div>
    );
  }

  const openTradeModal = (side: OrderSide) => {
    setOrderSide(side);
    setOrderModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-12">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleWatchlist(stock.symbol)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
              inWatchlist
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-current' : ''}`} />
            <span>{inWatchlist ? 'Watchlisted' : 'Add to Watchlist'}</span>
          </button>
        </div>
      </div>

      {/* Stock Hero Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {stock.symbol}
            </h1>
            <Badge variant="neutral" size="sm">
              {stock.exchange}
            </Badge>
            <Badge variant="blue" size="sm">
              {stock.sector}
            </Badge>
          </div>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">
            {stock.name}
          </p>
        </div>

        {/* Action Buttons for Desktop */}
        <div className="hidden md:flex items-center gap-3">
          <Button
            variant="danger"
            size="lg"
            className="px-8 shadow-sm"
            onClick={() => openTradeModal('SELL')}
          >
            SELL
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="px-8 shadow-sm"
            onClick={() => openTradeModal('BUY')}
          >
            BUY
          </Button>
        </div>
      </div>

      {/* If User has active holdings in this stock, show quick banner */}
      {holding && holding.quantity > 0 && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                You own {holding.quantity} shares of {stock.symbol}
              </span>
              <div className="text-slate-500 dark:text-slate-400 font-mono-numeric">
                Avg Cost: {formatINR(holding.averageBuyPrice)} • Value: {formatINR(holding.currentValue)}
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="text-slate-500 dark:text-slate-400 block">Your Unrealised P&L</span>
            <span className={`font-mono-numeric font-bold text-sm ${
              holding.unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {holding.unrealizedPnl >= 0 ? '+' : ''}{formatINR(holding.unrealizedPnl)} ({formatPercent(holding.unrealizedPnlPercent)})
            </span>
          </div>
        </div>
      )}

      {/* Interactive Stock Price Chart */}
      <Card className="p-5 sm:p-6">
        <StockPriceChart stock={stock} />
      </Card>

      {/* Key Market Statistics Grid */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          Market Performance & Statistics
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Open</span>
            <span className="font-mono-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 block">
              {formatINR(stock.open)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Previous Close</span>
            <span className="font-mono-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 block">
              {formatINR(stock.previousClose)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Day Range</span>
            <span className="font-mono-numeric text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 block">
              {formatINR(stock.dayLow, { decimals: 1 })} - {formatINR(stock.dayHigh, { decimals: 1 })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">52-Week Range</span>
            <span className="font-mono-numeric text-xs sm:text-sm font-bold text-slate-900 dark:text-white mt-1 block">
              {formatINR(stock.week52Low, { decimals: 0 })} - {formatINR(stock.week52High, { decimals: 0 })}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Volume</span>
            <span className="font-mono-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 block">
              {formatVolume(stock.volume)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Market Capitalisation</span>
            <span className="font-mono-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 block truncate">
              {formatMarketCap(stock.marketCap)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">P/E Ratio</span>
            <span className="font-mono-numeric text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1 block">
              {stock.peRatio.toFixed(1)}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200/80 dark:border-slate-800">
            <span className="text-xs text-slate-400 block font-medium">Data Model</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
              Simulated Brownian Walk
            </span>
          </div>
        </div>
      </div>

      {/* Company Overview & Profile */}
      <Card className="p-5 sm:p-6 space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          About {stock.name}
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          {stock.about}
        </p>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Primary Exchange: {stock.exchange} (India)</span>
          <span>Currency: INR (₹)</span>
        </div>
      </Card>

      {/* Mobile Sticky Buy/Sell Bar at Bottom */}
      <div className="md:hidden fixed bottom-14 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 flex gap-3 shadow-elevation">
        <Button
          variant="danger"
          size="md"
          className="flex-1 font-bold"
          onClick={() => openTradeModal('SELL')}
        >
          SELL
        </Button>
        <Button
          variant="primary"
          size="md"
          className="flex-1 font-bold"
          onClick={() => openTradeModal('BUY')}
        >
          BUY
        </Button>
      </div>

      {/* Paper Trading Order Modal */}
      {orderModalOpen && (
        <OrderModal
          isOpen={orderModalOpen}
          onClose={() => setOrderModalOpen(false)}
          stock={stock}
          initialSide={orderSide}
        />
      )}
    </div>
  );
};
