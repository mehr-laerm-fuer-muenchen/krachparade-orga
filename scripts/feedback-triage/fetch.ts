// Spec 022: reads the feedback for the triage, read-only, and writes
// `triage-out/input.json`.
//
//   pnpm exec tsx --env-file=.env.local scripts/feedback-triage/fetch.ts [--cursor <ISO>] [--now <ISO>]
//
// - Reads only FEEDBACK_TRIAGE_DATABASE_URL (role `triage_reader`), never
//   DATABASE_URL or DATABASE_URL_PROD.
// - Exactly one query, only SELECT, only the view `feedback_triage`.
// - Prints numbers only: no feedback texts, no connection details.
// - `--cursor ""` (empty or only whitespace) counts as no cursor (first run).

import { mkdir, writeFile } from "node:fs/promises";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { FEEDBACK_KINDS } from "../../src/lib/feedback/kinds";
import { FEEDBACK_STATUSES } from "../../src/lib/feedback/status";
import { cursorFromArgument, parseMoment } from "../../src/lib/feedback-triage/cursor";
import { selectForTriage, shortId, shouldReport, type TriageRow } from "../../src/lib/feedback-triage/select";

const OUT_DIR = "triage-out";
const OUT_FILE = `${OUT_DIR}/input.json`;
const LINK_BASE = "https://krachparade-orga.vercel.app/feedback/";

function fail(message: string): never {
  console.error(`Abbruch: ${message}`);
  process.exit(1);
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  return value === undefined || value.startsWith("--") ? "" : value;
}

const moment = z.union([z.date(), z.string()]).transform((value, ctx) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: "custom", message: "kein Zeitpunkt" });
    return z.NEVER;
  }
  return date;
});

const rowSchema = z.object({
  id: z.uuid(),
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string(),
  page_path: z.string(),
  page_title: z.string().nullable(),
  context: z.string().nullable(),
  device: z.string().nullable(),
  viewport: z.string().nullable(),
  status: z.enum(FEEDBACK_STATUSES),
  reply: z.string().nullable(),
  created_at: moment,
  updated_at: moment,
});

function toRow(raw: z.infer<typeof rowSchema>): TriageRow {
  return {
    id: raw.id,
    kind: raw.kind,
    message: raw.message,
    pagePath: raw.page_path,
    pageTitle: raw.page_title,
    context: raw.context,
    device: raw.device,
    viewport: raw.viewport,
    status: raw.status,
    reply: raw.reply,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function forOutput(row: TriageRow) {
  return {
    id: row.id,
    shortId: shortId(row.id),
    link: `${LINK_BASE}${row.id}`,
    kind: row.kind,
    message: row.message,
    pagePath: row.pagePath,
    pageTitle: row.pageTitle,
    context: row.context,
    device: row.device,
    viewport: row.viewport,
    status: row.status,
    reply: row.reply,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function main() {
  const url = process.env.FEEDBACK_TRIAGE_DATABASE_URL;
  if (!url) fail("FEEDBACK_TRIAGE_DATABASE_URL fehlt.");

  const cursorArg = cursorFromArgument(argument("--cursor"));
  if (cursorArg === "invalid") fail("--cursor ist kein Zeitpunkt (z. B. 2026-11-06T05:45:00.000Z).");
  const cursor = cursorArg;

  const nowArg = argument("--now");
  const now = nowArg ? parseMoment(nowArg) : new Date();
  if (!now) fail("--now ist kein Zeitpunkt (z. B. 2026-11-06T05:45:00.000Z).");

  let raw: unknown[];
  try {
    const sql = neon(url);
    raw = await sql`
      SELECT id, kind, message, page_path, page_title, context, device, viewport,
             status, reply, created_at, updated_at
      FROM feedback_triage`;
  } catch {
    // The error text could contain parts of the connection: never print it.
    fail("Abfrage der Sicht feedback_triage fehlgeschlagen (Adresse, Rolle oder Sicht prüfen).");
  }

  const rows: TriageRow[] = [];
  let invalid = 0;
  for (const item of raw) {
    const parsed = rowSchema.safeParse(item);
    if (parsed.success) rows.push(toRow(parsed.data));
    else invalid += 1;
  }
  if (invalid > 0) fail(`${invalid} Zeilen passen nicht zur erwarteten Form der Sicht.`);

  const selection = selectForTriage(rows, cursor, now);
  const report = shouldReport(selection, now);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(
    OUT_FILE,
    JSON.stringify(
      {
        cursor: cursor ? cursor.toISOString() : null,
        newCursor: selection.newCursor ? selection.newCursor.toISOString() : null,
        fresh: selection.fresh.map(forOutput),
        stale: selection.stale.map(forOutput),
        restCount: selection.restCount,
        shouldReport: report,
        statusById: selection.statusById,
      },
      null,
      2
    ) + "\n"
  );

  const rest = selection.restCount > 0 ? `, ${selection.restCount} im nächsten Lauf` : "";
  console.log(
    `${selection.fresh.length} neue, ${selection.stale.length} liegengeblieben, ${rows.length} im Bestand${rest}, Bericht: ${report ? "ja" : "nein"}`
  );
}

// Only the error type, never its text (see above).
main().catch((error: unknown) => fail(`Unerwarteter Fehler (${error instanceof Error ? error.name : "unbekannt"}).`));
