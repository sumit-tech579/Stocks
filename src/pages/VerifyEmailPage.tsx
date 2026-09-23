import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, RotateCw, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

export const VerifyEmailPage: React.FC = () => {
  const { user, resendVerificationEmail, reloadUserProfile } = useAuth();
  const navigate = useNavigate();

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { error, message } = await resendVerificationEmail();
      if (error) {
        setErrorMessage(error);
      } else {
        setStatusMessage(message || 'A fresh verification email has been sent. Please check your inbox.');
        setResendCooldown(60); // 60s cooldown
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsChecking(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await reloadUserProfile();
      if (user?.emailVerified) {
        setStatusMessage('Your email has been verified! Redirecting to dashboard...');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } else {
        setStatusMessage('Email is not yet verified. Please click the link in your email and try checking again.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-md mb-1">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            We've sent a verification link to your registered email
          </p>
        </div>

        {/* Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-xl border-slate-200/80 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-400 block font-medium">Verification link sent to:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm break-all">
              {user?.email || 'your email address'}
            </span>
          </div>

          {user?.emailVerified && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
              <span className="font-medium">Email Verified Successfully!</span>
            </div>
          )}

          {statusMessage && !user?.emailVerified && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span className="leading-snug">{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          <div className="space-y-3">
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full font-semibold"
              onClick={handleCheckStatus}
              isLoading={isChecking}
              disabled={isChecking}
            >
              <RotateCw className="w-4 h-4 mr-2" />
              <span>I've Verified / Refresh Status</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-full"
              onClick={handleResend}
              isLoading={isResending}
              disabled={isResending || resendCooldown > 0}
            >
              <span>
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : 'Resend Verification Email'}
              </span>
            </Button>
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <Link to="/">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
              >
                <span>Continue to Trading Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Your ₹1,00,000 paper trading cash is already credited!</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
