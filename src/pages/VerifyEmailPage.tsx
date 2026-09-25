import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  RotateCw, 
  ArrowRight, 
  AlertCircle, 
  KeyRound,
  LogOut,
  ShieldCheck,
  Mail,
  RefreshCw,
  Edit3,
  X,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import confetti from 'canvas-confetti';

function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export const VerifyEmailPage: React.FC = () => {
  const { 
    user, 
    isDemo, 
    verifyEmailCode, 
    sendVerificationCode, 
    changeEmail,
    reloadUserProfile,
    signOut 
  } = useAuth();
  
  const navigate = useNavigate();

  // 6 individual digit states
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Change Email Modal state
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [isSubmittingNewEmail, setIsSubmittingNewEmail] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState<string | null>(null);

  // If already verified or in demo mode, navigate straight to dashboard
  useEffect(() => {
    if (user?.emailVerified || isDemo) {
      setIsSuccess(true);
      const timer = setTimeout(() => {
        navigate('/', { replace: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.emailVerified, isDemo, navigate]);

  // If not signed in at all, redirect to signin
  useEffect(() => {
    if (!user && !isDemo) {
      navigate('/signin', { replace: true });
    }
  }, [user, isDemo, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    if (!isSuccess && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [isSuccess]);

  // Handle digit input change
  const handleDigitChange = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    const char = cleanVal.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setErrorMessage(null);

    // Auto-focus next input box
    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      handleVerify();
    }
  };

  // Handle Paste event across all boxes
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasteData[i] || '';
    }
    setDigits(next);
    setErrorMessage(null);

    const nextFocusIndex = Math.min(pasteData.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  // Trigger celebratory confetti on success
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 75,
        origin: { y: 0.65 },
        colors: ['#00D09C', '#10B981', '#34D399', '#6EE7B7'],
      });
    } catch {}
  };

  // Verify entered code
  const handleVerify = async () => {
    const fullCode = digits.join('');
    setErrorMessage(null);
    setStatusMessage(null);

    if (fullCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const { success, error } = await verifyEmailCode(fullCode);
      if (success) {
        setIsSuccess(true);
        setStatusMessage('Email verified successfully! Opening your trading dashboard...');
        triggerConfetti();
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } else {
        setErrorMessage(error || 'Invalid verification code. Please check and try again.');
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend fresh code
  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { error, message, retryAfter } = await sendVerificationCode();
      if (error) {
        setErrorMessage(error);
        if (retryAfter) {
          setResendCooldown(retryAfter);
        }
      } else {
        setStatusMessage(message || 'A fresh verification code has been dispatched to your email.');
        setResendCooldown(60); // 60s cooldown
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsResending(false);
    }
  };

  // Check verification status (useful if user clicked link in email)
  const handleCheckStatus = async () => {
    setIsCheckingStatus(true);
    setErrorMessage(null);
    try {
      await reloadUserProfile();
      if (user?.emailVerified) {
        setIsSuccess(true);
        setStatusMessage('Email verified! Opening your trading dashboard...');
        triggerConfetti();
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1200);
      } else {
        setStatusMessage('Verification pending. Please enter the 6-digit code sent to your email.');
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Handle email update submission
  const handleSaveNewEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangeEmailError(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!newEmailInput.trim() || !emailRegex.test(newEmailInput.trim())) {
      setChangeEmailError('Please enter a valid email address.');
      return;
    }

    if (newEmailInput.trim().toLowerCase() === user?.email?.toLowerCase()) {
      setChangeEmailError('New email must be different from current email.');
      return;
    }

    setIsSubmittingNewEmail(true);
    try {
      const { error, message } = await changeEmail(newEmailInput.trim().toLowerCase());
      if (error) {
        setChangeEmailError(error);
      } else {
        setIsChangingEmail(false);
        setNewEmailInput('');
        setStatusMessage(message || `Email updated to ${newEmailInput.trim()}. A new verification code has been sent.`);
        setResendCooldown(60);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsSubmittingNewEmail(false);
    }
  };

  // Handle user signing out
  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-md mb-1 transition-all ${
            isSuccess 
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' 
              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isSuccess ? <CheckCircle2 className="w-8 h-8" /> : <KeyRound className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isSuccess ? 'Email Verified!' : 'Verify Your Email'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isSuccess 
              ? 'Your TradeNest paper trading account is verified and ready'
              : 'Enter the six-digit code sent to your registered email.'
            }
          </p>
        </div>

        {/* Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-xl border-slate-200/80 dark:border-slate-800">
          {/* Target Email address */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="truncate">
                <span className="text-[11px] text-slate-400 block font-medium">Sent to:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm font-mono">
                  {maskEmail(user?.email)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsChangingEmail(true);
                setNewEmailInput(user?.email || '');
                setChangeEmailError(null);
              }}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors shrink-0 ml-2 inline-flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Change</span>
            </button>
          </div>

          {/* Change Email Inline Form / Modal */}
          {isChangingEmail && (
            <form onSubmit={handleSaveNewEmail} className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Update Registered Email
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangingEmail(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {changeEmailError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{changeEmailError}</span>
                </div>
              )}

              <Input
                label="New Email Address"
                type="email"
                placeholder="name@example.com"
                value={newEmailInput}
                onChange={e => setNewEmailInput(e.target.value)}
                required
                className="text-xs sm:text-sm"
              />

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full text-xs font-semibold"
                  isLoading={isSubmittingNewEmail}
                  disabled={isSubmittingNewEmail}
                >
                  Update & Send Code
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setIsChangingEmail(false)}
                  disabled={isSubmittingNewEmail}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* Success Alert */}
          {statusMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span className="leading-snug">{statusMessage}</span>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {!isSuccess && (
            <div className="space-y-4">
              {/* 6-Digit OTP Input Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 text-center">
                  6-Digit Verification Code
                </label>

                <div 
                  className="flex items-center justify-between gap-2 sm:gap-2.5"
                  onPaste={handlePaste}
                >
                  {digits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => (inputRefs.current[idx] = el)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleDigitChange(idx, e.target.value)}
                      onKeyDown={e => handleKeyDown(idx, e)}
                      disabled={isVerifying}
                      className={`w-12 h-14 sm:w-13 sm:h-14 text-center font-mono text-xl sm:text-2xl font-extrabold rounded-xl border transition-all outline-none ${
                        errorMessage
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 focus:ring-2 focus:ring-rose-500/20'
                          : digit
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      }`}
                      aria-label={`Digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* Verify Button */}
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full font-semibold shadow-md shadow-emerald-500/20"
                onClick={handleVerify}
                isLoading={isVerifying}
                disabled={isVerifying || digits.join('').length !== 6}
              >
                <span>Verify Code</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              {/* Secondary Actions: Resend Code & Refresh Status */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-center">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Resend Code"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                  <span>Check Status</span>
                </button>
              </div>

              {/* Spam Notice */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Didn't receive the email? Check your <strong>spam or junk folder</strong>, or request a new code.
                </span>
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span>Sign out</span>
            </button>

            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Code expires in 10 minutes</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
