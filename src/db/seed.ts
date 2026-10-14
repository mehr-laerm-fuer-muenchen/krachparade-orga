// `pnpm db:seed` targets the dev branch (DATABASE_URL), `pnpm db:seed:prod`
// passes --prod and targets production (DATABASE_URL_PROD). The override has
// to happen before the database module is loaded, so import "./index" only
// dynamically inside seed().
const isProd = process.argv.includes("--prod");
if (isProd) {
  const prodUrl = process.env.DATABASE_URL_PROD;
  if (!prodUrl) {
    throw new Error("DATABASE_URL_PROD fehlt in .env.local.");
  }
  process.env.DATABASE_URL = prodUrl;
}

export const SEED_VERSION = "2";

/** Made-up test members (spec 002), never in production. */
export const TEST_MEMBERS = [
  { email: "kim.brenner@example.org", name: "Kim Brenner", isAdmin: true },
  { email: "alex.rauch@example.org", name: "Alex Rauch", isAdmin: false },
  { email: "sascha.moeller@example.org", name: "Sascha Möller", isAdmin: false },
];

/**
 * Idempotent: a second run changes nothing. With `prod` only master data is
 * written, never test people (from spec 002 on, always with @example.org).
 */
export async function seed({ prod }: { prod: boolean }) {
  const { db } = await import("./index");
  const { appMeta, members } = await import("./schema");

  await db
    .insert(appMeta)
    .values({ key: "seed_version", value: SEED_VERSION })
    .onConflictDoUpdate({ target: appMeta.key, set: { value: SEED_VERSION } });
  console.log(`app_meta: seed_version = ${SEED_VERSION}`);

  if (!prod) {
    for (const member of TEST_MEMBERS) {
      await db
        .insert(members)
        .values({ ...member, active: true })
        .onConflictDoUpdate({
          target: members.email,
          set: { name: member.name, isAdmin: member.isAdmin, active: true },
        });
    }
    console.log(`members: ${TEST_MEMBERS.length} Test-Mitglieder`);
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed({ prod: isProd }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
