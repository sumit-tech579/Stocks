import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  Lock, 
  KeyRound, 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Eye, 
  EyeOff, 
  Check, 
  ShieldCheck 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${name[0]}***@${domain}`;
  }
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

export const ForgotPasswordPage: React.FC = () => {
  const { 
    sendPasswordResetCode, 
    verifyPasswordResetCode, 
    submitNewPassword 
  } = useAuth();

  // Step 1: 'email', Step 2: 'code', Step 3: 'password', Step 4: 'success'
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'success'>('email');

  // Step 1 state
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Step 2 state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resetAuthToken, setResetAuthToken] = useState<string | null>(null);

  // Step 3 state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Shared alerts
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first input when moving to code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [step]);

  // Handle digit input change in Step 2
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

    if (index < 5 && char) {
      inputRefs.current[index + 1]?.focus();
    }
  };

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
      handleVerifyCode();
    }
  };

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

  // STEP 1: Submit Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSendingEmail(true);
    try {
      const { error, message } = await sendPasswordResetCode(cleanEmail);
      if (error) {
        setErrorMessage(error);
      } else {
        setStatusMessage(message || 'If an account exists, a 6-digit recovery code has been sent.');
        setResendCooldown(60);
        setStep('code');
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  // STEP 2: Resend Code
  const handleResendCode = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const { error, message } = await sendPasswordResetCode(email.trim());
      if (error) {
        setErrorMessage(error);
      } else {
        setStatusMessage(message || 'A fresh 6-digit recovery code has been sent.');
        setResendCooldown(60);
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsResending(false);
    }
  };

  // STEP 2: Verify Code
  const handleVerifyCode = async () => {
    const fullCode = digits.join('');
    setErrorMessage(null);
    setStatusMessage(null);

    if (fullCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of the recovery code.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const result = await verifyPasswordResetCode(email.trim(), fullCode);
      if (result.success && result.resetAuthToken) {
        setResetAuthToken(result.resetAuthToken);
        setStep('password');
        setStatusMessage('Code verified. Please set your new password.');
      } else {
        setErrorMessage(result.error || 'Invalid or expired recovery code.');
        inputRefs.current[0]?.focus();
      }
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (!resetAuthToken) {
      setErrorMessage('Session expired. Please restart the password reset process.');
      setStep('email');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(newPassword) || !/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) {
      setErrorMessage('Password must contain letters and at least one number or symbol.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify both fields.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const result = await submitNewPassword(resetAuthToken, newPassword);
      if (result.success) {
        setStep('success');
        setStatusMessage(result.message || 'Your password has been reset successfully!');
      } else {
        setErrorMessage(result.error || 'Failed to update password.');
      }
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Password policy check indicators
  const hasMinLength = newPassword.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(newPassword) && /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-10 px-4 sm:px-6">
      <div className="max-w-md w-full space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white shadow-lg shadow-emerald-500/25 mb-1">
            {step === 'success' ? <CheckCircle2 className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {step === 'email' && 'Reset Password'}
            {step === 'code' && 'Enter Recovery Code'}
            {step === 'password' && 'Create New Password'}
            {step === 'success' && 'Password Changed!'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {step === 'email' && 'Enter your registered email to receive a 6-digit recovery code'}
            {step === 'code' && 'Enter the 6-digit code sent to your email inbox'}
            {step === 'password' && 'Choose a strong, secure password for your TradeNest account'}
            {step === 'success' && 'Your account security has been updated'}
          </p>
        </div>

        {/* Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-xl border-slate-200/80 dark:border-slate-800">
          {/* Status Message */}
          {statusMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
              <span className="leading-snug">{statusMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs sm:text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Enter Email Form */}
          {step === 'email' && (
            <form onSubmit={handleSendEmail} className="space-y-4">
              <Input
                label="Registered Email Address"
                type="email"
                placeholder="you@example.com"
                leftIcon={<Mail className="w-4 h-4" />}
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isSendingEmail}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2 font-semibold shadow-md shadow-emerald-500/20"
                isLoading={isSendingEmail}
                disabled={isSendingEmail}
              >
                <span>Send 6-Digit Code</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit Code */}
          {step === 'code' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 block font-medium">Code sent to:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-mono">
                      {maskEmail(email)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setDigits(['', '', '', '', '', '']);
                    setErrorMessage(null);
                  }}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors shrink-0 ml-2"
                >
                  Change
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 text-center">
                  6-Digit Recovery Code
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
                      disabled={isVerifyingCode}
                      className={`w-12 h-14 sm:w-13 sm:h-14 text-center font-mono text-xl sm:text-2xl font-extrabold rounded-xl border transition-all outline-none ${
                        errorMessage
                          ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 focus:ring-2 focus:ring-rose-500/20'
                          : digit
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                          : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                      }`}
                      aria-label={`Recovery Digit ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full font-semibold shadow-md shadow-emerald-500/20"
                onClick={handleVerifyCode}
                isLoading={isVerifyingCode}
                disabled={isVerifyingCode || digits.join('').length !== 6}
              >
                <span>Verify Recovery Code</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={isResending || resendCooldown > 0}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Resend code in ${resendCooldown}s`
                      : "Didn't receive the code? Resend Code"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Create New Password */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in">
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={isResettingPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  label="Confirm New Password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat new password"
                  leftIcon={<Lock className="w-4 h-4" />}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={isResettingPassword}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Policy Checklist */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasMinLength ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>At least 8 characters</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLetterAndNumber ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${hasLetterAndNumber ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>Contains letters and numbers or symbols</span>
                </div>
                <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}`}>
                  <Check className={`w-3.5 h-3.5 ${passwordsMatch ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span>Passwords match</span>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2 font-semibold shadow-md shadow-emerald-500/20"
                isLoading={isResettingPassword}
                disabled={isResettingPassword || !hasMinLength || !hasLetterAndNumber || !passwordsMatch}
              >
                <span>Save New Password</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </form>
          )}

          {/* STEP 4: Success Message */}
          {step === 'success' && (
            <div className="space-y-4 animate-in fade-in text-center">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 space-y-1">
                <p className="font-semibold">Security update completed</p>
                <p className="text-slate-600 dark:text-slate-400">
                  Your password has been updated and all active sessions on other devices have been revoked.
                </p>
              </div>

              <div className="pt-2">
                <Link to="/signin">
                  <Button variant="primary" size="lg" className="w-full font-semibold">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    <span>Sign In With New Password</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Bottom Back to Sign In Link */}
          {step !== 'success' && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <Link
                to="/signin"
                className="inline-flex items-center text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Back to Sign In</span>
              </Link>

              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>TradeNest Secure Recovery</span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
