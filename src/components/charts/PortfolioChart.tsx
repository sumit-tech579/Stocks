import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip 
} from 'recharts';
import { useTrading } from '../../context/TradingContext';
import { formatINR, formatPercent } from '../../utils/formatters';

export const PortfolioChart: React.FC = () => {
  const { accountSummary, transactions } = useTrading();

  const totalValue = accountSummary?.totalAccountValue || 100000;
  const initialValue = 100000;
  const netProfit = totalValue - initialValue;
  const netProfitPercent = initialValue > 0 ? (netProfit / initialValue) * 100 : 0;
  const isPositive = netProfit >= 0;

  // Derive points from account activity
  const chartData = useMemo(() => {
    const points = [];
    const base = 100000;

    // Point 1: Opening balance
    points.push({
      time: 'Day Start',
      value: base,
    });

    if (transactions.length === 0) {
      points.push({ time: 'Current', value: totalValue });
      return points;
    }

    // Intermediate points based on transaction progression
    let runningVal = base;
    const sortedTxns = [...transactions].reverse();

    sortedTxns.forEach((txn, i) => {
      // Add transaction point
      const delta = (txn.realizedPnl || 0);
      runningVal += delta;
      const t = new Date(txn.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      points.push({
        time: t || `Trade #${i + 1}`,
        value: Math.max(10000, runningVal),
      });
    });

    // Final point: Current total account value
    points.push({
      time: 'Now',
      value: totalValue,
    });

    return points;
  }, [totalValue, transactions]);

  const strokeColor = isPositive ? '#00D09C' : '#EB5B5B';
  const values = chartData.map(d => d.value);
  const minVal = Math.min(...values) * 0.995;
  const maxVal = Math.max(...values) * 1.005;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Account Value</span>
          <div className="font-mono-numeric text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {formatINR(totalValue)}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold mt-0.5">
            <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {netProfit >= 0 ? '+' : ''}{formatINR(netProfit)} ({formatPercent(netProfitPercent)})
            </span>
            <span className="text-slate-400">All-time</span>
          </div>
        </div>
      </div>

      <div className="h-44 sm:h-52 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={[minVal, maxVal]} hide />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const val = payload[0].value as number;
                  return (
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl border border-slate-700">
                      <div className="font-mono-numeric font-bold">{formatINR(val)}</div>
                      <div className="text-[10px] text-slate-400">{payload[0].payload.time}</div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={strokeColor}
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#portfolioGradient)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
