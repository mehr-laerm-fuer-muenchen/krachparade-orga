import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

export const db = drizzle(neon(getDatabaseUrl()), { schema });
