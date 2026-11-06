// Spec 022: all texts for GitHub are built here from checked data. Every
// feedback text and every agent text goes through `sanitize`.

import { formatGermanDate, todayInBerlin } from "../dday";
import { formatGermanDateTime } from "../date-time";
import { kindLabel, type FeedbackKind } from "../feedback/kinds";
import { statusLabel } from "../feedback/status";
import { writeCursor } from "./cursor";
import type { Assessment } from "./result";
import { quote, sanitize } from "./sanitize";
import { readTopicMarker, writeTopicMarker } from "./topics";

export const REPORT_MAX = 60_000;
export const TOPIC_QUOTE_MAX = 300;
export const COMMENT_QUOTE_MAX = 1000;
export const REPLY_QUOTE_MAX = 400;

/** One feedback entry as far as the texts need it. */
export type RenderEntry = {
  id: string;
  shortId: string;
  link: string;
  kind: FeedbackKind;
  message: string;
};

export type AssessedEntry = { entry: RenderEntry; assessment: Assessment };

const CATEGORY_LABELS: Record<Assessment["kategorie"], string> = {
  fehler: "Fehler",
  bedienproblem: "Bedienproblem",
  wunsch: "Wunsch",
  missverstaendnis: "Missverständnis",
  doppelt: "Doppelt",
  schon_erledigt: "Schon erledigt",
};
const PROPOSAL_LABELS: Record<Assessment["vorschlag"], string> = {
  entwurf: "Spec-Entwurf",
  skizze: "Spec-Skizze",
  spec_thema: "Spec-Thema",
  backlog: "Backlog",
  anleitung: "Anleitung",
  nur_antwort: "Nur Antwort",
  verwerfen: "Verwerfen",
};
const EFFORT_LABELS: Record<Assessment["aufwand"], string> = { klein: "klein", mittel: "mittel", gross: "groß" };
const PRIORITY_ORDER: Record<Assessment["prioritaet"], number> = { p1: 0, p2: 1, p3: 2, keine: 3 };

function priorityLabel(priority: Assessment["prioritaet"]): string {
  return priority === "keine" ? "–" : priority.toUpperCase();
}

function germanDay(moment: Date): string {
  return formatGermanDate(todayInBerlin(moment));
}

function entryLink(entry: RenderEntry): string {
  return `[\`${entry.shortId}\`](${entry.link})`;
}

/** Indents every line of a block (for content inside a list item). */
function indent(block: string, spaces = 2): string {
  const pad = " ".repeat(spaces);
  return block
    .split("\n")
    .map((line) => (line === "" ? "" : pad + line))
    .join("\n");
}

// ---------- topics ----------

/** One entry of the list in a topic body. */
export function renderTopicEntry({ entry, assessment }: AssessedEntry): string {
  return [
    `- ${entryLink(entry)} · ${kindLabel(entry.kind)} · ${priorityLabel(assessment.prioritaet)}`,
    indent(quote(sanitize(entry.message), TOPIC_QUOTE_MAX)),
    "",
    indent(`Deutung: ${sanitize(assessment.deutung)}`),
  ].join("\n");
}

const LIST_HEADING = "## Meldungen";

export function renderTopicBody(
  topic: { zusammenfassung: string; verweisAuf?: number },
  meldungen: AssessedEntry[]
): string {
  const parts: string[] = [];
  if (topic.verweisAuf !== undefined) parts.push(`Folgt auf #${topic.verweisAuf}`);
  parts.push(sanitize(topic.zusammenfassung));
  parts.push(LIST_HEADING);
  parts.push(meldungen.map(renderTopicEntry).join("\n\n"));
  parts.push(writeTopicMarker(meldungen.map((m) => m.entry.id)));
  return parts.join("\n\n") + "\n";
}

/**
 * The body of an existing topic with new entries added: new list entries go
 * before the marker, the marker holds old and new ids. Entries already in the
 * marker are not added twice.
 */
export function extendTopicBody(oldBody: string, meldungen: AssessedEntry[]): string {
  const oldIds = readTopicMarker(oldBody);
  const added = meldungen.filter((m) => !oldIds.includes(m.entry.id));
  const marker = writeTopicMarker([...oldIds, ...added.map((m) => m.entry.id)]);
  const withoutMarker = oldBody.replace(/\r\n?/g, "\n").replace(/<!--\s*meldungen:[^>]*?-->\s*$/, "").trimEnd();
  const list = added.map(renderTopicEntry).join("\n\n");
  return [withoutMarker, list, marker].filter((part) => part !== "").join("\n\n") + "\n";
}

