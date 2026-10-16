"use server";

import { and, eq, max, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { revalidateMyTasks } from "@/actions/revalidate-my-tasks";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import {
  departments,
  planElements,
  planNotes,
  planTodos,
  workingGroupNotes,
  workingGroups,
  type Department,
  type Member,
} from "@/db/schema";
import { ONGOING_NAME } from "@/lib/ak-workspace";

// Spec 018: points without a date and notes in the AK workspace. Every active
// member may add them; notes of a working group are only changed by their
// author. Every action loads the acting member from the database (the
// session alone is not enough) and checks ids against the current edition.
// Ticking off, deleting to-dos and editing department notes use the existing
// actions in ./plan.ts. Texts are never logged.

type Failure = { ok: false; message: string };

export type AkActionResult = { ok: true } | Failure;
/** `created`: the "Laufende Aufgaben" element of the department was created by this call. */
export type OngoingActionResult = { ok: true; created: boolean } | Failure;

const NO_ACCESS = "Kein Zugriff.";
const NO_EDITION = "Keine aktuelle Ausgabe gefunden.";
const GROUP_NOT_FOUND = "Diesen AK gibt es nicht.";
const DEPARTMENT_NOT_FOUND = "Diesen Aufgabenbereich gibt es nicht.";
const DEPARTMENT_WITHOUT_GROUP = "Dieser Aufgabenbereich gehört zu keinem AK.";
const MEMBER_NOT_FOUND = "Diese Person gibt es nicht oder sie ist nicht aktiv.";
const NOTE_NOT_FOUND = "Diese Notiz gibt es nicht.";
const OWN_NOTES = "Nur eigene Notizen lassen sich ändern.";
const SAVE_ERROR = "Konnte nicht gespeichert werden.";

function fail(message: string): Failure {
  return { ok: false, message };
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Ungültige Eingabe.";
}

const idInput = z.uuid();
const todoText = z
  .string()
  .trim()
  .min(1, "Bitte einen Text eingeben.")
  .max(200, "Der Punkt darf höchstens 200 Zeichen lang sein.");
const noteText = z
  .string()
  .trim()
  .min(1, "Bitte einen Text eingeben.")
  .max(2000, "Die Notiz darf höchstens 2000 Zeichen lang sein.");

type Context = { actor: Member; editionId: string };

/** The signed-in member (active, from the database) and the current edition. */
async function loadContext(): Promise<Context | Failure> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  if (!actor?.active) return fail(NO_ACCESS);
  const edition = await getCurrentEdition();
  if (!edition) return fail(NO_EDITION);
  return { actor, editionId: edition.id };
}

function isFailure(value: object): value is Failure {
  return "ok" in value && value.ok === false;
}

/** Context plus the department, which must belong to the current edition and to a working group. */
async function loadDepartmentContext(
  departmentId: unknown
): Promise<(Context & { department: Department & { workingGroupId: string } }) | Failure> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(departmentId);
  if (!id.success) return fail(DEPARTMENT_NOT_FOUND);
  const [department] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id.data), eq(departments.editionId, context.editionId)))
    .limit(1);
  if (!department) return fail(DEPARTMENT_NOT_FOUND);
  const { workingGroupId } = department;
  if (workingGroupId === null) return fail(DEPARTMENT_WITHOUT_GROUP);
  return { ...context, department: { ...department, workingGroupId } };
}

/**
 * The "Laufende Aufgaben" element of the department; creates it if missing.
 * The unique partial index (edition, department) where `is_ongoing` keeps two
 * concurrent calls from creating two: the second insert does nothing.
 */
