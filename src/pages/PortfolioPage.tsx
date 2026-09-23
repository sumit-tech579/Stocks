import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, 
  Clock,
  Layers
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { formatINR, formatPercent, formatTime } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { AllocationPieChart } from '../components/charts/AllocationPieChart';
import { OrderModal } from '../components/trading/OrderModal';
import { StockQuote } from '../types/stock';
import { OrderSide } from '../types/trading';

export const PortfolioPage: React.FC = () => {
  const { holdings, accountSummary, lastTickTime, getStock } = useTrading();
  const navigate = useNavigate();

  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [tradeSide, setTradeSide] = useState<OrderSide>('BUY');

  const totalInvested = accountSummary?.totalInvested ?? 0;
  const portfolioMarketValue = accountSummary?.portfolioMarketValue ?? 0;
  const unrealizedPnl = accountSummary?.unrealizedPnl ?? 0;
  const unrealizedPnlPercent = accountSummary?.unrealizedPnlPercent ?? 0;
  const realizedPnl = accountSummary?.realizedPnl ?? 0;
  const availableCash = accountSummary?.availableCash ?? 100000;

  const handleTrade = (e: React.MouseEvent, symbol: string, side: OrderSide) => {
    e.stopPropagation();
    const stock = getStock(symbol);
    if (stock) {
      setSelectedStock(stock);
      setTradeSide(side);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Portfolio Holdings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Real-time simulated tracking of your open equity investments and realized returns.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-numeric">
          <Clock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Last valuation tick: {formatTime(lastTickTime)}</span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Market Value</span>
          <div className="font-mono-numeric text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatINR(portfolioMarketValue)}
          </div>
          <span className="text-[10px] text-slate-400">Total equity assets</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Invested Value</span>
          <div className="font-mono-numeric text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatINR(totalInvested)}
          </div>
          <span className="text-[10px] text-slate-400">Total purchase cost</span>
        </Card>

        <Card className="p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unrealised P&L</span>
          <div className={`font-mono-numeric text-xl sm:text-2xl font-bold mt-1 ${
            unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {unrealizedPnl >= 0 ? '+' : ''}{formatINR(unrealizedPnl)}
          </div>
          <span className={`text-[10px] font-semibold ${
            unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {formatPercent(unrealizedPnlPercent)} overall return
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Realised P&L</span>
          <div className={`font-mono-numeric text-xl sm:text-2xl font-bold mt-1 ${
            realizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {realizedPnl >= 0 ? '+' : ''}{formatINR(realizedPnl)}
          </div>
          <span className="text-[10px] text-slate-400">From completed sales</span>
        </Card>
      </div>

      {holdings.length === 0 ? (
        <EmptyState
          icon={<Compass className="w-7 h-7" />}
          title="No holdings in your portfolio yet"
          description="You haven't bought any simulated shares yet. Search the catalog and start paper trading with ₹1,00,000 virtual cash."
          actionText="Explore Stocks"
          onAction={() => navigate('/explore')}
        />
      ) : (
        <>
          {/* Allocation Breakdown */}
          <Card className="p-5 sm:p-6">
            <AllocationPieChart holdings={holdings} cashBalance={availableCash} />
          </Card>

          {/* Holdings List / Table */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Open Positions ({holdings.length})
                </h3>
              </div>
              <span className="text-xs text-slate-400">Values update with simulated quotes</span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/60 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Company</th>
                    <th className="px-4 py-3.5 text-right">Shares</th>
                    <th className="px-4 py-3.5 text-right">Avg Price</th>
                    <th className="px-4 py-3.5 text-right">Simulated Price</th>
                    <th className="px-4 py-3.5 text-right">Current Value</th>
                    <th className="px-4 py-3.5 text-right">Unrealised P&L</th>
                    <th className="px-6 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {holdings.map(h => {
                    const isPositive = h.unrealizedPnl >= 0;
                    return (
                      <tr
                        key={h.symbol}
                        onClick={() => navigate(`/stocks/${h.symbol}`)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {h.symbol}
                          </div>
                          <div className="text-xs text-slate-400 truncate max-w-xs">
                            {h.companyName} • {h.sector}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono-numeric">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{h.quantity}</span>
                          {h.reservedQuantity > 0 && (
                            <span className="block text-[11px] text-amber-500 font-medium">
                              ({h.reservedQuantity} reserved)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-mono-numeric text-slate-700 dark:text-slate-300">
                          {formatINR(h.averageBuyPrice)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono-numeric font-medium text-slate-900 dark:text-white">
                          {formatINR(h.currentPrice)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono-numeric font-bold text-slate-900 dark:text-white">
                          {formatINR(h.currentValue)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono-numeric">
                          <span className={`font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isPositive ? '+' : ''}{formatINR(h.unrealizedPnl)}
                          </span>
                          <span className={`block text-xs font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatPercent(h.unrealizedPnlPercent)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="px-2.5 py-1 text-xs"
                              onClick={(e) => handleTrade(e, h.symbol, 'BUY')}
                            >
                              Buy
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              className="px-2.5 py-1 text-xs"
                              onClick={(e) => handleTrade(e, h.symbol, 'SELL')}
                            >
                              Sell
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {holdings.map(h => {
                const isPositive = h.unrealizedPnl >= 0;
                return (
                  <div
                    key={h.symbol}
                    onClick={() => navigate(`/stocks/${h.symbol}`)}
                    className="p-4 space-y-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {h.symbol}
                        </div>
                        <div className="text-xs text-slate-400">
                          {h.quantity} shares {h.reservedQuantity > 0 ? `(${h.reservedQuantity} reserved)` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono-numeric font-bold text-slate-900 dark:text-white">
                          {formatINR(h.currentValue)}
                        </div>
                        <div className={`text-xs font-semibold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isPositive ? '+' : ''}{formatINR(h.unrealizedPnl)} ({formatPercent(h.unrealizedPnlPercent)})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Avg: {formatINR(h.averageBuyPrice)}</span>
                      <span>LTP: {formatINR(h.currentPrice)}</span>
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleTrade(e, h.symbol, 'BUY')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold"
                        >
                          Buy
                        </button>
                        <button
                          onClick={(e) => handleTrade(e, h.symbol, 'SELL')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-400 font-semibold"
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
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
