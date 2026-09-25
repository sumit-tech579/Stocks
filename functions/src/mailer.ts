import nodemailer from 'nodemailer';

// Provider credentials from Cloud Functions environment / process.env
const resendApiKey = process.env.RESEND_API_KEY || (process.env.EMAIL_PROVIDER_API_KEY?.startsWith('re_') ? process.env.EMAIL_PROVIDER_API_KEY : '');
const sendgridApiKey = process.env.SENDGRID_API_KEY || (process.env.EMAIL_PROVIDER_API_KEY?.startsWith('SG.') ? process.env.EMAIL_PROVIDER_API_KEY : '');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PROVIDER_API_KEY;
const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;

const fromAddress = process.env.EMAIL_FROM_ADDRESS || smtpUser || (resendApiKey ? 'onboarding@resend.dev' : 'no-reply@tradenest.app');
const fromName = process.env.EMAIL_FROM_NAME || 'TradeNest';
const formattedFrom = `"${fromName}" <${fromAddress}>`;

let smtpTransporter: nodemailer.Transporter | null = null;

if (smtpHost && smtpUser && smtpPass) {
  try {
    smtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } catch (err) {
    console.error('[Mailer] Failed to initialize SMTP transporter:', err);
  }
}

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
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 10px;
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
        Simulated Trading & Portfolio Engine
      </div>
    </div>
    <div class="body">
      ${contentHtml}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px;">Need help? Contact support at <a href="mailto:support@tradenest.app" style="color: #10b981; text-decoration: none;">support@tradenest.app</a></p>
      <p style="margin: 0;">TradeNest Inc. &bull; Virtual Trading Platform &bull; Never share this code with anyone.</p>
    </div>
  </div>
</body>
</html>
`;
}

async function dispatchEmail(to: string, subject: string, html: string): Promise<void> {
  // 1. Resend REST API
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: formattedFrom,
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Mailer] Resend API error response:', errorData);
        throw new Error(errorData.message || `Resend API returned status ${response.status}`);
      }

      console.log(`[Mailer] Successfully dispatched email via Resend to ${to}`);
      return;
    } catch (err: any) {
      console.error('[Mailer] Resend delivery error:', err.message);
      throw new Error('Unable to send the verification email right now. Please try again.');
    }
  }

  // 2. SendGrid REST API
  if (sendgridApiKey) {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromAddress, name: fromName },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('[Mailer] SendGrid error response:', errorText);
        throw new Error(`SendGrid API returned status ${response.status}`);
      }

      console.log(`[Mailer] Successfully dispatched email via SendGrid to ${to}`);
      return;
    } catch (err: any) {
      console.error('[Mailer] SendGrid delivery error:', err.message);
      throw new Error('Unable to send the verification email right now. Please try again.');
    }
  }

  // 3. Nodemailer SMTP
  if (smtpTransporter) {
    try {
      await smtpTransporter.sendMail({
        from: formattedFrom,
        to,
        subject,
        html,
      });
      console.log(`[Mailer] Successfully dispatched email via SMTP to ${to}`);
      return;
    } catch (err: any) {
      console.error('[Mailer] SMTP delivery error:', err.message);
      throw new Error('Unable to send the verification email right now. Please try again.');
    }
  }

  console.error('[Mailer] No email provider credentials configured.');
  throw new Error('Unable to send the verification email right now. Please try again.');
}

export async function sendVerificationEmail(email: string, code: string): Promise<void> {
  const content = `
    <div class="badge">EMAIL VERIFICATION</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Verify your TradeNest email address</h2>
    <p>Welcome to TradeNest! To complete your registration and activate your paper trading account, please enter the 6-digit verification code below:</p>
    
    <div class="code-container">
      <div class="code-box">${code}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 10px;">This code expires in <strong>10 minutes</strong> and can only be used once.</p>
    </div>

    <div class="alert-box">
      <strong>Security notice:</strong> Never share this code with anyone. If you did not create a TradeNest account with this email address, you can safely ignore this email.
    </div>
  `;

  await dispatchEmail(
    email,
    `Your TradeNest Verification Code: ${code}`,
    wrapEmailTemplate(content)
  );
}

export async function sendPasswordResetEmail(email: string, code: string): Promise<void> {
  const content = `
    <div class="badge" style="background-color: rgba(245, 158, 11, 0.15); color: #fbbf24;">PASSWORD RECOVERY</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Reset your TradeNest password</h2>
    <p>We received a request to reset your TradeNest password. Enter the 6-digit recovery code below in the app to choose a new password:</p>
    
    <div class="code-container">
      <div class="code-box" style="border-color: #f59e0b; color: #fbbf24;">${code}</div>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 10px;">This recovery code expires in <strong>10 minutes</strong>.</p>
    </div>

    <div class="alert-box">
      <strong>Important:</strong> If you did not request a password reset, your account is safe and no changes have been made. Never share this code with anyone.
    </div>
  `;

  await dispatchEmail(
    email,
    `Your TradeNest Password Reset Code: ${code}`,
    wrapEmailTemplate(content)
  );
}

export async function sendPasswordChangedEmail(email: string): Promise<void> {
  const content = `
    <div class="badge">SECURITY NOTIFICATION</div>
    <h2 style="color: #f8fafc; margin: 0 0 12px; font-size: 20px;">Your password has been changed</h2>
    <p>The password for your TradeNest account (<strong>${email}</strong>) was successfully updated on <strong>${new Date().toUTCString()}</strong>.</p>
    <p>For your security, all active sessions on other devices have been revoked and will require signing in again.</p>
    
    <div class="alert-box" style="border-left-color: #ef4444;">
      <strong>Did not make this change?</strong> If you did not perform this update, please reset your password immediately or contact our support team.
    </div>
  `;

  await dispatchEmail(
    email,
    `Security Alert: TradeNest Password Changed`,
    wrapEmailTemplate(content)
  );
}

export async function sendGoogleAccountNoticeEmail(email: string): Promise<void> {
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

  await dispatchEmail(
    email,
    `TradeNest Sign-In Information`,
    wrapEmailTemplate(content)
  );
}
