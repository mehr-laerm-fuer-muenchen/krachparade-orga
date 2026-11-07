// Spec 022: publishes the triage on GitHub, deterministic (no agent).
//
//   GH_TOKEN=… pnpm exec tsx scripts/feedback-triage/publish.ts [--nur-schliessen] [--trocken] [--now <ISO>]
//
// --nur-schliessen  closes topics whose known entries are all done/rejected
//                   (comment + close), writes triage-out/geschlossen.json and
//                   removes them from triage-out/themen.json.
// (normal)          checks triage-out/ergebnis.json, drafts and sketches; then
//                   topics, drafts, sketches and last the daily issue.
// --trocken         writes nothing to GitHub; all texts go to triage-out/vorschau/.
//
// Texts always go to gh via --body-file. Before anything is written, every
// text is built once and checked for secret patterns (src/lib/feedback-triage/
// secrets.ts); a hit stops the run without publishing. Prints numbers only.

import { existsSync } from "node:fs";
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { formatGermanDate, todayInBerlin } from "../../src/lib/dday";
import { FEEDBACK_KINDS } from "../../src/lib/feedback/kinds";
import { FEEDBACK_STATUSES, statusLabel } from "../../src/lib/feedback/status";
import { parseMoment } from "../../src/lib/feedback-triage/cursor";
import { validateDraft, validateSketch } from "../../src/lib/feedback-triage/drafts";
import {
  extendTopicBody,
  renderDailyReport,
  renderTopicBody,
  renderTopicComment,
  type AssessedEntry,
  type DailyReport,
  type RenderEntry,
  type TopicLink,
} from "../../src/lib/feedback-triage/render";
import { validateResult, type TopicRef, type TriageResult } from "../../src/lib/feedback-triage/result";
import { maskSensitive, neutralizeMentions } from "../../src/lib/feedback-triage/sanitize";
import { findSecretPatterns } from "../../src/lib/feedback-triage/secrets";
import { PRIORITY_LABELS, highestPriority, topicsToClose, type Priority } from "../../src/lib/feedback-triage/topics";
import { OUT_DIR, fail, gh } from "./gh";

const MAX_DRAFTS = 3;
const MAX_SKETCHES = 2;
const CLOSED_KEEP = 20;

const LABELS: { name: string; color: string; description: string }[] = [
  { name: "feedback-triage", color: "c5def5", description: "Tages-Bericht der Feedback-Triage" },
  { name: "feedback-thema", color: "bfd4f2", description: "Thema aus dem App-Feedback (ein Issue je Thema)" },
  { name: "spec-entwurf", color: "d4c5f9", description: "Spec-Entwurf aus der Triage, ohne Nummer, startet keinen Agenten" },
  { name: "skizze", color: "fef2c0", description: "Thema hat eine Spec-Skizze" },
  { name: "p1", color: "b60205", description: "P1: kaputt oder blockiert" },
  { name: "p2", color: "d93f0b", description: "P2: stört regelmäßig oder betrifft viele" },
  { name: "p3", color: "fbca04", description: "P3: Komfort oder Wunsch" },
];

// ---------- arguments ----------

const args = process.argv.slice(2);
const dryRun = args.includes("--trocken");
const closeOnly = args.includes("--nur-schliessen");
const nowIndex = args.indexOf("--now");
const nowArg = nowIndex >= 0 ? args[nowIndex + 1] : undefined;
const now = nowArg ? parseMoment(nowArg) : new Date();

// ---------- files ----------

