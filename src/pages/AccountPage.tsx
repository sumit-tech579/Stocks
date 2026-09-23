import React, { useState } from 'react';
import { 
  Moon, 
  Sun, 
  RotateCcw, 
  LogOut, 
  ShieldCheck, 
  BookOpen, 
  Sparkles, 
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTrading } from '../context/TradingContext';
import { formatINR } from '../utils/formatters';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ResetAccountModal } from '../components/trading/ResetAccountModal';
import { AuthModal } from '../components/trading/AuthModal';

export const AccountPage: React.FC = () => {
  const { user, isDemo, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { accountSummary } = useTrading();

  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
          Account & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Manage your paper-trading profile, visual theme, and simulated account settings.
        </p>
      </div>

      {/* User Profile Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xl shadow-sm">
              {user?.fullName ? user.fullName[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                  {user?.fullName || 'Demo Trader'}
                </h3>
                {isDemo ? (
                  <Badge variant="amber" size="sm">Demo Account</Badge>
                ) : (
                  <Badge variant="green" size="sm">Verified Account</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {user?.email || 'demo.trader@tradenest.in'}
              </p>
            </div>
          </div>

          <div>
            {isDemo ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAuthOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Sign In / Register
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign Out
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-xs text-slate-400 block">Available Virtual Cash</span>
            <span className="font-mono-numeric font-bold text-slate-900 dark:text-white text-base">
              {accountSummary ? formatINR(accountSummary.availableCash) : '₹1,00,000.00'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block">Account Status</span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Active Simulation
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-400 block">KYC / Regulatory Status</span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Not Required (Paper Trading)
            </span>
          </div>
        </div>
      </Card>

      {/* Theme Preference Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base">
          Theme & Display
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose your preferred interface theme. Designed for optimal contrast and readability.
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-sm">
          <button
            onClick={() => setTheme('light')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
              theme === 'light'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Light Mode</span>
          </button>

          <button
            onClick={() => setTheme('dark')}
            className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
              theme === 'dark'
                ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Moon className="w-4 h-4 text-sky-400" />
            <span>Dark Mode</span>
          </button>
        </div>
      </Card>

      {/* Educational Guide: How Paper Trading Works */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            How TradeNest Paper Trading Works
          </h3>
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">1. Virtual Money (₹1,00,000)</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Every account starts with ₹1,00,000 in virtual funds. Use this to practice trading strategies, learn risk management, and understand portfolio diversification without monetary risk.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">2. Market vs Limit Orders</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              <strong>Market orders</strong> fill immediately at the current simulated quote. <strong>Limit orders</strong> let you set a target execution price. When buying on limit, your virtual cash is reserved until the price matches your target.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-1">
            <h4 className="font-semibold text-slate-900 dark:text-slate-100">3. Live Simulation Engine</h4>
            <p className="text-slate-500 dark:text-slate-400 text-xs">
              Stock prices fluctuate dynamically using realistic geometric Brownian motion while your browser tab is open. Pending limit orders trigger automatically when quotes cross your limit conditions.
            </p>
          </div>
        </div>

        {/* Regulatory Protection Disclaimer */}
        <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <strong>Educational & Privacy Guarantee:</strong> TradeNest is exclusively a learning and practice environment. We do NOT collect PAN numbers, Aadhaar IDs, bank account details, or payment card information.
          </div>
        </div>
      </Card>

      {/* Danger Zone: Reset Account */}
      <Card className="p-5 sm:p-6 border-rose-200 dark:border-rose-900/40 space-y-4">
        <div>
          <h3 className="font-bold text-rose-600 dark:text-rose-400 text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Reset Demo Account
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Want to start fresh? Resetting will restore your virtual cash balance to ₹1,00,000 and clear all existing holdings and trade orders.
          </p>
        </div>

        <Button
          variant="danger"
          size="md"
          onClick={() => setIsResetOpen(true)}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset Demo Balance
        </Button>
      </Card>

      {/* Modals */}
      <ResetAccountModal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} />
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </div>
  );
};
