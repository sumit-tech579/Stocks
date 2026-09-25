import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isDemo } = useAuth();
  const location = useLocation();

  // Show a branded loading screen while checking authentication state
  // to prevent any brief flashing of protected content
  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 animate-pulse">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <path d="m9 15 3-3 3 3"/>
                <path d="M12 12v6"/>
              </svg>
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-emerald-500/20 blur-sm -z-10 animate-ping" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              Verifying TradeNest Session...
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Connecting securely to your paper-trading vault
            </p>
          </div>
        </div>
      </div>
    );
  }

  // If user is not signed in and not in demo mode, redirect to /signin with destination state
  if (!user && !isDemo) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  // If user is logged in but email is not verified and not demo, redirect to verify-email
  if (user && !user.emailVerified && !isDemo) {
    return <Navigate to="/verify-email" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
