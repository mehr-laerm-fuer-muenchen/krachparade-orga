// Spec 032: SMTP settings for outgoing mail, read from environment variables.
// Pure function: the caller passes the variables in. Values are never logged.

export type MailEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  MAIL_FROM?: string;
  MAIL_ENABLED?: string;
  VERCEL_ENV?: string;
};

export type MailConfig = {
  host: string;
  port: number;
  /** TLS from the start (port 465); otherwise STARTTLS if the server offers it. */
  secure: boolean;
  auth: { user: string; pass: string } | null;
  from: string;
};

export type MailConfigResult = { ok: true; config: MailConfig } | { ok: false; reason: "not_configured" | "disabled" };

function value(text: string | undefined): string {
  return text?.trim() ?? "";
}

/**
 * The SMTP settings, or why nothing is sent: a variable is missing, or a
 * Vercel preview without MAIL_ENABLED=1 (mails from click tests must not
 * reach the real mailbox).
 */
export function mailConfig(env: MailEnv): MailConfigResult {
  const vercelEnv = value(env.VERCEL_ENV);
  if (vercelEnv && vercelEnv !== "production" && value(env.MAIL_ENABLED) !== "1") {
    return { ok: false, reason: "disabled" };
  }
  const host = value(env.SMTP_HOST);
  const port = Number(value(env.SMTP_PORT));
  const from = value(env.MAIL_FROM);
  const user = value(env.SMTP_USER);
  const pass = value(env.SMTP_PASSWORD).replace(/\s+/g, "");
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535 || !from) {
    return { ok: false, reason: "not_configured" };
  }
  // User and password belong together; the local Mailpit needs neither.
  if (Boolean(user) !== Boolean(pass)) return { ok: false, reason: "not_configured" };
  return {
    ok: true,
    config: { host, port, secure: port === 465, auth: user ? { user, pass } : null, from },
  };
}

/** "Krachparade Orga <orga@example.org>" → "orga@example.org" (for Reply-To). */
export function addressOf(from: string): string {
  const match = /<([^<>\s]+@[^<>\s]+)>\s*$/.exec(from);
  return match ? match[1] : from.trim();
}
