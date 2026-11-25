/**
 * Schema push for GitHub Actions (workflows db-vorschau.yml, db-production.yml).
 *
 * Like `drizzle-kit push`, but without prompts and only additive: new tables,
 * columns and indexes are applied; anything that drops, renames, truncates,
 * deletes or changes a type aborts the run without touching the database.
 *
 *   tsx scripts/db-push-ci.ts --check   show planned statements, change nothing
 *   tsx scripts/db-push-ci.ts --apply   apply them (after the same guard)
 *
 * The target comes from PUSH_DATABASE_URL (never logged). Writes
 * `changes=true|false` to GITHUB_OUTPUT and a summary to GITHUB_STEP_SUMMARY.
 *
 * drizzle-kit 0.31 re-creates expression indexes (`lower(...)`) and re-sets
 * some defaults on every push although nothing changed. Such statements are
 * compared with the database and skipped when they would change nothing.
 *
 * If a column disappears and another appears in the same table, drizzle-kit
 * asks whether it is a rename. Without a terminal it fails instead; nothing
 * is applied. Such changes are done by hand.
 *
 * pushSchema needs patches/drizzle-kit@0.31.11.patch (query parameters).
 */
import { appendFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { pushSchema } from "drizzle-kit/api";
import * as schema from "../src/db/schema";

type Db = ReturnType<typeof drizzle>;

const FORBIDDEN = [
  /\bDROP\b/i,
  /\bRENAME\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\b/i,
  /\bALTER\s+COLUMN\b[^;]*\b(TYPE|SET\s+NOT\s+NULL)\b/i,
];

const DROP_INDEX = /^DROP INDEX "([^"]+)";?$/i;
const CREATE_INDEX = /^CREATE (?:UNIQUE )?INDEX (?:IF NOT EXISTS )?"([^"]+)"/i;
const SET_DEFAULT = /^ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" SET DEFAULT (.+?);?$/i;
const DROP_CONSTRAINT = /^ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)";?$/i;
const ADD_CONSTRAINT = /^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" (.+?);?$/i;

/**
 * Same constraint? A primary key or unique constraint over the same set of
 * columns protects the same data, whatever the column order.
 */
function sameConstraint(current: string, wanted: string): boolean {
  const a = normalize(current);
  const b = normalize(wanted);
  if (a === b) return true;
  const keyColumns = /^(primarykey|unique)\(([^()]+)\)$/;
  const ma = keyColumns.exec(a);
  const mb = keyColumns.exec(b);
  if (!ma || !mb || ma[1] !== mb[1]) return false;
  const set = (list: string) => list.split(",").sort().join(",");
  return set(ma[2]) === set(mb[2]);
}

/** Current definition of a constraint, e.g. `PRIMARY KEY (a, b)`, or null. */
async function constraintDef(db: Db, table: string, name: string): Promise<string | null> {
  const [row] = await rows<{ def: string }>(
    db,
    sql`select pg_get_constraintdef(c.oid) as def
        from pg_constraint c
        join pg_class t on t.oid = c.conrelid
        join pg_namespace n on n.oid = t.relnamespace
        where n.nspname = 'public' and t.relname = ${table} and c.conname = ${name}`,
  );
  return row?.def ?? null;
}

