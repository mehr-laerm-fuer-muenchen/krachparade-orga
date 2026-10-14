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

export const SEED_VERSION = "3";

/** Made-up test members (spec 002), never in production. */
export const TEST_MEMBERS = [
  { email: "kim.brenner@example.org", name: "Kim Brenner", isAdmin: true },
  { email: "alex.rauch@example.org", name: "Alex Rauch", isAdmin: false },
  { email: "sascha.moeller@example.org", name: "Sascha Möller", isAdmin: false },
  // Spec 003
  { email: "robin.tal@example.org", name: "Robin Tal", isAdmin: false },
  { email: "jo.kranz@example.org", name: "Jo Kranz", isAdmin: false },
  { email: "mika.sonnleitner@example.org", name: "Mika Sonnleitner", isAdmin: false },
  { email: "luca.pfeffer@example.org", name: "Luca Pfeffer", isAdmin: false },
  { email: "noa.fink@example.org", name: "Noa Fink", isAdmin: false },
  { email: "ivy.lamm@example.org", name: "Ivy Lamm", isAdmin: false },
];

/** The current edition (spec 003), also in production. */
export const EDITION = { name: "Krachparade 2027", dDay: "2027-05-08" };

/**
 * The 15 departments in display order (spec 003), with the lead from the test
 * members. Production gets the departments without a lead.
 */
export const DEPARTMENTS = [
  { name: "Demoleitung", lead: "kim.brenner@example.org" },
  { name: "Planung Auftakt/Abschlussfläche", lead: "alex.rauch@example.org" },
  { name: "Bühne / Soundkopplung", lead: "sascha.moeller@example.org" },
  { name: "Route", lead: "kim.brenner@example.org" },
  { name: "Wagenreihung", lead: "robin.tal@example.org" },
  { name: "Wagenpakete", lead: "alex.rauch@example.org" },
  { name: "Bühnenprogramm politisch", lead: "jo.kranz@example.org" },
  { name: "Bühnenprogramm musikalisch", lead: "mika.sonnleitner@example.org" },
  { name: "Social Media", lead: "luca.pfeffer@example.org" },
  { name: "Kommunikation E-Mails", lead: "mika.sonnleitner@example.org" },
  { name: "Kollektiv-Chats", lead: "noa.fink@example.org" },
  { name: "Teaser / Aftermovie", lead: "ivy.lamm@example.org" },
  { name: "Pressearbeit", lead: "jo.kranz@example.org" },
  { name: "Finanzen", lead: "noa.fink@example.org" },
  { name: "Ressourcen / Material", lead: "ivy.lamm@example.org" },
];

/**
 * Idempotent: a second run changes nothing. With `prod` only master data is
 * written, never test people (from spec 002 on, always with @example.org).
 */
export async function seed({ prod }: { prod: boolean }) {
  const { db } = await import("./index");
  const { eq } = await import("drizzle-orm");
  const { appMeta, departments, editions, members } = await import("./schema");

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

  // Existing editions and departments are never overwritten: the D-Day,
  // names and leads may have been changed in the app since.
  await db
    .insert(editions)
    .values({ ...EDITION, isCurrent: true })
    .onConflictDoNothing({ target: editions.name });
  const [edition] = await db.select().from(editions).where(eq(editions.name, EDITION.name));
  console.log(`editions: ${edition.name} (D-Day ${edition.dDay})`);

  const memberIds = new Map<string, string>();
  if (!prod) {
    for (const member of await db.select({ id: members.id, email: members.email }).from(members)) {
      memberIds.set(member.email, member.id);
    }
  }
  const inserted = await db
    .insert(departments)
    .values(
      DEPARTMENTS.map((department, index) => ({
        editionId: edition.id,
        name: department.name,
        sortOrder: index + 1,
        leadId: memberIds.get(department.lead) ?? null,
      }))
    )
    .onConflictDoNothing()
    .returning({ id: departments.id });
  console.log(`departments: ${inserted.length} neu, ${DEPARTMENTS.length - inserted.length} schon vorhanden`);
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed({ prod: isProd }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
