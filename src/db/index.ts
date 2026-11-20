import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/env";
import { localNeonEndpoint } from "@/lib/local-db";
import * as schema from "./schema";

// Local Docker database (docker/compose.yaml): queries go to the HTTP proxy
// in front of Postgres. Never on Vercel, see localNeonEndpoint.
const localEndpoint = localNeonEndpoint({
  LOCAL_NEON_HTTP_ENDPOINT: process.env.LOCAL_NEON_HTTP_ENDPOINT,
  VERCEL_ENV: process.env.VERCEL_ENV,
});
if (localEndpoint) {
  neonConfig.fetchEndpoint = localEndpoint;
}

export const db = drizzle(neon(getDatabaseUrl()), { schema });
