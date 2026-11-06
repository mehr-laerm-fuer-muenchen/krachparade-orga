// Spec 022: the agent writes only structured data to `triage-out/ergebnis.json`.
// This schema and `validateResult` decide whether anything gets published.

import { z } from "zod";
import type { TopicsFile } from "./topics";

const SHORT_ID = z.string().regex(/^[0-9a-f]{8}$/, "Kurz-ID: 8 Zeichen 0-9a-f");
const KEY = z.string().regex(/^[a-z0-9-]{3,50}$/, "Schlüssel: 3–50 Zeichen a-z, 0-9, -");

export const CATEGORIES = [
  "fehler",
  "bedienproblem",
  "wunsch",
  "missverstaendnis",
  "doppelt",
  "schon_erledigt",
] as const;
export const PRIORITIES = ["p1", "p2", "p3", "keine"] as const;
export const EFFORTS = ["klein", "mittel", "gross"] as const;
export const PROPOSALS = [
  "entwurf",
  "skizze",
  "spec_thema",
  "backlog",
  "anleitung",
  "nur_antwort",
  "verwerfen",
] as const;
export const STATUS_PROPOSALS = ["in_progress", "done", "rejected", "new"] as const;

/** Either an open topic from `themen.json` or a new one from `neueThemen`. */
export const topicRefSchema = z.union([
  z.strictObject({ issue: z.number().int().positive() }),
  z.strictObject({ neu: KEY }),
]);
export type TopicRef = z.infer<typeof topicRefSchema>;

export const assessmentSchema = z.strictObject({
  shortId: SHORT_ID,
  kategorie: z.enum(CATEGORIES),
  prioritaet: z.enum(PRIORITIES),
  aufwand: z.enum(EFFORTS),
  deutung: z.string().min(1).max(600),
  befund: z.string().max(800),
  vorschlag: z.enum(PROPOSALS),
  statusvorschlag: z.enum(STATUS_PROPOSALS),
  antworttext: z.string().max(400),
  antwortJetzt: z.boolean(),
  /** Required, except for `vorschlag: "verwerfen"`: then not allowed (checked in validateResult). */
  thema: topicRefSchema.optional(),
});
export type Assessment = z.infer<typeof assessmentSchema>;

export const newTopicSchema = z.strictObject({
  schluessel: KEY,
  titel: z.string().min(1).max(80),
  zusammenfassung: z.string().min(1).max(600),
  verweisAuf: z.number().int().positive().optional(),
});
export type NewTopic = z.infer<typeof newTopicSchema>;

export const resultSchema = z.strictObject({
  meldungen: z.array(assessmentSchema),
  neueThemen: z.array(newTopicSchema),
  liegengeblieben: z.array(z.strictObject({ shortId: SHORT_ID, vorschlag: z.string().min(1).max(200) })),
  fragenAnFranz: z.array(z.strictObject({ text: z.string().min(1).max(400), shortId: SHORT_ID.optional() })),
  entwuerfe: z.array(
    z.strictObject({
      kurzname: KEY,
      datei: z.string().regex(/^entwuerfe\/[a-z0-9-]{3,50}\.md$/, "Datei: entwuerfe/<kurzname>.md"),
      thema: topicRefSchema,
      shortIds: z.array(SHORT_ID).min(1),
    })
  ),
  skizzen: z.array(
    z.strictObject({
      thema: topicRefSchema,
      datei: z.string().regex(/^skizzen\/[a-z0-9-]{3,50}\.md$/, "Datei: skizzen/<schluessel>.md"),
      shortIds: z.array(SHORT_ID).min(1),
    })
  ),
});
export type TriageResult = z.infer<typeof resultSchema>;

/** What `validateResult` needs from `input.json`. */
export type ResultInput = {
  fresh: { shortId: string }[];
  stale: { shortId: string }[];
};

const D_DAY = /\bD-(Day|\d+)\b/i;

/**
 * Checks the agent's result against the input and the open topics.
 * Returns the parsed result and a list of errors (empty = valid).
 */