const entrySchema = z.object({
  id: z.uuid(),
  shortId: z.string(),
  link: z.string(),
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string(),
  status: z.enum(FEEDBACK_STATUSES),
  createdAt: z.string(),
});
const inputSchema = z.object({
  cursor: z.string().nullable(),
  newCursor: z.string().nullable(),
  fresh: z.array(entrySchema),
  stale: z.array(entrySchema),
  restCount: z.number().int().min(0),
  shouldReport: z.boolean(),
  statusById: z.record(z.string(), z.enum(FEEDBACK_STATUSES)),
});
const topicsSchema = z.object({
  offen: z.array(
    z.object({
      number: z.number().int(),
      title: z.string(),
      labels: z.array(z.string()),
      ids: z.array(z.string()),
      body: z.string().default(""),
    })
  ),
  geschlossen: z.array(z.object({ number: z.number().int(), title: z.string() })),
});
const closedSchema = z.array(z.object({ number: z.number().int(), title: z.string() }));

type Topics = z.infer<typeof topicsSchema>;
type Entry = z.infer<typeof entrySchema>;

const path = (name: string) => join(OUT_DIR, name);

async function readJson<T>(name: string, schema: z.ZodType<T>): Promise<T> {
  if (!existsSync(path(name))) throw new PublishError([`${OUT_DIR}/${name} fehlt`]);
  let data: unknown;
  try {
    data = JSON.parse(await readFile(path(name), "utf8"));
  } catch {
    throw new PublishError([`${OUT_DIR}/${name} ist kein gültiges JSON`]);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new PublishError([`${OUT_DIR}/${name} hat nicht die erwartete Form`]);
  return parsed.data;
}

class PublishError extends Error {
  constructor(readonly reasons: string[]) {
    super(reasons.join("; "));
    this.name = "PublishError";
  }
}

let bodyDir: string | null = null;
let bodyCount = 0;

/** Writes a text to a temporary file for `--body-file`. */
async function bodyFile(text: string): Promise<string> {
  bodyDir ??= await mkdtemp(join(tmpdir(), "triage-"));
  bodyCount += 1;
  const file = join(bodyDir, `body-${bodyCount}.md`);
  await writeFile(file, text);
  return file;
}

async function preview(name: string, text: string): Promise<void> {
  await mkdir(path("vorschau"), { recursive: true });
  await writeFile(path(`vorschau/${name}`), text);
}

async function summary(lines: string[]): Promise<void> {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) await appendFile(file, lines.join("\n") + "\n");
}

function issueNumber(url: string): number {
  const match = /\/issues\/(\d+)\s*$/.exec(url.trim());
  if (!match) throw new PublishError(["gh issue create: keine Issue-Nummer erhalten"]);
  return Number(match[1]);
}

/** Text from the agent that is not rendered (drafts, sketches, titles). */
function clean(text: string): string {
  return neutralizeMentions(maskSensitive(text.replace(/\r\n?/g, "\n")));
}

function cleanTitle(text: string): string {
  return clean(text).replace(/\s+/g, " ").trim();
}

function germanDay(moment: Date): string {
  return formatGermanDate(todayInBerlin(moment));
}

function toRenderEntry(entry: Entry): RenderEntry {
  return { id: entry.id, shortId: entry.shortId, link: entry.link, kind: entry.kind, message: entry.message };
}

// ---------- output: every text passes the secret check ----------

/**
 * "check": only builds and checks the texts, no effect at all (first pass).
 * "write": checks each text again, then writes to GitHub or, with --trocken,
 * to triage-out/vorschau/.
 */
type Pass = "check" | "write";
let pass: Pass = "check";

function checkSecrets(where: string, ...texts: string[]): void {
  const hits = [...new Set(texts.flatMap(findSecretPatterns))];
  if (hits.length > 0) {
    throw new PublishError([`Geheimnis-Muster (${hits.join(", ")}) in ${where} – nichts veröffentlicht`]);
  }
}

/** New issue; returns its number, or null in the check pass and with --trocken. */
async function newIssue(where: string, previewName: string, title: string, body: string, labels: string[]): Promise<number | null> {
  checkSecrets(where, title, body);
  if (pass === "check") return null;
  if (dryRun) {
    await preview(previewName, `# ${title}\n\nLabels: ${labels.join(", ") || "–"}\n\n---\n\n${body}`);
    return null;
  }
  const labelArgs = labels.flatMap((label) => ["--label", label]);
  const url = await gh(["issue", "create", "--title", title, "--body-file", await bodyFile(body), ...labelArgs]);
  return issueNumber(url);
}

