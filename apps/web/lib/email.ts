// Email service using Nodemailer
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.EMAIL_FROM || "noreply@play.com";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export async function sendVerificationEmail(
  email: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Verify your email - Play",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3b82f6;">Welcome to Play!</h1>
        <p>Click the button below to verify your email address:</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666;">Or copy this link: ${verifyUrl}</p>
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Reset your password - Play",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3b82f6;">Password Reset</h1>
        <p>You requested to reset your password. Click the button below:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666;">Or copy this link: ${resetUrl}</p>
        <p style="color: #999; font-size: 12px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
