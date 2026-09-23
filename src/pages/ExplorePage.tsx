import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  ArrowUpDown, 
  Bookmark, 
  TrendingUp, 
  TrendingDown, 
  Clock 
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { Sector } from '../types/stock';
import { formatINR, formatPercent, formatVolume, formatTime } from '../utils/formatters';
import { Card } from '../components/common/Card';

const SECTORS: Sector[] = [
  'All',
  'Banking & Finance',
  'IT Services',
  'Oil, Gas & Energy',
  'Consumer Goods',
  'Automobile',
  'Pharmaceuticals',
  'Infrastructure & Metals'
];

type SortOption = 'gainers' | 'losers' | 'price-desc' | 'price-asc' | 'name-asc' | 'name-desc';

export const ExplorePage: React.FC = () => {
  const { stocks, watchlist, toggleWatchlist, lastTickTime } = useTrading();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<Sector>('All');
  const [sortBy, setSortBy] = useState<SortOption>('gainers');

  // Filter and sort stocks
  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const matchesSearch =
        stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSector = selectedSector === 'All' || stock.sector === selectedSector;
      return matchesSearch && matchesSector;
    }).sort((a, b) => {
      if (sortBy === 'gainers') return b.changePercent - a.changePercent;
      if (sortBy === 'losers') return a.changePercent - b.changePercent;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'name-asc') return a.symbol.localeCompare(b.symbol);
      if (sortBy === 'name-desc') return b.symbol.localeCompare(a.symbol);
      return 0;
    });
  }, [stocks, searchQuery, selectedSector, sortBy]);

  const handleToggleWatchlist = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    toggleWatchlist(symbol);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
            Explore Indian Stocks
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Discover {stocks.length} top NSE/BSE listed companies across key market sectors.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-numeric">
          <Clock className="w-3.5 h-3.5 text-emerald-500" />
          <span>Simulated data: {formatTime(lastTickTime)}</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by company name or stock symbol..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-subtle"
          />
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortOption)}
              className="appearance-none pl-9 pr-8 py-2.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-subtle"
            >
              <option value="gainers">Top Gainers</option>
              <option value="losers">Top Losers</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="name-asc">Symbol: A to Z</option>
              <option value="name-desc">Symbol: Z to A</option>
            </select>
            <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Sector Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {SECTORS.map(sec => (
          <button
            key={sec}
            onClick={() => setSelectedSector(sec)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedSector === sec
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'bg-white dark:bg-[#131B2E] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
            }`}
          >
            {sec}
          </button>
        ))}
      </div>

      {/* Stock Cards Grid */}
      {filteredStocks.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No stocks matched your filter criteria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStocks.map(stock => {
            const isPositive = stock.change >= 0;
            const inWatchlist = watchlist.includes(stock.symbol);

            return (
              <Card
                key={stock.symbol}
                hoverable
                onClick={() => navigate(`/stocks/${stock.symbol}`)}
                className="p-5 flex flex-col justify-between group relative"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center font-bold text-xs">
                        {stock.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {stock.symbol}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium">
                            {stock.exchange}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[150px] sm:max-w-[180px]">
                          {stock.name}
                        </p>
                      </div>
                    </div>

                    {/* Watchlist Bookmark Button */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleWatchlist(e, stock.symbol)}
                      className={`p-2 rounded-xl border transition-colors ${
                        inWatchlist
                          ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                          : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      <Bookmark className={`w-4 h-4 ${inWatchlist ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-2">
                    <span className="text-[11px] font-medium text-slate-400 bg-slate-50 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
                      {stock.sector}
                    </span>
                  </div>
                </div>

                {/* Price and Trends */}
                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Price</span>
                    <span className="font-mono-numeric text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                      {formatINR(stock.price)}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className={`font-mono-numeric text-xs sm:text-sm font-semibold flex items-center justify-end ${
                      isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isPositive ? <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> : <TrendingDown className="w-3.5 h-3.5 mr-0.5" />}
                      <span>{isPositive ? '+' : ''}{formatINR(stock.change, { showSymbol: true })} ({formatPercent(stock.changePercent)})</span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Vol: {formatVolume(stock.volume)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
