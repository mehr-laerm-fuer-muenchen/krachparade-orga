"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { feedback, type Member } from "@/db/schema";
import { createFeedbackInput, fieldErrors, updateFeedbackInput } from "@/lib/feedback/schemas";

// Spec 014: everyone signed in and active may report, only admins change
// status and reply. The acting member always comes from the database, never
// from the session alone. Feedback texts are never logged. No delete.

export type FeedbackActionResult =
  | { ok: true }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> };

const NO_ACCESS = "Kein Zugriff.";
const ADMINS_ONLY = "Nur Admins können das ändern.";
const NOT_FOUND = "Diese Meldung gibt es nicht.";
const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

/** The signed-in member, loaded from the database; null unless active. */
async function loadActor(): Promise<Member | null> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  return actor?.active ? actor : null;
}

/**
 * Saves a report. Deliberately neither `revalidatePath` nor `refresh`: the
 * page behind the dialog (open plan panel, protocol draft) must stay as it is.
 */
export async function createFeedback(input: unknown): Promise<FeedbackActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };

  const parsed = createFeedbackInput.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  try {
    await db.insert(feedback).values({ ...parsed.data, createdBy: actor.id });
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }
  return { ok: true };
}

/** Status and reply, admins only (`active` and `is_admin` from the database). */
export async function updateFeedback(id: unknown, input: unknown): Promise<FeedbackActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };
  if (!actor.isAdmin) return { ok: false, message: ADMINS_ONLY };

  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, message: NOT_FOUND };

  const parsed = updateFeedbackInput.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrors(parsed.error) };

  const updated = await db
    .update(feedback)
    .set({ ...parsed.data, updatedBy: actor.id, updatedAt: new Date() })
    .where(eq(feedback.id, parsedId.data))
    .returning({ id: feedback.id });
  if (updated.length === 0) return { ok: false, message: NOT_FOUND };

  revalidatePath("/feedback");
  revalidatePath(`/feedback/${parsedId.data}`);
  return { ok: true };
}
