import nodemailer from "nodemailer";
import { addressOf, mailConfig } from "./config";

// Spec 032: sends one plain-text mail over SMTP (Gmail in production, Mailpit
// locally). Server only. Logs only error names, never addresses, contents or
// settings.

export type OutgoingMail = {
  to: string;
  cc?: string | null;
  subject: string;
  text: string;
};

const TIMEOUT_MS = 10_000;

export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  const result = mailConfig({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_ENABLED: process.env.MAIL_ENABLED,
    APP_ENV: process.env.APP_ENV,
  });
  if (!result.ok) {
    console.warn(result.reason === "disabled" ? "[mail] in dieser Umgebung aus" : "[mail] nicht eingerichtet");
    return false;
  }
  const { config } = result;
  try {
    const transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth ?? undefined,
      connectionTimeout: TIMEOUT_MS,
      greetingTimeout: TIMEOUT_MS,
      socketTimeout: TIMEOUT_MS,
    });
    await transport.sendMail({
      from: config.from,
      replyTo: addressOf(config.from),
      to: mail.to,
      cc: mail.cc ?? undefined,
      subject: mail.subject,
      text: mail.text,
    });
    return true;
  } catch (error) {
    console.error(`[mail] ${error instanceof Error ? error.name : "Fehler"}`);
    return false;
  }
}
