import { createHmac, timingSafeEqual } from "node:crypto";

// Signed start time of the public registration form. The page issues it on
// the server; the action checks it, so a script cannot claim an earlier start
// (the browser clock no longer counts). Server only.

/** A token older than this is refused; the draft stays in the browser. */
export const FORM_TOKEN_MAX_AGE_HOURS = 12;

export type FormTokenCheck = "ok" | "invalid" | "too_fast" | "expired";

function signature(issuedAt: number, secret: string): string {
  // Own context string, so this HMAC is never valid for anything else signed
  // with the same secret.
  return createHmac("sha256", secret).update(`collective-registration-start:${issuedAt}`).digest("base64url");
}

/** `<issuedAt ms>.<signature>` */
export function issueFormToken(now: number, secret: string): string {
  if (!secret) throw new Error("Secret for the form token missing");
  return `${now}.${signature(now, secret)}`;
}

/** A token for a page rendered right now, signed with AUTH_SECRET. Server only. */
export function newFormToken(): string {
  return issueFormToken(Date.now(), process.env.AUTH_SECRET ?? "");
}

export function checkFormToken(
  token: unknown,
  now: number,
  secret: string,
  minSeconds: number,
  maxAgeHours: number = FORM_TOKEN_MAX_AGE_HOURS
): FormTokenCheck {
  if (!secret || typeof token !== "string" || token.length > 200) return "invalid";
  const match = /^(\d{1,15})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return "invalid";
  const issuedAt = Number(match[1]);
  const given = Buffer.from(match[2]);
  const expected = Buffer.from(signature(issuedAt, secret));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "invalid";
  const age = now - issuedAt;
  if (age < minSeconds * 1000) return "too_fast";
  if (age > maxAgeHours * 60 * 60 * 1000) return "expired";
  return "ok";
}
