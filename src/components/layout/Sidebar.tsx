import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Compass, 
  Bookmark, 
  PieChart, 
  ClipboardList, 
  User, 
  Wallet,
  ArrowUpRight
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { formatINR } from '../../utils/formatters';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/explore', label: 'Explore Stocks', icon: Compass },
  { path: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/account', label: 'Account', icon: User },
];

export const Sidebar: React.FC = () => {
  const { accountSummary, watchlist, orders } = useTrading();
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#0B0F19] border-r border-slate-200/80 dark:border-slate-800 p-4 shrink-0 justify-between min-h-[calc(100vh-4rem)]">
      <div className="space-y-6">
        {/* Navigation Links */}
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-semibold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </div>

                {/* Badges */}
                {item.path === '/watchlist' && watchlist.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono-numeric">
                    {watchlist.length}
                  </span>
                )}
                {item.path === '/orders' && pendingOrdersCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-semibold">
                    {pendingOrdersCount}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Quick Balance Card at Bottom of Sidebar */}
      <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80">
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Available Cash
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold">
              VIRTUAL
            </span>
          </div>

          <div className="font-mono-numeric font-bold text-lg text-slate-900 dark:text-white">
            {accountSummary ? formatINR(accountSummary.availableCash) : '₹1,00,000.00'}
          </div>

          {accountSummary && accountSummary.reservedCash > 0 && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <span>Reserved for orders:</span>
              <span className="font-mono-numeric font-semibold">{formatINR(accountSummary.reservedCash)}</span>
            </div>
          )}

          <NavLink
            to="/portfolio"
            className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium hover:underline pt-1"
          >
            <span>View portfolio</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
