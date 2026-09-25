import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter using environment variables
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
const fromEmail = process.env.SMTP_FROM || `TradeNest <${smtpUser || 'no-reply@tradenest.app'}>`;

let transporter: nodemailer.Transporter | null = null;

if (smtpHost && smtpUser && smtpPass) {
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
  console.log(`[Mailer] Initialized SMTP transporter with host: ${smtpHost}:${smtpPort}`);
} else {
  console.warn(
    '[Mailer] SMTP credentials not provided (SMTP_HOST, SMTP_USER, SMTP_PASS). In development, emails will be logged to server console.'
  );
}

/**
 * Base email layout wrapper with TradeNest emerald branding
 */
function wrapEmailTemplate(contentHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TradeNest</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #e2e8f0;
    }
    .wrapper {
      max-width: 580px;
      margin: 30px auto;
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .header {
      background: linear-gradient(135deg, #064e3b 0%, #022c22 100%);
      padding: 28px 32px;
      border-bottom: 1px solid #065f46;
      text-align: center;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #34d399;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      text-decoration: none;
    }
    .body {
      padding: 32px;
      font-size: 15px;
      line-height: 1.6;
      color: #cbd5e1;
    }
    .code-container {
      margin: 28px 0;
      text-align: center;
    }
    .code-box {
      display: inline-block;
      background-color: #0f172a;
      border: 2px solid #10b981;
      border-radius: 8px;
      padding: 16px 32px;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #10b981;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background-color: rgba(16, 185, 129, 0.15);
      color: #34d399;
      margin-bottom: 12px;
    }
    .footer {
      padding: 20px 32px;
      background-color: #0b0f19;
      border-top: 1px solid #1f2937;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .alert-box {
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 8px;
      background-color: #1e293b;
      border-left: 4px solid #f59e0b;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">
        📈 TradeNest
      </div>
      <div style="color: #a7f3d0; font-size: 13px; margin-top: 4px; font-weight: 500;">
        Paper Trading & Portfolio Simulator
      </div>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">This is an automated security email from TradeNest.</p>
      <p style="margin: 0;">TradeNest Inc. &bull; Simulated Trading Platform &bull; Never share this code with anyone.</p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Sends transactional email or prints to console if SMTP is unconfigured in development
 */
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; preview?: boolean }> {
  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
      });
      console.log(`[Mailer] Successfully dispatched email to ${to} (${subject})`);
      return { success: true };
    } catch (err) {
      console.error(`[Mailer] Failed to send email to ${to}:`, err);
      throw new Error(`Failed to deliver email: ${(err as Error).message}`);
    }
  } else {
    // Development fallback when SMTP credentials are not yet set in .env
    console.log(`\n======================================================`);
    console.log(`[DEVELOPMENT EMAIL PREVIEW] (Set SMTP credentials in .env for real delivery)`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`======================================================\n`);
    return { success: true, preview: true };
  }
}

/**
 * Send 6-digit email verification code
 */
export async function sendVerificationEmail(email: string, code: string): Promise<{ success: boolean; preview?: boolean }> {
  const content = `
    <div class="badge">EMAIL VERIFICATION</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Verify your TradeNest email address</h2>
    <p>Welcome to TradeNest! To complete your registration and activate your ₹1,00,000 virtual trading account, please enter the 6-digit verification code below in your browser:</p>
    
    <div class="code-container">
      <div class="code-box">${code}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 10px;">This code is valid for <strong>10 minutes</strong> and can only be used once.</p>
    </div>

    <div class="alert-box">
      <strong>Security notice:</strong> If you did not sign up for TradeNest with this email address, you can safely ignore this email. No account will be activated without this verification code.
    </div>
  `;

  return sendEmail(
    email,
    `Your TradeNest Verification Code: ${code}`,
    wrapEmailTemplate(content)
  );
}

/**
 * Send 6-digit password reset code
 */
export async function sendPasswordResetEmail(email: string, code: string): Promise<{ success: boolean; preview?: boolean }> {
  const content = `
    <div class="badge" style="background-color: rgba(245, 158, 11, 0.15); color: #fbbf24;">PASSWORD RECOVERY</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Reset your TradeNest password</h2>
    <p>We received a request to reset the password for your TradeNest account. Enter the 6-digit recovery code below to proceed with setting a new password:</p>
    
    <div class="code-container">
      <div class="code-box" style="border-color: #f59e0b; color: #fbbf24;">${code}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 10px;">This security code expires in <strong>10 minutes</strong>.</p>
    </div>

    <div class="alert-box">
      <strong>Important:</strong> If you did not request a password reset, someone else may have entered your email by mistake. Your account is still secure and no changes have been made.
    </div>
  `;

  return sendEmail(
    email,
    `Your TradeNest Password Reset Code: ${code}`,
    wrapEmailTemplate(content)
  );
}

/**
 * Send confirmation after password was successfully changed
 */
export async function sendPasswordChangedEmail(email: string): Promise<{ success: boolean; preview?: boolean }> {
  const content = `
    <div class="badge">SECURITY NOTIFICATION</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Your password has been changed</h2>
    <p>The password for your TradeNest account (<strong>${email}</strong>) was successfully updated on <strong>${new Date().toUTCString()}</strong>.</p>
    <p>For your security, all active sessions on other devices have been revoked and will require signing in again with your new password.</p>
    
    <div class="alert-box" style="border-left-color: #ef4444;">
      <strong>Did not make this change?</strong> If you did not reset your password, your account may be compromised. Please contact support immediately or initiate a password reset right away.
    </div>
  `;

  return sendEmail(
    email,
    `Security Alert: TradeNest Password Changed`,
    wrapEmailTemplate(content)
  );
}

/**
 * Send security notice for Google Sign-In accounts attempting password reset
 */
export async function sendGoogleAccountNoticeEmail(email: string): Promise<{ success: boolean; preview?: boolean }> {
  const content = `
    <div class="badge" style="background-color: rgba(59, 130, 246, 0.15); color: #60a5fa;">SIGN-IN INFORMATION</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Google Account Sign-In</h2>
    <p>We received a password reset request for <strong>${email}</strong>.</p>
    <p>Your TradeNest account was registered using <strong>Google Sign-In</strong>. You do not have a separate password for TradeNest.</p>
    <p>To access your account, simply click <strong>"Continue with Google"</strong> on the Sign In page.</p>

    <div class="alert-box">
      <strong>Need to change your Google password?</strong> Please manage your credentials directly through your Google Account settings.
    </div>
  `;

  return sendEmail(
    email,
    `TradeNest Sign-In Information`,
    wrapEmailTemplate(content)
  );
}
