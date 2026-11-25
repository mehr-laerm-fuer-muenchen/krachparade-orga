// Cloudflare Turnstile on the public registration form. Without keys it is
// off (locally, click tests); in production missing keys refuse every
// registration, so the protection cannot silently disappear.

export type TurnstileEnv = {
  APP_ENV?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export type TurnstileMode =
  | { mode: "on"; siteKey: string; secretKey: string }
  | { mode: "off" }
  | { mode: "misconfigured" };

export function turnstileMode(env: TurnstileEnv): TurnstileMode {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim() ?? "";
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim() ?? "";
  if (siteKey && secretKey) return { mode: "on", siteKey, secretKey };
  return env.APP_ENV === "production" ? { mode: "misconfigured" } : { mode: "off" };
}

export function turnstileEnvFromProcess(): TurnstileEnv {
  return {
    APP_ENV: process.env.APP_ENV,
    TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  };
}

export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Turnstile tokens are at most 2048 characters long. */
export function plausibleTurnstileToken(token: unknown): token is string {
  return typeof token === "string" && token.length > 0 && token.length <= 2048;
}

/** Asks Cloudflare whether the token is valid; false on any error. Server only. */
export async function verifyTurnstile(
  token: unknown,
  secretKey: string,
  fetcher: typeof fetch = fetch
): Promise<boolean> {
  if (!plausibleTurnstileToken(token)) return false;
  try {
    const response = await fetcher(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret: secretKey, response: token }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: unknown };
    return result.success === true;
  } catch {
    return false;
  }
}
