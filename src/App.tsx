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
import { ProtectedRoute } from './components/auth/ProtectedRoute';

import { DashboardPage } from './pages/DashboardPage';
import { ExplorePage } from './pages/ExplorePage';
import { StockDetailPage } from './pages/StockDetailPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { OrdersPage } from './pages/OrdersPage';
import { WatchlistPage } from './pages/WatchlistPage';
import { AccountPage } from './pages/AccountPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

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
                    {/* Public Authentication Routes */}
                    <Route path="/signin" element={<SignInPage />} />
                    <Route path="/signup" element={<SignUpPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/verify-email" element={<VerifyEmailPage />} />

                    {/* Stock Discovery (Public / Accessible) */}
                    <Route path="/explore" element={<ExplorePage />} />
                    <Route path="/stocks/:symbol" element={<StockDetailPage />} />

                    {/* Protected User Routes (Require Authenticated User or Demo Mode) */}
                    <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                    <Route path="/watchlist" element={<ProtectedRoute><WatchlistPage /></ProtectedRoute>} />
                    <Route path="/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />

                    {/* Fallback */}
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
