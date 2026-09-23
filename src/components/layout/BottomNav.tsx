import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Compass, 
  Bookmark, 
  PieChart, 
  ClipboardList, 
  User 
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/explore', label: 'Explore', icon: Compass },
  { path: '/watchlist', label: 'Watchlist', icon: Bookmark },
  { path: '/portfolio', label: 'Portfolio', icon: PieChart },
  { path: '/orders', label: 'Orders', icon: ClipboardList },
  { path: '/account', label: 'Account', icon: User },
];

export const BottomNav: React.FC = () => {
  const { watchlist, orders } = useTrading();
  const pendingOrdersCount = orders.filter(o => o.status === 'PENDING').length;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[11px] font-medium transition-colors relative ${
                  isActive
                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-5 h-5 mb-0.5" />
                {item.path === '/watchlist' && watchlist.length > 0 && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                )}
                {item.path === '/orders' && pendingOrdersCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
              <span className="truncate max-w-[50px]">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
