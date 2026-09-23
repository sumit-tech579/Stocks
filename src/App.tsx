import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { TradingProvider } from './context/TradingContext';
import { DisclaimerBanner } from './components/layout/DisclaimerBanner';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { ToastContainer } from './components/common/Toast';

import { DashboardPage } from './pages/DashboardPage';
import { ExplorePage } from './pages/ExplorePage';
import { StockDetailPage } from './pages/StockDetailPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { OrdersPage } from './pages/OrdersPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AccountPage } from './pages/AccountPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TradingProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
              {/* Top Global Simulated Data Disclaimer Banner */}
              <DisclaimerBanner />

              {/* Top Navigation Bar */}
              <Navbar />

              {/* Main Content Area with Sidebar and Route Outlets */}
              <div className="flex-1 flex max-w-7xl w-full mx-auto">
                <Sidebar />

                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-full overflow-hidden">
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/stocks/:symbol" element={<StockDetailPage />} />
                    <Route path="/portfolio" element={<PortfolioPage />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/watchlist" element={<WatchlistPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
              </div>

              {/* Mobile Bottom Navigation */}
              <BottomNav />

              {/* Notification Toast Hub */}
              <ToastContainer />
            </div>
          </BrowserRouter>
        </TradingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
