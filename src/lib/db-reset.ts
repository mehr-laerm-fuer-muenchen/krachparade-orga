export type ResetEnv = {
  APP_ENV?: string;
  DATABASE_URL?: string;
  DATABASE_URL_PROD?: string;
};

/**
 * Why `pnpm db:reset:dev` must not run, or null if it may. It empties every
 * app table, so it refuses anything that looks like production.
 */
export function resetBlockReason(env: ResetEnv): string | null {
  if (env.APP_ENV === "production") {
    return "APP_ENV ist production.";
  }
  if (!env.DATABASE_URL) {
    return "DATABASE_URL fehlt.";
  }
  if (env.DATABASE_URL_PROD && env.DATABASE_URL === env.DATABASE_URL_PROD) {
    return "DATABASE_URL zeigt auf die Production-Datenbank.";
  }
  return null;
}