function renderAssessmentBlock({ entry, assessment }: AssessedEntry, quoteMax: number): string {
  const lines = [
    `#### ${entryLink(entry)} · ${kindLabel(entry.kind)} · ${priorityLabel(assessment.prioritaet)}`,
    "",
    quote(sanitize(entry.message), quoteMax),
    "",
    `**Deutung:** ${sanitize(assessment.deutung)}`,
  ];
  if (assessment.befund.trim() !== "") lines.push("", `**Befund:** ${sanitize(assessment.befund)}`);
  lines.push(
    "",
    `**Einordnung:** ${CATEGORY_LABELS[assessment.kategorie]} · ${priorityLabel(assessment.prioritaet)} · Aufwand ${EFFORT_LABELS[assessment.aufwand]}`,
    "",
    `**Vorschlag:** ${PROPOSAL_LABELS[assessment.vorschlag]}`,
    "",
    `**Statusvorschlag:** ${statusLabel(assessment.statusvorschlag)}`
  );
  if (assessment.antworttext.trim() !== "") {
    lines.push("", "**Antworttext:**", "", quote(sanitize(assessment.antworttext), REPLY_QUOTE_MAX));
  }
  return lines.join("\n");
}

/** Comment in a topic issue: „Neue Meldungen am TT.MM.JJJJ“. */
export function renderTopicComment(meldungen: AssessedEntry[], now: Date): string {
  return (
    [
      `### Neue Meldungen am ${germanDay(now)}`,
      ...meldungen.map((m) => renderAssessmentBlock(m, COMMENT_QUOTE_MAX)),
    ].join("\n\n") + "\n"
  );
}

// ---------- daily report ----------

export type TopicLink = { number: number; title: string };

export type DailyReport = {
  now: Date;
  /** Cursor at the start of the run; null = first run (open backlog). */
  cursor: Date | null;
  newCursor: Date | null;
  /** `topicNumber` null = not created yet (dry run) or no topic (rejected entries). */
  entries: (AssessedEntry & { topicNumber: number | null })[];
  restCount: number;
  stale: { entry: RenderEntry; createdAt: Date; vorschlag: string | null }[];
  newTopics: TopicLink[];
  updatedTopics: TopicLink[];
  closedTopics: TopicLink[];
  drafts: { number: number | null; kurzname: string; topicNumber: number | null }[];
  sketches: { topicNumber: number | null; title: string }[];
  rejected: { art: "Entwurf" | "Skizze"; name: string; grund: string[] }[];
  questions: { text: string; entry?: RenderEntry }[];
  /** Notes of the publishing script, e.g. comments skipped as duplicates. */
  notes?: string[];
};

function issueRef(number: number | null): string {
  return number === null ? "neu" : `#${number}`;
}

/** Topic column of the overview: rejected entries have no topic („–“). */
function topicCell({ assessment, topicNumber }: { assessment: Assessment; topicNumber: number | null }): string {
  return assessment.vorschlag === "verwerfen" ? "–" : issueRef(topicNumber);
}

function topicList(heading: string, topics: TopicLink[]): string {
  if (topics.length === 0) return `**${heading}:** keine`;
  return [`**${heading}:**`, ...topics.map((t) => `- #${t.number} ${sanitize(t.title)}`)].join("\n");
}

function replyBlock({ entry, assessment }: AssessedEntry): string {
  return [
    `- ${entryLink(entry)} → Status **${statusLabel(assessment.statusvorschlag)}**`,
    "",
    indent(quote(sanitize(assessment.antworttext), REPLY_QUOTE_MAX)),
  ].join("\n");
}

