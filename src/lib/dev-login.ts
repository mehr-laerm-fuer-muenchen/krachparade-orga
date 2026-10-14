export const DEV_LOGIN_PATH = "/dev/login";

/** Auth.js provider id of the dev login (spec 002). */
export const DEV_LOGIN_PROVIDER = "dev-login";

/** The dev login only signs in made-up test members (@example.org). */
export function isDevLoginEmail(email: string): boolean {
  return /^[^@\s]+@example\.org$/.test(email.trim().toLowerCase());
}

export type DevLoginEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  ENABLE_DEV_LOGIN?: string;
};

/**
 * The dev login skips the invite link so Claude Code and the Playwright tests
 * can sign in. It works locally (NODE_ENV not production) and in Vercel
 * previews with ENABLE_DEV_LOGIN=1 – never in production.
 */
export function isDevLoginEnabled(env: DevLoginEnv): boolean {
  if (env.VERCEL_ENV === "production") {
    return false;
  }
  if (env.NODE_ENV !== "production") {
    return true;
  }
  return env.VERCEL_ENV === "preview" && env.ENABLE_DEV_LOGIN === "1";
}

/** The variables `isDevLoginEnabled` needs, read from `process.env`. */
export function devLoginEnvFromProcess(): DevLoginEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    ENABLE_DEV_LOGIN: process.env.ENABLE_DEV_LOGIN,
  };
}