/** Compare SQL as Postgres prints it and as drizzle writes it. */
function normalize(text: string): string {
  return text
    .replace(/"/g, "")
    .replace(/\bpublic\./gi, "")
    .replace(/;\s*$/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

async function rows<T>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

/** Drop statements that would leave the database exactly as it is. */
async function withoutNoOps(db: Db, statements: string[], notes: string[]): Promise<string[]> {
  const skip = new Set<string>();

  for (const drop of statements) {
    const name = DROP_INDEX.exec(drop.trim())?.[1];
    if (!name) continue;
    const create = statements.find((s) => CREATE_INDEX.exec(s.trim())?.[1] === name);
    if (!create) continue;
    const [current] = await rows<{ indexdef: string }>(
      db,
      sql`select indexdef from pg_indexes where schemaname = 'public' and indexname = ${name}`,
    );
    if (current && normalize(current.indexdef) === normalize(create)) {
      skip.add(drop);
      skip.add(create);
    }
  }

  for (const statement of statements) {
    const match = SET_DEFAULT.exec(statement.trim());
    if (!match) continue;
    const [, table, column, value] = match;
    const [current] = await rows<{ column_default: string | null }>(
      db,
      sql`select column_default from information_schema.columns
          where table_schema = 'public' and table_name = ${table} and column_name = ${column}`,
    );
    if (current?.column_default && normalize(current.column_default) === normalize(value)) {
      skip.add(statement);
    }
  }

  // drizzle-kit drops and re-adds composite primary keys on every push.
  for (const drop of statements) {
    const match = DROP_CONSTRAINT.exec(drop.trim());
    if (!match) continue;
    const [, table, name] = match;
    const add = statements.find((s) => {
      const m = ADD_CONSTRAINT.exec(s.trim());
      return m?.[1] === table && m?.[2] === name;
    });
    const wanted = add ? ADD_CONSTRAINT.exec(add.trim())?.[3] : undefined;
    const current = await constraintDef(db, table, name);
    if (add && wanted && current && sameConstraint(current, wanted)) {
      skip.add(drop);
      skip.add(add);
    } else if (current) {
      notes.push(`Aktuell in der Datenbank: \`${table}.${name}\` = \`${current}\``);
    }
  }

  return statements.filter((s) => !skip.has(s));
}

function writeFile(name: string | undefined, text: string) {
  if (name) appendFileSync(name, text);
}

async function main() {
  const mode = process.argv[2];
  if (mode !== "--check" && mode !== "--apply") {
    throw new Error("Aufruf: tsx scripts/db-push-ci.ts --check | --apply");
  }
  const url = process.env.PUSH_DATABASE_URL;
  if (!url) throw new Error("PUSH_DATABASE_URL fehlt.");
  const label = process.env.PUSH_LABEL ?? "Datenbank";

  const db = drizzle(neon(url));
  const result = await pushSchema(schema, db as never);
  const notes: string[] = [];
  const statements = await withoutNoOps(db, result.statementsToExecute, notes);
  const blocked = statements.filter((s) => FORBIDDEN.some((p) => p.test(s)));
  const refuse = result.hasDataLoss || blocked.length > 0;

  const list = statements.length
    ? statements.map((s) => "```sql\n" + s + "\n```").join("\n")
    : "Keine Änderungen nötig, das Schema ist aktuell.";
  let summary = `### Schema-Abgleich: ${label}\n\n${list}\n`;
  if (notes.length) {
    summary += `\n${notes.map((n) => `- ${n}`).join("\n")}\n`;
  }
  if (result.warnings.length) {
    summary += `\n**Warnungen:**\n${result.warnings.map((w) => `- ${w}`).join("\n")}\n`;
  }
  if (refuse) {
    summary +=
      "\n**Abgebrochen:** Die Änderung würde Daten löschen, umbenennen oder Typen ändern. " +
      "Nichts wurde ausgeführt. Bitte von Hand klären (Backup-Zweig in Neon, dann `pnpm db:push`).\n";
  } else if (mode === "--apply" && statements.length) {
    summary += "\n**Ausgeführt.**\n";
  }

  console.log(summary);
  writeFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  writeFile(process.env.GITHUB_OUTPUT, `changes=${statements.length > 0}\n`);

  if (refuse) {
    process.exitCode = 1;
    return;
  }
  if (mode === "--apply") {
    for (const statement of statements) {
      await db.execute(sql.raw(statement));
    }
  }
}

// exitCode instead of process.exit(): exit() can cut off piped output.
main().catch((error: unknown) => {
  // Only the message: the error object may carry the connection string.
  console.error(error instanceof Error ? error.message : "Unbekannter Fehler");
  process.exitCode = 1;
});
