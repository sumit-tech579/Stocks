import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, CheckCircle2, ArrowLeft, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

export const ForgotPasswordPage: React.FC = () => {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const { error, message } = await resetPassword(email.trim());
      if (error) {
        setErrorMsg(error);
      } else {
        setSuccessMsg(message || 'Password reset link sent! Please check your email inbox and spam folder.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-lg shadow-emerald-500/25 mb-1">
            <KeyRound className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Reset Password
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Enter your registered email and we'll send you a password recovery link
          </p>
        </div>

        {/* Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-xl border-slate-200/80 dark:border-slate-800">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-snug">{errorMsg}</span>
            </div>
          )}

          {successMsg ? (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5" />
                <div className="text-xs sm:text-sm space-y-1">
                  <p className="font-semibold">Reset Link Dispatched</p>
                  <p className="text-slate-600 dark:text-slate-300">{successMsg}</p>
                </div>
              </div>

              <div className="pt-2">
                <Link to="/signin">
                  <Button variant="primary" size="lg" className="w-full">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    <span>Return to Sign In</span>
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Registered Email Address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2 font-semibold shadow-md shadow-emerald-500/20"
                isLoading={isLoading}
                disabled={isLoading}
              >
                <span>Send Reset Link</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          {!successMsg && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
              <Link
                to="/signin"
                className="inline-flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Back to Sign In</span>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
