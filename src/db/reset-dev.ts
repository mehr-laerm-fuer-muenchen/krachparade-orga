// `pnpm db:reset:dev`: empties every app table of the dev database and seeds
// it again. Refuses production (see resetBlockReason).
import { resetBlockReason } from "@/lib/db-reset";

async function main() {
  const reason = resetBlockReason({
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_PROD: process.env.DATABASE_URL_PROD,
  });
  if (reason) {
    console.error(`Abbruch: ${reason} db:reset:dev läuft nur gegen die Dev-Datenbank.`);
    process.exit(1);
  }

  const { getTableName, is, sql } = await import("drizzle-orm");
  const { PgTable } = await import("drizzle-orm/pg-core");
  const { db } = await import("./index");
  const schema = await import("./schema");
  const { seed } = await import("./seed");

  const tables = Object.values(schema).filter((value) => is(value, PgTable));
  const names = tables.map((table) => getTableName(table));
  if (names.length > 0) {
    await db.execute(
      sql`TRUNCATE ${sql.join(names.map((name) => sql.identifier(name)), sql`, `)} RESTART IDENTITY CASCADE`
    );
  }
  console.log(`Geleert: ${names.join(", ") || "keine Tabellen"}`);

  await seed({ prod: false });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
