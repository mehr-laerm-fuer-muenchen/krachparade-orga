export const DEV_LOGIN_PATH = "/dev/login";

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