async function newComment(where: string, previewName: string, number: number | null, body: string): Promise<void> {
  checkSecrets(where, body);
  if (pass === "check") return;
  if (dryRun) return preview(previewName, `# Kommentar in ${number === null ? "(neues Thema)" : `#${number}`}\n\n---\n\n${body}`);
  if (number !== null) await gh(["issue", "comment", String(number), "--body-file", await bodyFile(body)]);
}

async function newBody(where: string, previewName: string, number: number, title: string, body: string, labelNote: string): Promise<void> {
  checkSecrets(where, body);
  if (pass === "check") return;
  if (dryRun) return preview(previewName, `# #${number} ${title}\n\nLabels: ${labelNote}\n\n---\n\n${body}`);
  await gh(["issue", "edit", String(number), "--body-file", await bodyFile(body)]);
}

/** Labels carry no free text: no check needed, nothing in the check pass or dry run. */
async function editLabels(number: number | null, add: string[], remove: string[]): Promise<void> {
  if (pass === "check" || dryRun || number === null || (add.length === 0 && remove.length === 0)) return;
  await gh([
    "issue", "edit", String(number),
    ...add.flatMap((label) => ["--add-label", label]),
    ...remove.flatMap((label) => ["--remove-label", label]),
  ]);
}

async function ensureLabels(): Promise<void> {
  const existing = JSON.parse(await gh(["label", "list", "--limit", "500", "--json", "name"])) as { name: string }[];
  const names = new Set(existing.map((label) => label.name));
  for (const label of LABELS) {
    if (names.has(label.name)) continue;
    await gh(["label", "create", label.name, "--color", label.color, "--description", label.description]);
  }
}

// ---------- mode: close ----------

async function closeTopics(): Promise<void> {
  const input = await readJson("input.json", inputSchema);
  const topics = await readJson("themen.json", topicsSchema);
  const toClose = topicsToClose(topics.offen, input.statusById).map((topic) => {
    const known = topic.ids.filter((id) => Object.hasOwn(input.statusById, id));
    const text = [
      "Alle zugehörigen Meldungen sind in der App erledigt oder verworfen – Thema geschlossen.",
      "",
      ...known.map((id) => `- \`${id.slice(0, 8)}\` ${statusLabel(input.statusById[id])}`),
    ].join("\n");
    return { ...topic, text: text + "\n" };
  });

  // Check all texts first, then write.
  for (const topic of toClose) checkSecrets(`Schließ-Kommentar #${topic.number}`, topic.text);
  pass = "write";
  for (const topic of toClose) {
    await newComment(`Schließ-Kommentar #${topic.number}`, `schliessen-${topic.number}.md`, topic.number, topic.text);
    if (!dryRun) await gh(["issue", "close", String(topic.number), "--reason", "completed"]);
  }

  const closed = toClose.map((topic) => ({ number: topic.number, title: topic.title }));
  await writeFile(path("geschlossen.json"), JSON.stringify(closed, null, 2) + "\n");
  const closedNumbers = new Set(closed.map((topic) => topic.number));
  const updated: Topics = {
    offen: topics.offen.filter((topic) => !closedNumbers.has(topic.number)),
    geschlossen: [...closed, ...topics.geschlossen].slice(0, CLOSED_KEEP),
  };
  await writeFile(path("themen.json"), JSON.stringify(updated, null, 2) + "\n");

  console.log(`${dryRun ? "(trocken) würden geschlossen" : "geschlossen"}: ${closed.length} Themen`);
}

// ---------- mode: publish ----------

type Rejected = DailyReport["rejected"][number];

async function readAgentFile(datei: string): Promise<string | null> {
  const file = path(datei);
  return existsSync(file) ? readFile(file, "utf8") : null;
}

async function prepare() {
  if (existsSync(path("AGENT_STOPP.md"))) throw new PublishError(["Der Agent hat gestoppt (triage-out/AGENT_STOPP.md)"]);
  const input = await readJson("input.json", inputSchema);
  const topics = await readJson("themen.json", topicsSchema);
  const closedToday = existsSync(path("geschlossen.json")) ? await readJson("geschlossen.json", closedSchema) : [];

  let raw: unknown;
  if (!existsSync(path("ergebnis.json"))) throw new PublishError([`${OUT_DIR}/ergebnis.json fehlt`]);
  try {
    raw = JSON.parse(await readFile(path("ergebnis.json"), "utf8"));
  } catch {
    throw new PublishError([`${OUT_DIR}/ergebnis.json ist kein gültiges JSON`]);
  }

  // 1. Check the result. Errors: nothing gets published.
  const checked = validateResult(raw, input, topics);
  if (!checked.result) throw new PublishError(checked.errors);
  const result: TriageResult = checked.result;

  // 2. Check drafts and sketches; invalid ones go into the report.
  const rejected: Rejected[] = [];
  const drafts: { kurzname: string; thema: TopicRef; body: string }[] = [];
  result.entwuerfe.forEach((draft, index) => {
    if (index >= MAX_DRAFTS) rejected.push({ art: "Entwurf", name: draft.kurzname, grund: [`mehr als ${MAX_DRAFTS} Entwürfe`] });
  });
  for (const draft of result.entwuerfe.slice(0, MAX_DRAFTS)) {
    const content = await readAgentFile(draft.datei);
    if (content === null) {
      rejected.push({ art: "Entwurf", name: draft.kurzname, grund: [`Datei ${draft.datei} fehlt`] });
      continue;
    }
    const errors = validateDraft({ title: `Entwurf: ${draft.kurzname}`, body: content });
    if (errors.length > 0) rejected.push({ art: "Entwurf", name: draft.kurzname, grund: errors });
    else drafts.push({ kurzname: draft.kurzname, thema: draft.thema, body: clean(content).trimEnd() });
  }
  const sketches: { thema: TopicRef; datei: string; body: string }[] = [];
  result.skizzen.forEach((sketch, index) => {
    if (index >= MAX_SKETCHES) rejected.push({ art: "Skizze", name: sketch.datei, grund: [`mehr als ${MAX_SKETCHES} Skizzen`] });
  });
  for (const sketch of result.skizzen.slice(0, MAX_SKETCHES)) {
    const content = await readAgentFile(sketch.datei);
    if (content === null) {
      rejected.push({ art: "Skizze", name: sketch.datei, grund: [`Datei ${sketch.datei} fehlt`] });
      continue;
    }
    const errors = validateSketch(content);
    if (errors.length > 0) rejected.push({ art: "Skizze", name: sketch.datei, grund: errors });
    else sketches.push({ thema: sketch.thema, datei: sketch.datei, body: clean(content).trimEnd() });
  }

  return { input, topics, closedToday, result, rejected, drafts, sketches };
}

type Prepared = Awaited<ReturnType<typeof prepare>>;

/** Steps 4–8. Runs twice: pass "check" (texts only) and pass "write". */
async function emit({ input, topics, closedToday, result, rejected, drafts, sketches }: Prepared): Promise<void> {
  const freshByShort = new Map(input.fresh.map((entry) => [entry.shortId, entry]));
  const allByShort = new Map([...input.stale, ...input.fresh].map((entry) => [entry.shortId, entry]));
  const assessed = (shortIds: string[]): AssessedEntry[] =>
    result.meldungen
      .filter((assessment) => shortIds.includes(assessment.shortId))
      .map((assessment) => ({ entry: toRenderEntry(freshByShort.get(assessment.shortId)!), assessment }));
  const today = germanDay(now!);
  const notes: string[] = [];

  // 4. New topics.
  const newNumbers = new Map<string, number | null>();
  const newTopicLinks: TopicLink[] = [];
  for (const topic of result.neueThemen) {
    const members = result.meldungen.filter((a) => a.thema && "neu" in a.thema && a.thema.neu === topic.schluessel);
    const entries = assessed(members.map((a) => a.shortId));
    const priority = highestPriority([], members.map((a) => a.prioritaet as Priority));
    const title = `Thema: ${cleanTitle(topic.titel)}`;
    const body = renderTopicBody(topic, entries);
    const labels = ["feedback-thema", ...(priority ? [priority] : [])];
    const number = await newIssue(`neues Thema ${topic.schluessel}`, `thema-neu-${topic.schluessel}.md`, title, body, labels);
    newNumbers.set(topic.schluessel, number);
    newTopicLinks.push(number === null ? { number: 0, title: `${title} (trocken, noch ohne Nummer)` } : { number, title });
  }
  const topicNumber = (ref: TopicRef): number | null => ("issue" in ref ? ref.issue : (newNumbers.get(ref.neu) ?? null));

  // 5. Existing topics: comment, extended body, strongest priority label.
  const updatedLinks: TopicLink[] = [];
  for (const topic of topics.offen) {
    const members = result.meldungen.filter((a) => a.thema && "issue" in a.thema && a.thema.issue === topic.number);
    if (members.length === 0) continue;
    const entries = assessed(members.map((a) => a.shortId));
    const fresh = entries.filter((m) => !topic.ids.includes(m.entry.id));
    if (fresh.length < entries.length) {
      const known = entries.filter((m) => topic.ids.includes(m.entry.id)).map((m) => m.entry.shortId);
      notes.push(`Thema #${topic.number}: ${known.join(", ")} schon in der Marke, kein neuer Kommentar dazu.`);
    }
    if (fresh.length === 0) continue;

    const text = renderTopicComment(fresh, now!);
    const body = extendTopicBody(topic.body, fresh);
    const current = topic.labels.filter((label) => (PRIORITY_LABELS as readonly string[]).includes(label));
    const target = highestPriority(topic.labels, fresh.map((m) => m.assessment.prioritaet));
    const remove = current.filter((label) => label !== target);
    const add = target && !current.includes(target) ? [target] : [];
    await newComment(`Kommentar in #${topic.number}`, `thema-${topic.number}-kommentar.md`, topic.number, text);
    await newBody(
      `Text von #${topic.number}`,
      `thema-${topic.number}-text.md`,
      topic.number,
      topic.title,
      body,
      `+${add.join(",") || "–"} −${remove.join(",") || "–"}`
    );
    await editLabels(topic.number, add, remove);
    updatedLinks.push({ number: topic.number, title: topic.title });
  }

  // 6. Drafts.
  const draftLinks: DailyReport["drafts"] = [];
  for (const draft of drafts) {
    const themaNumber = topicNumber(draft.thema);
    const title = `Entwurf: ${draft.kurzname}`;
    const body = `${draft.body}\n\nThema: ${themaNumber === null ? "neu" : `#${themaNumber}`}\n`;
    const number = await newIssue(`Entwurf ${draft.kurzname}`, `entwurf-${draft.kurzname}.md`, title, body, ["spec-entwurf"]);
    if (number !== null && themaNumber !== null) {
      await newComment(`Verweis in #${themaNumber}`, "", themaNumber, `Spec-Entwurf: #${number}\n`);
    }
    draftLinks.push({ number, kurzname: draft.kurzname, topicNumber: themaNumber });
  }

  // 7. Sketches.
  const sketchLinks: DailyReport["sketches"] = [];
  const titleOf = (ref: TopicRef): string =>
    "issue" in ref
      ? (topics.offen.find((topic) => topic.number === ref.issue)?.title ?? "")
      : `Thema: ${cleanTitle(result.neueThemen.find((topic) => topic.schluessel === ref.neu)?.titel ?? ref.neu)}`;
  for (const sketch of sketches) {
    const themaNumber = topicNumber(sketch.thema);
    const text = `### Spec-Skizze (${today})\n\n${sketch.body}\n`;
    const name = "issue" in sketch.thema ? String(sketch.thema.issue) : sketch.thema.neu;
    await newComment(`Skizze ${name}`, `skizze-${name}.md`, themaNumber, text);
    await editLabels(themaNumber, ["skizze"], []);
    sketchLinks.push({ topicNumber: themaNumber, title: titleOf(sketch.thema) });
  }

  // 8. Daily issue, last: without it the old cursor stays and the next run repeats.
  const report: DailyReport = {
    now: now!,
    cursor: parseMoment(input.cursor),
    newCursor: parseMoment(input.newCursor),
    entries: result.meldungen.map((assessment) => ({
      entry: toRenderEntry(freshByShort.get(assessment.shortId)!),
      assessment,
      // Rejected entries have no topic (shown as „–“).
      topicNumber: assessment.thema ? topicNumber(assessment.thema) : null,
    })),
    restCount: input.restCount,
    stale: input.stale.map((entry) => ({
      entry: toRenderEntry(entry),
      createdAt: new Date(entry.createdAt),
      vorschlag: result.liegengeblieben.find((s) => s.shortId === entry.shortId)?.vorschlag ?? null,
    })),
    newTopics: newTopicLinks,
    updatedTopics: updatedLinks,
    closedTopics: closedToday,
    drafts: draftLinks,
    sketches: sketchLinks,
    rejected,
    questions: result.fragenAnFranz.map((q) => {
      const entry = q.shortId ? allByShort.get(q.shortId) : undefined;
      return { text: q.text, entry: entry ? toRenderEntry(entry) : undefined };
    }),
    notes,
  };
  const title = `Feedback-Triage ${today}`;
  const body = renderDailyReport(report);
  const dailyNumber = await newIssue("Tages-Issue", "tages-issue.md", title, body, ["feedback-triage"]);

  if (pass === "check") return;
  console.log(
    [
      dryRun ? "(trocken)" : "",
      `${newTopicLinks.length} neue Themen`,
      `${updatedLinks.length} Themen ergänzt`,
      `${draftLinks.length} Entwürfe`,
      `${sketchLinks.length} Skizzen`,
      `${rejected.length} nicht veröffentlicht`,
      dailyNumber === null ? "Tages-Issue: Vorschau" : `Tages-Issue #${dailyNumber}`,
    ]
      .filter(Boolean)
      .join(", ")
  );
}

// ---------- main ----------

async function main() {
  if (!now) fail("--now ist kein Zeitpunkt (z. B. 2026-11-06T05:45:00.000Z).");
  if (!dryRun && !process.env.GH_TOKEN) fail("GH_TOKEN fehlt.");
  if (closeOnly) return closeTopics();
  const prepared = await prepare();
  // Pass 1 builds and checks every text without any effect; pass 2 writes.
  pass = "check";
  await emit(prepared);
  pass = "write";
  if (!dryRun) await ensureLabels();
  await emit(prepared);
}

main().catch(async (error: unknown) => {
  const reasons =
    error instanceof PublishError
      ? error.reasons
      : [error instanceof Error && error.name === "GhError" ? error.message : "Unerwarteter Fehler."];
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path("fehler.txt"), reasons.join("\n") + "\n");
  await summary([
    `### ❌ Feedback-Triage: ${closeOnly ? "Schließen" : "Veröffentlichen"} fehlgeschlagen`,
    "",
    ...reasons.slice(0, 50).map((reason) => `- ${reason.replace(/[<>]/g, "")}`),
    "",
    "Nichts weiter veröffentlicht. Details im Artefakt (fehler.txt).",
  ]).catch(() => undefined);
  fail(reasons.length === 1 ? reasons[0] : `${reasons.length} Fehler, siehe ${OUT_DIR}/fehler.txt`);
});
