import * as nodemailer from "nodemailer";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";

// SMTP config from Firebase environment
const smtpHost = defineString("SMTP_HOST");
const smtpPort = defineString("SMTP_PORT", { default: "587" });
const smtpUser = defineString("SMTP_USER");
const smtpPass = defineString("SMTP_PASS");
const smtpFrom = defineString("SMTP_FROM_EMAIL");
const smtpFromName = defineString("SMTP_FROM_NAME", { default: "Vent Accounting" });

let transporter: nodemailer.Transporter | null = null;
let verified = false;

function maskValue(v: string | undefined): string {
  if (!v) return "<empty>";
  if (v.length <= 4) return "****";
  return v.slice(0, 3) + "***" + v.slice(-2);
}

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const host = smtpHost.value();
    const port = parseInt(smtpPort.value(), 10);
    const user = smtpUser.value();
    const pass = smtpPass.value();
    const fromEmail = smtpFrom.value();

    logger.info("📧 [SMTP] Creating transporter", {
      host: host || "<empty>",
      port,
      secure: port === 465,
      user: user || "<empty>",
      passLength: pass?.length || 0,
      passMasked: maskValue(pass),
      fromEmail: fromEmail || "<empty>",
    });

    if (!host || !user || !pass || !fromEmail) {
      const missing = [];
      if (!host) missing.push("SMTP_HOST");
      if (!user) missing.push("SMTP_USER");
      if (!pass) missing.push("SMTP_PASS");
      if (!fromEmail) missing.push("SMTP_FROM_EMAIL");
      logger.error("📧 [SMTP] Missing required config", { missing });
      throw new Error(`SMTP not configured. Missing: ${missing.join(", ")}`);
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      logger: false, // set to true for verbose nodemailer internal logs
      debug: false,
    });

    logger.info("📧 [SMTP] Transporter created");
  }
  return transporter;
}

async function verifyTransporter(transport: nodemailer.Transporter): Promise<void> {
  if (verified) return;
  try {
    logger.info("📧 [SMTP] Verifying connection...");
    await transport.verify();
    verified = true;
    logger.info("✅ [SMTP] Connection verified — ready to send");
  } catch (err: any) {
    logger.error("❌ [SMTP] Verification failed", {
      code: err.code,
      message: err.message,
      response: err.response,
      responseCode: err.responseCode,
    });
    throw err;
  }
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const t0 = Date.now();
  logger.info("📧 [MAIL] Sending email", {
    to: options.to,
    subject: options.subject,
    htmlLength: options.html.length,
    hasReplyTo: !!options.replyTo,
  });

  try {
    const transport = getTransporter();
    await verifyTransporter(transport);

    const fromHeader = `"${smtpFromName.value()}" <${smtpFrom.value()}>`;
    logger.debug("📧 [MAIL] From header", { from: fromHeader });

    const info = await transport.sendMail({
      from: fromHeader,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      replyTo: options.replyTo,
    });

    logger.info("✅ [MAIL] Email sent successfully", {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected,
      durationMs: Date.now() - t0,
    });
  } catch (err: any) {
    logger.error("❌ [MAIL] Failed to send email", {
      to: options.to,
      subject: options.subject,
      code: err.code,
      command: err.command,
      response: err.response,
      responseCode: err.responseCode,
      message: err.message,
      durationMs: Date.now() - t0,
    });
    throw err;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
