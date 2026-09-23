import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
} from 'recharts';
import { StockQuote, TimeFrame, PricePoint } from '../../types/stock';
import { useTrading } from '../../context/TradingContext';
import { formatINR, formatPercent } from '../../utils/formatters';

interface StockPriceChartProps {
  stock: StockQuote;
}

const TIMEFRAMES: TimeFrame[] = ['1D', '1W', '1M', '3M', '1Y'];

export const StockPriceChart: React.FC<StockPriceChartProps> = ({ stock }) => {
  const { getHistoricalData } = useTrading();
  const [timeframe, setTimeframe] = useState<TimeFrame>('1D');
  const [data, setData] = useState<PricePoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hoveredPoint, setHoveredPoint] = useState<PricePoint | null>(null);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getHistoricalData(stock.symbol, timeframe).then(points => {
      if (mounted) {
        setData(points);
        setIsLoading(false);
        setHoveredPoint(null);
      }
    });

    return () => {
      mounted = false;
    };
  }, [stock.symbol, stock.price, timeframe, getHistoricalData]);

  const activePoint = hoveredPoint || (data.length > 0 ? data[data.length - 1] : null);
  const firstPoint = data.length > 0 ? data[0] : null;

  const currentDisplayPrice = activePoint ? activePoint.price : stock.price;
  const initialPrice = firstPoint ? firstPoint.price : stock.previousClose;
  const priceDiff = currentDisplayPrice - initialPrice;
  const diffPercent = initialPrice > 0 ? (priceDiff / initialPrice) * 100 : 0;
  const isPositive = priceDiff >= 0;

  const strokeColor = isPositive ? '#00D09C' : '#EB5B5B';

  // Calculate min and max for YAxis buffer
  const prices = data.map(d => d.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) * 0.998 : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) * 1.002 : 100;

  return (
    <div className="w-full space-y-4">
      {/* Header Price Info when hovering */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="font-mono-numeric text-3xl font-extrabold text-slate-900 dark:text-white">
            {formatINR(currentDisplayPrice)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`font-mono-numeric text-sm font-semibold flex items-center ${
                isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {priceDiff >= 0 ? '+' : ''}{priceDiff.toFixed(2)} ({formatPercent(diffPercent)})
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {hoveredPoint ? hoveredPoint.time : timeframe === '1D' ? 'Today' : `Past ${timeframe}`}
            </span>
          </div>
        </div>

        {/* Timeframe Selectors */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                timeframe === tf
                  ? 'bg-white dark:bg-[#131B2E] text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full pt-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-400">
            Loading chart data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              onMouseMove={(e: any) => {
                if (e && e.activePayload && e.activePayload.length > 0) {
                  setHoveredPoint(e.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id={`gradient-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                hide 
              />
              <YAxis 
                domain={[minPrice, maxPrice]} 
                hide 
              />
              <Tooltip 
                content={<></>} // Handled above in state
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={strokeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${stock.symbol})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
