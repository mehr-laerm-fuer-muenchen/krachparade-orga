import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Production counterpart of drizzle.config.ts, used only by `pnpm db:push:prod`.
// Franz runs that himself (steps in AGENTS.md, label `braucht-db`).
config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL_PROD;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL_PROD fehlt. Bitte in .env.local die Adresse des Neon-Zweigs production eintragen."
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
