import React from 'react';
import { useTrading } from '../../context/TradingContext';
import { formatTime } from '../../utils/formatters';
import { Activity } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  const { lastTickTime } = useTrading();

  return (
    <div className="bg-emerald-950/20 dark:bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            SIMULATED PAPER TRADING
          </span>
          <span className="hidden sm:inline text-slate-500 dark:text-slate-400">•</span>
          <span className="hidden sm:inline text-slate-600 dark:text-slate-400">
            Quotes & trades are simulated with virtual currency. Zero real money involved.
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-mono-numeric">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Last quote update: {formatTime(lastTickTime)}</span>
          </span>
          <span className="hidden md:inline text-slate-400">•</span>
          <span className="hidden md:inline">
            Order matching engine active while browser is open
          </span>
        </div>
      </div>
    </div>
  );
};
