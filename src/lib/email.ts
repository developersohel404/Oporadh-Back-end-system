import { Resend } from 'resend';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

const emailTemplates = {
  EMAIL_VERIFY: (link: string) => ({
    subject: 'OPORADH — Verify Your Email',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Welcome to OPORADH</h2>
        <p>Thank you for registering. Please confirm your email address to activate your account.</p>
        <p style="margin: 30px 0;">
          <a href="${link}"
             style="background: #1e40af; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Confirm Email
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          This link expires in 24 hours. If you didn't register, ignore this email.
        </p>
      </div>
    `,
  }),

  PASSWORD_RESET: (link: string) => ({
    subject: 'OPORADH — Password Reset',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Password Reset</h2>
        <p>Click the button below to reset your password.</p>
        <p style="margin: 30px 0;">
          <a href="${link}"
             style="background: #dc2626; color: white; padding: 12px 24px;
                    text-decoration: none; border-radius: 6px; display: inline-block;">
            Reset Password
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">
          This link expires in 1 hour.
        </p>
      </div>
    `,
  }),
};

interface SendEmailParams {
  to: string;
  link: string;
  purpose: keyof typeof emailTemplates;
}

export const sendVerificationEmail = async ({
  to,
  link,
  purpose,
}: SendEmailParams): Promise<void> => {
  if (env.NODE_ENV === 'development' && !resend) {
    logger.warn('📧 RESEND_API_KEY missing — printing to console:');
    console.log('\n========================================');
    console.log(`To:      ${to}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`Link:    ${link}`);
    console.log('========================================\n');
    return;
  }

  if (!resend) {
    throw new Error('Email provider not configured');
  }

  const template = emailTemplates[purpose](link);

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject: template.subject,
    html: template.html,
  });

  if (error) {
    logger.error({ error, to, purpose }, 'Failed to send email');
    throw new Error(`Email send failed: ${error.message}`);
  }

  logger.info({ to, purpose }, 'Verification email sent');
};