export function validateResult(
  result: unknown,
  input: ResultInput,
  topics: TopicsFile
): { result: TriageResult | null; errors: string[] } {
  const parsed = resultSchema.safeParse(result);
  if (!parsed.success) {
    return {
      result: null,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(Wurzel)"}: ${issue.message}`),
    };
  }
  const data = parsed.data;
  const errors: string[] = [];

  // Every fresh entry exactly once, nothing else.
  const freshIds = new Set(input.fresh.map((entry) => entry.shortId));
  const seen = new Map<string, number>();
  for (const assessment of data.meldungen) {
    seen.set(assessment.shortId, (seen.get(assessment.shortId) ?? 0) + 1);
  }
  for (const id of freshIds) {
    const count = seen.get(id) ?? 0;
    if (count === 0) errors.push(`meldungen: Kurz-ID ${id} fehlt`);
    if (count > 1) errors.push(`meldungen: Kurz-ID ${id} kommt ${count}-mal vor`);
  }
  for (const id of seen.keys()) {
    if (!freshIds.has(id)) errors.push(`meldungen: fremde Kurz-ID ${id}`);
  }

  // Topic references.
  const openNumbers = new Set(topics.offen.map((topic) => topic.number));
  const closedNumbers = new Set(topics.geschlossen.map((topic) => topic.number));
  const newKeys = new Map<string, number>();
  for (const topic of data.neueThemen) {
    newKeys.set(topic.schluessel, (newKeys.get(topic.schluessel) ?? 0) + 1);
    if (topic.verweisAuf !== undefined && !closedNumbers.has(topic.verweisAuf)) {
      errors.push(`neueThemen ${topic.schluessel}: verweisAuf #${topic.verweisAuf} ist kein geschlossenes Thema`);
    }
  }
  for (const [key, count] of newKeys) {
    if (count > 1) errors.push(`neueThemen: Schlüssel ${key} kommt ${count}-mal vor`);
  }
  const checkRef = (ref: TopicRef, where: string) => {
    if ("issue" in ref) {
      if (!openNumbers.has(ref.issue)) errors.push(`${where}: Thema #${ref.issue} ist kein offenes Thema`);
    } else {
      if (!newKeys.has(ref.neu)) errors.push(`${where}: neues Thema ${ref.neu} fehlt in neueThemen`);
    }
  };
  // Rejected entries get no topic; all others need one.
  for (const assessment of data.meldungen) {
    const where = `meldungen ${assessment.shortId}`;
    if (assessment.vorschlag === "verwerfen") {
      if (assessment.thema) errors.push(`${where}: bei Vorschlag verwerfen kein Thema`);
      if (assessment.statusvorschlag !== "rejected") errors.push(`${where}: Vorschlag verwerfen braucht Statusvorschlag rejected`);
      if (!assessment.antwortJetzt || assessment.antworttext.trim() === "") {
        errors.push(`${where}: Vorschlag verwerfen braucht antwortJetzt und einen Antworttext`);
      }
    } else if (!assessment.thema) {
      errors.push(`${where}: Thema fehlt`);
    } else {
      checkRef(assessment.thema, where);
    }
  }
  for (const draft of data.entwuerfe) checkRef(draft.thema, `entwuerfe ${draft.kurzname}`);
  for (const sketch of data.skizzen) checkRef(sketch.thema, `skizzen ${sketch.datei}`);
  for (const key of newKeys.keys()) {
    if (!data.meldungen.some((a) => a.thema && "neu" in a.thema && a.thema.neu === key)) {
      errors.push(`neueThemen ${key}: keine Meldung gehört zu diesem Thema`);
    }
  }

  // Replies.
  for (const assessment of data.meldungen) {
    if (assessment.antwortJetzt && assessment.statusvorschlag !== "done" && assessment.statusvorschlag !== "rejected") {
      errors.push(`meldungen ${assessment.shortId}: antwortJetzt nur bei Statusvorschlag done oder rejected`);
    }
    if (D_DAY.test(assessment.antworttext)) {
      errors.push(`meldungen ${assessment.shortId}: Antworttext enthält „D-Day“/„D-N“`);
    }
  }

  // Stale suggestions only for stale entries.
  const staleIds = new Set(input.stale.map((entry) => entry.shortId));
  for (const entry of data.liegengeblieben) {
    if (!staleIds.has(entry.shortId)) errors.push(`liegengeblieben: Kurz-ID ${entry.shortId} ist nicht liegengeblieben`);
  }

  return { result: errors.length === 0 ? data : null, errors };
}
