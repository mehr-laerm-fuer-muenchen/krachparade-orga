"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { setRegistrationWindow } from "@/db/collectives";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { collectiveRegistrations, type Member } from "@/db/schema";
import { NOTE_MAX } from "@/lib/collectives/limits";
import { REGISTRATION_STATUSES } from "@/lib/collectives/options";
import { isPastRetention, retentionEnd } from "@/lib/collectives/retention";
import { windowError } from "@/lib/collectives/window";
import { formatGermanDate, todayInBerlin } from "@/lib/dday";

// Spec 031: evaluating registrations on /kollektive. Every signed-in, active
// member may set status and note; deleting and the registration window are
// for admins. The acting member always comes from the database.

export type CollectiveActionResult = { ok: true } | { ok: false; message: string };

const NO_ACCESS = "Kein Zugriff.";
const ADMINS_ONLY = "Nur Admins können das ändern.";
const NOT_FOUND = "Diese Anmeldung gibt es nicht.";
const NO_EDITION = "Es gibt keine aktuelle Ausgabe.";
const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

const id = z.uuid();
const isoDate = z.iso.date();

async function loadActor(): Promise<Member | null> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  return actor?.active ? actor : null;
}

function revalidate(registrationId?: string) {
  revalidatePath("/kollektive");
  if (registrationId) revalidatePath(`/kollektive/${registrationId}`);
}

/** Updates one registration of the current edition; false if there is none. */
async function updateRegistration(
  registrationId: string,
  values: Partial<typeof collectiveRegistrations.$inferInsert>
): Promise<boolean> {
  const edition = await getCurrentEdition();
  if (!edition) return false;
  const updated = await db
    .update(collectiveRegistrations)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(collectiveRegistrations.id, registrationId), eq(collectiveRegistrations.editionId, edition.id)))
    .returning({ id: collectiveRegistrations.id });
  return updated.length > 0;
}

export async function setRegistrationStatus(
  registrationId: unknown,
  status: unknown
): Promise<CollectiveActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };
  const parsedId = id.safeParse(registrationId);
  const parsedStatus = z.enum(REGISTRATION_STATUSES).safeParse(status);
  if (!parsedId.success) return { ok: false, message: NOT_FOUND };
  if (!parsedStatus.success) return { ok: false, message: "Bitte einen Status wählen." };
  if (!(await updateRegistration(parsedId.data, { status: parsedStatus.data }))) {
    return { ok: false, message: NOT_FOUND };
  }
  revalidate(parsedId.data);
  return { ok: true };
}

export async function setRegistrationNote(registrationId: unknown, note: unknown): Promise<CollectiveActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };
  const parsedId = id.safeParse(registrationId);
  if (!parsedId.success) return { ok: false, message: NOT_FOUND };
  const parsedNote = z
    .string()
    .nullish()
    .transform((value) => value?.trim() ?? "")
    .pipe(z.string().max(NOTE_MAX, `Höchstens ${NOTE_MAX} Zeichen.`))
    .safeParse(note);
  if (!parsedNote.success) return { ok: false, message: parsedNote.error.issues[0]?.message ?? GENERIC_ERROR };
  const internalNote = parsedNote.data.length > 0 ? parsedNote.data : null;
  if (!(await updateRegistration(parsedId.data, { internalNote }))) {
    return { ok: false, message: NOT_FOUND };
  }
  revalidate(parsedId.data);
  return { ok: true };
}

export async function deleteRegistration(registrationId: unknown): Promise<CollectiveActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };
  if (!actor.isAdmin) return { ok: false, message: ADMINS_ONLY };
  const parsedId = id.safeParse(registrationId);
  if (!parsedId.success) return { ok: false, message: NOT_FOUND };
  const edition = await getCurrentEdition();
  if (!edition) return { ok: false, message: NOT_FOUND };
  const deleted = await db
    .delete(collectiveRegistrations)
    .where(and(eq(collectiveRegistrations.id, parsedId.data), eq(collectiveRegistrations.editionId, edition.id)))
    .returning({ id: collectiveRegistrations.id });
  if (deleted.length === 0) return { ok: false, message: NOT_FOUND };
  revalidate();
  return { ok: true };
}

/** Both dates set, or both empty (= registration closed). */
export async function updateRegistrationWindow(opensOn: unknown, closesOn: unknown): Promise<CollectiveActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };
  if (!actor.isAdmin) return { ok: false, message: ADMINS_ONLY };
  const edition = await getCurrentEdition();
  if (!edition) return { ok: false, message: NO_EDITION };

  const empty = (value: unknown) => value === null || value === undefined || value === "";
  if (empty(opensOn) && empty(closesOn)) {
    await setRegistrationWindow(edition.id, null, null);
    revalidate();
    revalidatePath("/anmeldung");
    return { ok: true };
  }
  const opens = isoDate.safeParse(opensOn);
  const closes = isoDate.safeParse(closesOn);
  if (!opens.success || !closes.success) return { ok: false, message: "Bitte Start und Ende angeben." };
  const error = windowError(opens.data, closes.data, edition.dDay);
  if (error) return { ok: false, message: error };
  await setRegistrationWindow(edition.id, opens.data, closes.data);
  revalidate();
  revalidatePath("/anmeldung");
  return { ok: true };
}

/** Deletes every registration of the current edition, from the retention end on. */
export async function deleteAllRegistrations(): Promise<CollectiveActionResult> {
  const actor = await loadActor();
  if (!actor) return { ok: false, message: NO_ACCESS };
  if (!actor.isAdmin) return { ok: false, message: ADMINS_ONLY };
  const edition = await getCurrentEdition();
  if (!edition) return { ok: false, message: NO_EDITION };
  if (!isPastRetention(edition.dDay, todayInBerlin(new Date()))) {
    return {
      ok: false,
      message: `Löschen geht erst ab dem ${formatGermanDate(retentionEnd(edition.dDay))}.`,
    };
  }
  await db.delete(collectiveRegistrations).where(eq(collectiveRegistrations.editionId, edition.id));
  revalidate();
  return { ok: true };
}