async function ensureOngoing(
  context: Context & { department: Department & { workingGroupId: string } }
): Promise<{ id: string; created: boolean } | undefined> {
  const { actor, editionId, department } = context;
  const now = new Date();
  const [inserted] = await db
    .insert(planElements)
    .values({
      editionId,
      workingGroupId: department.workingGroupId,
      departmentId: department.id,
      kind: "milestone",
      name: ONGOING_NAME,
      durationDays: 0,
      isOngoing: true,
      sortOrder: 0,
      createdBy: actor.id,
      updatedBy: actor.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing({
      target: [planElements.editionId, planElements.departmentId],
      where: sql`${planElements.isOngoing} = true`,
    })
    .returning({ id: planElements.id });
  if (inserted) return { id: inserted.id, created: true };

  const [existing] = await db
    .select({ id: planElements.id })
    .from(planElements)
    .where(
      and(
        eq(planElements.editionId, editionId),
        eq(planElements.departmentId, department.id),
        eq(planElements.isOngoing, true)
      )
    )
    .limit(1);
  return existing ? { id: existing.id, created: false } : undefined;
}

function touchElement(elementId: string, actorId: string) {
  return db
    .update(planElements)
    .set({ updatedAt: new Date(), updatedBy: actorId })
    .where(eq(planElements.id, elementId));
}

/** A point without a date in "Laufende Aufgaben" of the department, optionally with a person. */
export async function addOngoingTodo(
  departmentId: string,
  text: string,
  ownerId?: string | null
): Promise<OngoingActionResult> {
  const context = await loadDepartmentContext(departmentId);
  if (isFailure(context)) return context;
  const parsed = todoText.safeParse(text);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  let owner: string | null = null;
  if (ownerId !== undefined && ownerId !== null && ownerId !== "") {
    const id = idInput.safeParse(ownerId);
    const member = id.success ? await findMemberById(id.data) : undefined;
    if (!member?.active) return fail(MEMBER_NOT_FOUND);
    owner = member.id;
  }

  try {
    const element = await ensureOngoing(context);
    if (!element) return fail(SAVE_ERROR);
    const [{ last }] = await db
      .select({ last: max(planTodos.sortOrder) })
      .from(planTodos)
      .where(eq(planTodos.elementId, element.id));
    await db.batch([
      db.insert(planTodos).values({
        elementId: element.id,
        text: parsed.data,
        ownerId: owner,
        sortOrder: (last ?? 0) + 1,
        createdBy: context.actor.id,
      }),
      touchElement(element.id, context.actor.id),
    ]);
    refresh();
    revalidateMyTasks();
    return { ok: true, created: element.created };
  } catch {
    return fail(SAVE_ERROR);
  }
}

/** A note in "Laufende Aufgaben" of the department; edit and delete with `updateNote`/`deleteNote`. */
export async function addOngoingNote(departmentId: string, text: string): Promise<OngoingActionResult> {
  const context = await loadDepartmentContext(departmentId);
  if (isFailure(context)) return context;
  const parsed = noteText.safeParse(text);
  if (!parsed.success) return fail(firstMessage(parsed.error));

  try {
    const element = await ensureOngoing(context);
    if (!element) return fail(SAVE_ERROR);
    await db.batch([
      db.insert(planNotes).values({ elementId: element.id, authorId: context.actor.id, text: parsed.data }),
      touchElement(element.id, context.actor.id),
    ]);
    refresh();
    return { ok: true, created: element.created };
  } catch {
    return fail(SAVE_ERROR);
  }
}

// --- Notes of a working group -------------------------------------------------

export async function createGroupNote(workingGroupId: string, text: string): Promise<AkActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(workingGroupId);
  if (!id.success) return fail(GROUP_NOT_FOUND);
  const [group] = await db
    .select({ id: workingGroups.id })
    .from(workingGroups)
    .where(and(eq(workingGroups.id, id.data), eq(workingGroups.editionId, context.editionId)))
    .limit(1);
  if (!group) return fail(GROUP_NOT_FOUND);
  const parsed = noteText.safeParse(text);
  if (!parsed.success) return fail(firstMessage(parsed.error));

  try {
    await db.insert(workingGroupNotes).values({ workingGroupId: group.id, authorId: context.actor.id, text: parsed.data });
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** The note, if its working group belongs to the current edition and the actor wrote it. */
async function loadOwnGroupNote(noteId: unknown) {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(noteId);
  if (!id.success) return fail(NOTE_NOT_FOUND);
  const [note] = await db
    .select({ id: workingGroupNotes.id, authorId: workingGroupNotes.authorId })
    .from(workingGroupNotes)
    .innerJoin(workingGroups, eq(workingGroups.id, workingGroupNotes.workingGroupId))
    .where(and(eq(workingGroupNotes.id, id.data), eq(workingGroups.editionId, context.editionId)))
    .limit(1);
  if (!note) return fail(NOTE_NOT_FOUND);
  if (note.authorId !== context.actor.id) return fail(OWN_NOTES);
  return { ...context, note };
}

/** Only the author may change a note. */
export async function updateGroupNote(noteId: string, text: string): Promise<AkActionResult> {
  const context = await loadOwnGroupNote(noteId);
  if (isFailure(context)) return context;
  const parsed = noteText.safeParse(text);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  await db
    .update(workingGroupNotes)
    .set({ text: parsed.data, updatedAt: new Date() })
    .where(eq(workingGroupNotes.id, context.note.id));
  refresh();
  return { ok: true };
}

/** Only the author may delete a note. */
export async function deleteGroupNote(noteId: string): Promise<AkActionResult> {
  const context = await loadOwnGroupNote(noteId);
  if (isFailure(context)) return context;
  await db.delete(workingGroupNotes).where(eq(workingGroupNotes.id, context.note.id));
  refresh();
  return { ok: true };
}
