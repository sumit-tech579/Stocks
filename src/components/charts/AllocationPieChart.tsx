import React, { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Holding } from '../../types/trading';
import { formatINR, formatPercent } from '../../utils/formatters';

interface AllocationPieChartProps {
  holdings: Holding[];
  cashBalance: number;
}

const COLORS = [
  '#00D09C', '#3B82F6', '#8B5CF6', '#EC4899', 
  '#F59E0B', '#10B981', '#06B6D4', '#6366F1'
];

export const AllocationPieChart: React.FC<AllocationPieChartProps> = ({ holdings, cashBalance }) => {
  const [mode, setMode] = useState<'stock' | 'sector'>('stock');

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.currentValue, 0) + cashBalance;

  // By Stock data
  const stockData = [
    ...holdings.map(h => ({
      name: h.symbol,
      value: h.currentValue,
      percent: totalPortfolioValue > 0 ? (h.currentValue / totalPortfolioValue) * 100 : 0,
    })),
    {
      name: 'Cash',
      value: cashBalance,
      percent: totalPortfolioValue > 0 ? (cashBalance / totalPortfolioValue) * 100 : 0,
    }
  ];

  // By Sector data
  const sectorMap = new Map<string, number>();
  holdings.forEach(h => {
    const current = sectorMap.get(h.sector) || 0;
    sectorMap.set(h.sector, current + h.currentValue);
  });

  const sectorData = [
    ...Array.from(sectorMap.entries()).map(([sector, val]) => ({
      name: sector,
      value: val,
      percent: totalPortfolioValue > 0 ? (val / totalPortfolioValue) * 100 : 0,
    })),
    {
      name: 'Cash',
      value: cashBalance,
      percent: totalPortfolioValue > 0 ? (cashBalance / totalPortfolioValue) * 100 : 0,
    }
  ];

  const data = mode === 'stock' ? stockData : sectorData;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Asset Allocation
        </h4>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
          <button
            onClick={() => setMode('stock')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'stock'
                ? 'bg-white dark:bg-[#131B2E] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            By Stock
          </button>
          <button
            onClick={() => setMode('sector')}
            className={`px-2.5 py-1 rounded-md font-medium transition-all ${
              mode === 'sector'
                ? 'bg-white dark:bg-[#131B2E] text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            By Sector
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Pie */}
        <div className="h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={50}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs shadow-xl border border-slate-700">
                        <div className="font-semibold">{item.name}</div>
                        <div className="font-mono-numeric">{formatINR(item.value)} ({formatPercent(item.percent, false)})</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full grid grid-cols-2 gap-2 text-xs">
          {data.slice(0, 6).map((item, idx) => (
            <div key={item.name} className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
              />
              <span className="text-slate-600 dark:text-slate-400 truncate max-w-[100px]">{item.name}</span>
              <span className="font-mono-numeric font-medium text-slate-900 dark:text-slate-200 ml-auto">
                {formatPercent(item.percent, false)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
