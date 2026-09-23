import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Sparkles, User, LogOut, LogIn, ChevronDown } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useTrading } from '../../context/TradingContext';
import { OmniSearchModal } from '../common/OmniSearchModal';
import { formatPercent } from '../../utils/formatters';

export const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, isDemo, signOut } = useAuth();
  const { indices } = useTrading();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const nifty = indices.find(i => i.symbol === 'NIFTY 50');

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await signOut();
    navigate('/signin');
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <path d="m9 15 3-3 3 3"/>
                  <path d="M12 12v6"/>
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  Trade<span className="text-emerald-600 dark:text-emerald-400">Nest</span>
                </span>
              </div>
            </Link>

            {/* Quick NIFTY 50 ticker preview on desktop */}
            {nifty && (
              <div 
                onClick={() => navigate('/explore')}
                className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer transition-colors text-xs"
              >
                <span className="font-semibold text-slate-700 dark:text-slate-300">NIFTY 50</span>
                <span className="font-mono-numeric font-medium text-slate-900 dark:text-slate-100">{nifty.value.toFixed(2)}</span>
                <span className={`flex items-center font-medium ${nifty.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {nifty.change >= 0 ? '+' : ''}{nifty.change.toFixed(2)} ({formatPercent(nifty.changePercent)})
                </span>
              </div>
            )}
          </div>

          {/* OmniSearch Bar Trigger */}
          <div className="flex-1 max-w-md hidden sm:block">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200/70 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-400 transition-colors group"
            >
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                <span>Search stocks, e.g. Reliance, TCS, INFY...</span>
              </span>
              <kbd className="px-2 py-0.5 text-[11px] font-medium text-slate-400 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Search Icon */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* Demo Mode Badge */}
            {isDemo && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Demo Mode</span>
              </div>
            )}

            {/* User Dropdown / Sign in button */}
            {user || isDemo ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(prev => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  {user?.photoURL || user?.avatarUrl ? (
                    <img 
                      src={user.photoURL || user.avatarUrl} 
                      alt={user.fullName || 'User'} 
                      className="w-7 h-7 rounded-lg object-cover border border-emerald-500/30" 
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                      {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <span className="hidden sm:inline max-w-[100px] truncate">{user?.fullName || 'Account'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                </button>

                {isUserMenuOpen && (
                  <div 
                    className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        {user?.photoURL || user?.avatarUrl ? (
                          <img 
                            src={user.photoURL || user.avatarUrl} 
                            alt={user.fullName || 'User'} 
                            className="w-8 h-8 rounded-lg object-cover" 
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
                          </div>
                        )}
                        <div className="overflow-hidden">
                          <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {user?.fullName || 'Trader'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {user?.email || 'demo.trader@tradenest.in'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        {isDemo ? 'Paper Trading (₹1,00,000)' : user?.emailVerified ? 'Verified Account' : 'Email Unverified'}
                      </div>
                    </div>

                    <Link
                      to="/account"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Account & Settings</span>
                    </Link>

                    {isDemo ? (
                      <Link
                        to="/signin"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors font-medium"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                        <span>Sign In / Create Account</span>
                      </Link>
                    ) : (
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-left transition-colors font-medium"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/signin"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* OmniSearch Modal */}
      <OmniSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
