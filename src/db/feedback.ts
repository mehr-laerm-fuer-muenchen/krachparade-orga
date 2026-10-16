import { count, desc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { OPEN_FEEDBACK_STATUSES, type FeedbackStatus } from "@/lib/feedback/status";
import type { FeedbackKind } from "@/lib/feedback/kinds";
import { db } from "./index";
import { feedback, members, type Feedback } from "./schema";

/** Shown when the reporting or editing member no longer exists. */
const UNKNOWN_NAME = "Unbekannt";

export type FeedbackEntry = Omit<Feedback, "kind" | "status"> & {
  kind: FeedbackKind;
  status: FeedbackStatus;
  createdByName: string;
};

export type FeedbackDetail = FeedbackEntry & { updatedByName: string | null };

const creator = alias(members, "feedback_creator");
const editor = alias(members, "feedback_editor");

/** Feedback newest first; "open" = Neu + In Arbeit (spec 014). */
export async function listFeedback(filter: "open" | "all"): Promise<FeedbackEntry[]> {
  const rows = await db
    .select({ entry: feedback, createdByName: creator.name })
    .from(feedback)
    .leftJoin(creator, eq(creator.id, feedback.createdBy))
    .where(filter === "open" ? inArray(feedback.status, [...OPEN_FEEDBACK_STATUSES]) : undefined)
    .orderBy(desc(feedback.createdAt));
  return rows.map(({ entry, createdByName }) => ({
    ...(entry as FeedbackEntry),
    createdByName: createdByName ?? UNKNOWN_NAME,
  }));
}

/** One feedback entry with the names of reporter and last editor, or null. */
export async function getFeedback(id: string): Promise<FeedbackDetail | null> {
  const [row] = await db
    .select({ entry: feedback, createdByName: creator.name, updatedByName: editor.name })
    .from(feedback)
    .leftJoin(creator, eq(creator.id, feedback.createdBy))
    .leftJoin(editor, eq(editor.id, feedback.updatedBy))
    .where(eq(feedback.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...(row.entry as FeedbackEntry),
    createdByName: row.createdByName ?? UNKNOWN_NAME,
    updatedByName: row.entry.updatedBy ? (row.updatedByName ?? UNKNOWN_NAME) : null,
  };
}

/** Number of entries with status "new" (pink number for admins). */
export async function countNewFeedback(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(feedback).where(eq(feedback.status, "new"));
  return row?.total ?? 0;
}
