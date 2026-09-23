import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  CheckCircle2, 
  RotateCw, 
  ArrowRight, 
  AlertCircle, 
  ShieldCheck, 
  Copy, 
  Check, 
  KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import confetti from 'canvas-confetti';

export const VerifyEmailPage: React.FC = () => {
  const { 
    user, 
    verifyEmailCode, 
    sendVerificationCode, 
    currentVerificationCode 
  } = useAuth();
  
  const navigate = useNavigate();

  // 6 individual digit states
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // If already verified, show verified status
  useEffect(() => {
    if (user?.emailVerified) {
      setIsSuccess(true);
    }
  }, [user?.emailVerified]);

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
    // Only accept numeric characters
    const cleanVal = value.replace(/\D/g, '');
    if (!cleanVal) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // Single digit entry
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

  // Handle keyboard navigation (Backspace, ArrowLeft, ArrowRight)
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

    // Focus on the next empty or last box
    const nextFocusIndex = Math.min(pasteData.length, 5);
    inputRefs.current[nextFocusIndex]?.focus();
  };

  // Trigger celebratory confetti on success
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.7 },
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
        setStatusMessage('Email verified successfully! Your account is fully active.');
        triggerConfetti();
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1600);
      } else {
        setErrorMessage(error || 'Invalid verification code. Please check the code and try again.');
        // Clear and refocus first box on failure
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
      const { error, message } = await sendVerificationCode();
      if (error) {
        setErrorMessage(error);
      } else {
        setStatusMessage(message || 'A fresh 6-digit verification code has been dispatched.');
        setResendCooldown(30); // 30s cooldown
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsResending(false);
    }
  };

  // Copy code helper (auto-fills digit boxes for rapid testing)
  const handleCopyAndAutofill = (code: string) => {
    navigator.clipboard.writeText(code);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);

    const codeChars = code.split('').slice(0, 6);
    setDigits(codeChars);
    setErrorMessage(null);
    inputRefs.current[5]?.focus();
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
            {isSuccess ? 'Email Verified!' : 'Enter Verification Code'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isSuccess 
              ? 'Your TradeNest paper trading account is verified and ready'
              : 'Enter the 6-digit verification code sent to your email address'
            }
          </p>
        </div>

        {/* Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-xl border-slate-200/80 dark:border-slate-800">
          {/* Target Email address */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-center">
            <span className="text-xs text-slate-400 block font-medium">Code dispatched to:</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm break-all">
              {user?.email || 'your registered email'}
            </span>
          </div>

          {/* In-App Email Dispatch Preview Card */}
          {currentVerificationCode && !isSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Mail className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>TradeNest Email Dispatch Preview</span>
                </div>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
                  Live OTP
                </span>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40">
                <div>
                  <span className="text-[10px] text-slate-400 block">Your 6-Digit Code</span>
                  <span className="font-mono text-xl font-extrabold text-emerald-700 dark:text-emerald-300 tracking-wider">
                    {currentVerificationCode}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyAndAutofill(currentVerificationCode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Fill Code</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Click <strong>Fill Code</strong> to automatically populate the 6 boxes below, or enter it manually.
              </p>
            </div>
          )}

          {/* Success Alert */}
          {statusMessage && isSuccess && (
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

          {!isSuccess ? (
            <div className="space-y-4">
              {/* 6-Digit OTP Input Grid */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 text-center">
                  Enter 6-Digit Verification Code
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
                <span>Verify Email Code</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              {/* Resend Code Button with countdown */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={isResending || resendCooldown > 0}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend new code in ${resendCooldown}s`
                      : "Didn't receive the code? Resend Code"}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <Link to="/">
                <Button variant="primary" size="lg" className="w-full font-semibold">
                  <span>Go to Trading Dashboard</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <Link to="/">
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700"
              >
                <span>Continue to Dashboard Without Verifying</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Simulated paper trading is active with ₹1,00,000 cash.</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
