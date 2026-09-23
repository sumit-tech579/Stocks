import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Sparkles, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

export const SignInPage: React.FC = () => {
  const { signInWithPassword, signInWithGoogle, enableDemoMode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Destination to return to after successful sign in
  const fromDestination = (location.state as any)?.from?.pathname || '/';

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return false;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return false;
    }
    return true;
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { error } = await signInWithPassword(email.trim(), password);
      if (error) {
        setErrorMsg(error);
      } else {
        navigate(fromDestination, { replace: true });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setIsGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMsg(error);
      } else {
        navigate(fromDestination, { replace: true });
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleContinueDemo = () => {
    enableDemoMode();
    navigate(fromDestination, { replace: true });
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-lg shadow-emerald-500/25 mb-1">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/>
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <path d="m9 15 3-3 3 3"/>
              <path d="M12 12v6"/>
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back to Trade<span className="text-emerald-600 dark:text-emerald-400">Nest</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Sign in to access your virtual paper-trading portfolio
          </p>
        </div>

        {/* Main Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-xl border-slate-200/80 dark:border-slate-800">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {/* Google Sign In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-sm disabled:opacity-50 active:scale-[0.99]"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-[#131B2E] px-3 text-slate-400 font-medium">
                or sign in with email
              </span>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@example.com"
              leftIcon={<Mail className="w-4 h-4" />}
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={isLoading || isGoogleLoading}
              required
            />

            <div className="space-y-1.5">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(prev => !prev)}
                    className="p-1 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={isLoading || isGoogleLoading}
                required
              />

              <div className="flex justify-end pt-1">
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 font-semibold shadow-md shadow-emerald-500/20"
              isLoading={isLoading}
              disabled={isLoading || isGoogleLoading}
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>

          {/* Or Continue in Demo Mode */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-semibold"
              onClick={handleContinueDemo}
              disabled={isLoading || isGoogleLoading}
            >
              <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Continue in Demo Mode (₹1,00,000 Cash)</span>
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Simulated trading only. Zero financial risk.</span>
            </div>
          </div>
        </Card>

        {/* Footer Link to Sign Up */}
        <p className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
          Don't have a TradeNest account?{' '}
          <Link
            to="/signup"
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};