/** The daily issue „Feedback-Triage TT.MM.JJJJ“; at most `max` characters. */
export function renderDailyReport(report: DailyReport, max = REPORT_MAX): string {
  const entries = [...report.entries].sort(
    (a, b) => PRIORITY_ORDER[a.assessment.prioritaet] - PRIORITY_ORDER[b.assessment.prioritaet]
  );
  const withReply = entries.filter((m) => m.assessment.antworttext.trim() !== "");
  const replyNow = withReply.filter((m) => m.assessment.antwortJetzt);
  const stock = withReply.filter((m) => !m.assessment.antwortJetzt);

  // 1. Head
  const head: string[] = [
    report.cursor
      ? `Zeitraum: ${formatGermanDateTime(report.cursor)} bis ${formatGermanDateTime(report.now)}`
      : `Erster Lauf: offener Altbestand bis ${formatGermanDateTime(report.now)}`,
    `${report.entries.length} neu · ${report.stale.length} liegengeblieben`,
  ];
  if (report.restCount > 0) head.push(`Weitere ${report.restCount} Meldungen folgen im nächsten Lauf.`);
  for (const note of report.notes ?? []) head.push(`Hinweis: ${sanitize(note)}`);

  // 2. Overview
  const overview =
    entries.length === 0
      ? "## Übersicht\n\nKeine neuen Meldungen."
      : [
          "## Übersicht",
          "",
          "| Kurz-ID | Art | P | Kategorie | Thema | Vorschlag | Status |",
          "|---|---|---|---|---|---|---|",
          ...entries.map(
            (m) =>
              `| ${entryLink(m.entry)} | ${kindLabel(m.entry.kind)} | ${priorityLabel(m.assessment.prioritaet)} | ${CATEGORY_LABELS[m.assessment.kategorie]} | ${topicCell(m)} | ${PROPOSAL_LABELS[m.assessment.vorschlag]} | ${statusLabel(m.assessment.statusvorschlag)} |`
          ),
        ].join("\n");

  // 3. Enter now
  const enterNow = [
    "## Jetzt eintragen",
    replyNow.length === 0 ? "Nichts." : replyNow.map(replyBlock).join("\n\n"),
  ].join("\n\n");

  // 4. Reply stock (shortened first if the report is too long)
  const renderStock = (items: AssessedEntry[], left: number) => {
    const lines = [`<details><summary>Antwort-Vorrat (${stock.length})</summary>`, ""];
    lines.push(items.length === 0 ? "Nichts." : items.map(replyBlock).join("\n\n"));
    if (left > 0) lines.push("", `${left} weitere Antworten aus Platzgründen weggelassen, siehe Themen-Issues.`);
    lines.push("", "</details>");
    return ["## Antwort-Vorrat", lines.join("\n")].join("\n\n");
  };

  // 5. Topics
  const topics = [
    "## Themen",
    topicList("Neue Themen", report.newTopics),
    topicList("Themen mit neuen Meldungen", report.updatedTopics),
    topicList("Heute geschlossen", report.closedTopics),
  ].join("\n\n");

  // 6. Drafts and sketches
  const specs = [
    "## Spec-Entwürfe und Skizzen",
    report.drafts.length === 0
      ? "**Spec-Entwürfe:** keine"
      : [
          "**Spec-Entwürfe:**",
          ...report.drafts.map((d) => `- ${issueRef(d.number)} Entwurf: ${d.kurzname} (Thema ${issueRef(d.topicNumber)})`),
        ].join("\n"),
    report.sketches.length === 0
      ? "**Spec-Skizzen:** keine"
      : [
          "**Spec-Skizzen:**",
          ...report.sketches.map((s) => `- im Thema ${issueRef(s.topicNumber)} ${sanitize(s.title)}`),
        ].join("\n"),
  ];
  if (report.rejected.length > 0) {
    specs.push(
      [
        "**Nicht veröffentlicht:**",
        ...report.rejected.map((r) => `- ${r.art} ${sanitize(r.name)}: ${r.grund.map(sanitize).join("; ")}`),
      ].join("\n")
    );
  }

  // 7. Stale
  const stale = [
    "## Liegengeblieben",
    report.stale.length === 0
      ? "Nichts."
      : report.stale
          .map(
            (s) =>
              `- ${entryLink(s.entry)} · ${kindLabel(s.entry.kind)} · seit ${germanDay(s.createdAt)}${s.vorschlag ? ` – ${sanitize(s.vorschlag)}` : ""}`
          )
          .join("\n"),
  ].join("\n\n");

  // 8. Questions
  const questions = [
    "## Fragen an Franz",
    report.questions.length === 0
      ? "Keine."
      : report.questions
          .map((q) => `- ${sanitize(q.text)}${q.entry ? ` (zu ${entryLink(q.entry)})` : ""}`)
          .join("\n"),
  ].join("\n\n");

  // 9. Cursor
  const marker = report.newCursor ? writeCursor(report.newCursor) : "";

  const build = (stockItems: AssessedEntry[]) =>
    [
      head.join("\n\n"),
      overview,
      enterNow,
      renderStock(stockItems, stock.length - stockItems.length),
      topics,
      specs.join("\n\n"),
      stale,
      questions,
      marker,
    ]
      .filter((part) => part !== "")
      .join("\n\n") + "\n";

  let kept = stock.length;
  let text = build(stock);
  while (text.length > max && kept > 0) {
    kept -= 1;
    text = build(stock.slice(0, kept));
  }
  if (text.length > max) {
    // Last resort: cut before the marker so the cursor survives.
    const hint = "\n\n… (Bericht gekürzt, zu lang)\n\n";
    const tail = marker === "" ? "\n" : `${marker}\n`;
    text = text.slice(0, Math.max(0, max - hint.length - tail.length)) + hint + tail;
  }
  return text;
}
