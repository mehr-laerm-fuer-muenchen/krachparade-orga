// Spec 025: takes the plan of the current edition over into placements, so
// that every open date stays the same (src/lib/plan-legacy.ts).
//
//   pnpm db:lage                  preview against the dev database, writes nothing
//   pnpm db:lage --schreiben      writes the placements (one db.batch)
//   pnpm db:lage:prod [--schreiben]  the same against production (DATABASE_URL_PROD)
//
// Prints element names and dates only: no people, notes, to-dos or settings.
// `shift_days` stays untouched (the old version reads it until the merge).
// The override has to happen before the database module is loaded, so the
// database is only imported dynamically inside main() (as in src/db/seed.ts).

import type { BatchItem } from "drizzle-orm/batch";

const isProd = process.argv.includes("--prod");
const write = process.argv.includes("--schreiben");
if (isProd) {
  const prodUrl = process.env.DATABASE_URL_PROD;
  if (!prodUrl) {
    throw new Error("DATABASE_URL_PROD fehlt in .env.local.");
  }
  process.env.DATABASE_URL = prodUrl;
}

const COMMAND = isProd ? "pnpm db:lage:prod" : "pnpm db:lage";

function table(rows: string[][]): string {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()).join("\n");
}

async function main() {
  const { eq, sql } = await import("drizzle-orm");
  const { db } = await import("../src/db/index");
  const { editions, planChanges, planElements, planLinks } = await import("../src/db/schema");
  const { loadPlan } = await import("../src/db/plan");
  const { withoutOngoing } = await import("../src/lib/ak-workspace");
  const { formatGermanDate, todayInBerlin } = await import("../src/lib/dday");
  const { dateToDay, dayToDate } = await import("../src/lib/plan-days");
  const { PLACEMENT_NAMES } = await import("../src/lib/plan-edit");
  const { computePlan, toPlacement } = await import("../src/lib/plan-engine");
  const { legacyToPlacement } = await import("../src/lib/plan-legacy");

  console.log(`Datenbank: ${isProd ? "production" : "dev"}${write ? " · schreiben" : " · Vorschau"}`);
  const [edition] = await db.select().from(editions).where(eq(editions.isCurrent, true)).limit(1);
  if (!edition) {
    console.log("Keine aktuelle Ausgabe. Nichts zu übernehmen.");
    return;
  }
  const dDay = edition.dDay;
  const today = dateToDay(todayInBerlin(new Date()), dDay);
  const date = (day: number) => formatGermanDate(dayToDate(day, dDay));

  const [rows, linkRows] = await Promise.all([
    db
      .select({
        id: planElements.id,
        name: planElements.name,
        kind: planElements.kind,
        durationDays: planElements.durationDays,
        shiftDays: planElements.shiftDays,
        fixedDate: planElements.fixedDate,
        placement: planElements.placement,
        done: planElements.done,
        doneAt: planElements.doneAt,
        updatedAt: planElements.updatedAt,
        wobbly: planElements.wobbly,
        isOngoing: planElements.isOngoing,
        sortOrder: planElements.sortOrder,
      })
      .from(planElements)
      .where(eq(planElements.editionId, edition.id)),
    db
      .select({ fromId: planLinks.fromElementId, toId: planLinks.toElementId, lagDays: planLinks.lagDays })
      .from(planLinks)
      .where(eq(planLinks.editionId, edition.id)),
  ]);
  const plan = withoutOngoing(rows, linkRows);
  const byId = new Map(plan.elements.map((row) => [row.id, row]));

  const result = legacyToPlacement(
    plan.elements.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind === "task" ? "task" : "milestone",
      durationDays: row.durationDays,
      shiftDays: row.shiftDays,
      fixedDay: row.fixedDate === null ? null : dateToDay(row.fixedDate, dDay),
      done: row.done,
      doneDay: row.done ? dateToDay(todayInBerlin(row.doneAt ?? row.updatedAt), dDay) : null,
      wobbly: row.wobbly,
      sortOrder: row.sortOrder,
    })),
    plan.links,
    today
  );

  // Preview: open elements, then the done ones.
  const before = (id: string) => {
    const row = byId.get(id)!;
    if (row.fixedDate !== null) return `Fixtermin ${formatGermanDate(row.fixedDate)}`;
    if (row.shiftDays !== 0) return `verschoben ${row.shiftDays > 0 ? "+" : "−"}${Math.abs(row.shiftDays)} T`;
    return "–";
  };
  const open = result.elements.filter((element) => !element.done);
  console.log(`\nOffene Elemente (${open.length}):`);
  console.log(
    table([
      ["Name", "bisher", "neue Lage", "Termin vorher", "Termin nachher", "gleich?"],
      ...open.map((element) => [
        byId.get(element.id)!.name,
        before(element.id),
        PLACEMENT_NAMES[element.placement],
        date(element.oldStart),
        date(element.newStart),
        element.oldStart === element.newStart ? "ja" : "NEIN",
      ]),
    ])
  );
  if (result.doneMoved.length > 0) {
    console.log("\nErreicht – steht jetzt am Abhak-Tag:");
    console.log(
      table([
        ["Name", "Termin vorher", "Termin nachher"],
        ...result.doneMoved.map((element) => [byId.get(element.id)!.name, date(element.oldStart), date(element.newStart)]),
      ])
    );
  }
  const count = (placement: string) => result.elements.filter((element) => element.placement === placement).length;
  console.log(`\n${count("fixed")} fest, ${count("free")} frei, ${count("alap")} so spät`);

  // Only rows still on the default "alap" whose placement must change, and done rows without `done_at`.
  const toWrite = result.elements.filter(
    (element) => toPlacement(byId.get(element.id)!.placement) === "alap" && element.placement !== "alap"
  );
  const withoutDoneAt = plan.elements.filter((row) => row.done && row.doneAt === null);
  if (toWrite.length === 0 && withoutDoneAt.length === 0) {
    console.log("Nichts zu übernehmen.");
    return;
  }
  if (!write) {
    console.log(`Zu übernehmen: ${toWrite.length} Lagen, ${withoutDoneAt.length} Abhak-Tage aus „zuletzt geändert“.`);
    console.log(`Nichts geändert. Zum Schreiben: ${COMMAND} --schreiben`);
    return;
  }

  const queries: BatchItem<"pg">[] = [
    ...toWrite.map((element) =>
      db
        .update(planElements)
        .set({ placement: element.placement, fixedOffsetDays: null, freeStartDay: element.freeStartDay })
        .where(eq(planElements.id, element.id))
    ),
    ...withoutDoneAt.map((row) =>
      db.update(planElements).set({ doneAt: sql`${planElements.updatedAt}` }).where(eq(planElements.id, row.id))
    ),
  ];
  if (toWrite.length > 0) {
    queries.push(
      db.insert(planChanges).values(
        toWrite.map((element) => ({
          elementId: element.id,
          memberId: null,
          summary: `Lage übernommen: ${PLACEMENT_NAMES[element.placement]}`,
        }))
      )
    );
  }
  const [first, ...rest] = queries;
  await db.batch([first, ...rest]);
  console.log(`Geschrieben: ${toWrite.length} Lagen, ${withoutDoneAt.length} Abhak-Tage.`);

  // Check with the new engine: every open date as before.
  const loaded = await loadPlan(edition.id);
  const computed = computePlan(loaded.elements, loaded.links, today);
  const differing = open.filter((element) => computed.elements.get(element.id)?.plannedStart !== element.oldStart);
  if (differing.length === 0) {
    console.log("Alle offenen Termine unverändert ✓");
  } else {
    console.log("Abweichungen:");
    for (const element of differing) {
      const now = computed.elements.get(element.id)?.plannedStart;
      console.log(`- ${byId.get(element.id)!.name}: vorher ${date(element.oldStart)}, jetzt ${now === undefined ? "?" : date(now)}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unbekannter Fehler.");
  process.exit(1);
});
