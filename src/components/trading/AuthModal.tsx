import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuth } from '../../context/AuthContext';
import { Mail, Lock, User, Eye, EyeOff, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { 
    signInWithPassword, 
    signUp, 
    signInWithGoogle,
    resetPassword, 
    enableDemoMode, 
    isFirebaseReady 
  } = useAuth();

  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await signInWithPassword(email.trim(), password);
        if (error) {
          setErrorMsg(error);
        } else {
          onClose();
        }
      } else if (mode === 'signup') {
        const { error, message } = await signUp(email.trim(), password, fullName.trim());
        if (error) {
          setErrorMsg(error);
        } else {
          setSuccessMsg(message || 'Account created successfully! ₹1,00,000 virtual cash credited.');
          setTimeout(() => {
            onClose();
            navigate('/verify-email');
          }, 1200);
        }
      } else if (mode === 'reset') {
        const { error, message } = await resetPassword(email.trim());
        if (error) {
          setErrorMsg(error);
        } else {
          setSuccessMsg(message || 'Password reset link sent to your email.');
        }
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
        onClose();
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleTryDemo = () => {
    enableDemoMode();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'login' ? 'Sign in to TradeNest' : mode === 'signup' ? 'Create TradeNest Account' : 'Reset Password'}
      description={
        mode === 'login' 
          ? 'Sign in to access your paper-trading portfolio' 
          : mode === 'signup' 
          ? 'Get ₹1,00,000 in virtual cash for paper trading' 
          : 'Enter your email to receive a password reset link'
      }
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Backend Status indicator */}
        {isFirebaseReady ? (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span><strong>Firebase Auth Connected:</strong> Email & Google authentication active.</span>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              Firebase keys not configured in <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono">.env</code>. You can practice paper trading right now using <strong>Demo Mode</strong>!
            </div>
          </div>
        )}

        {/* Error or Success notification */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Google Sign-in button */}
        {mode !== 'reset' && (
          <>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isLoading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-[#131B2E] px-2 text-slate-400">or with email</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Rahul Sharma"
              leftIcon={<User className="w-4 h-4" />}
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
          )}

          <Input
            label="Email Address"
            type="email"
            placeholder="you@example.com"
            leftIcon={<Mail className="w-4 h-4" />}
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />

          {mode !== 'reset' && (
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
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
              required
            />
          )}

          {mode === 'login' && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            className="w-full mt-2"
            isLoading={isLoading}
            disabled={isLoading || isGoogleLoading}
          >
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account & Claim ₹1,00,000' : 'Send Reset Link'}
          </Button>
        </form>

        {/* Try Demo Option */}
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-[#131B2E] px-2 text-slate-400">or explore in demo</span>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="md"
          className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
          onClick={handleTryDemo}
        >
          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Try Demo with ₹1,00,000 Virtual Cash</span>
        </Button>

        {/* Toggle between Login, Signup, Reset */}
        <div className="text-center pt-2 text-xs text-slate-500 dark:text-slate-400">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
