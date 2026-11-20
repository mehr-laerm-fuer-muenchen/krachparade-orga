// Local test database in Docker (docker/compose.yaml): Postgres behind a
// small proxy that speaks Neon's HTTP protocol, so the app keeps using the
// neon-http driver. Only used when LOCAL_NEON_HTTP_ENDPOINT points to this
// machine and the app does not run on Vercel.

export type LocalDbEnv = {
  LOCAL_NEON_HTTP_ENDPOINT?: string;
  VERCEL_ENV?: string;
};

/** The proxy URL (e.g. http://localhost:4444/sql), or null for Neon itself. */
export function localNeonEndpoint(env: LocalDbEnv): string | null {
  const value = env.LOCAL_NEON_HTTP_ENDPOINT?.trim();
  if (!value || env.VERCEL_ENV) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return local && url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
