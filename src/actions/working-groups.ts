"use server";

import { and, asc, count, eq, isNull, max, ne, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { revalidateMyTasks } from "@/actions/revalidate-my-tasks";
import {
  departments,
  editions,
  meetingItems,
  planElements,
  planNotes,
  planTodos,
  workingGroupMembers,
  workingGroups,
  type Member,
} from "@/db/schema";
import { DEPARTMENT_HAS_ONGOING } from "@/lib/ak-workspace";
import { moveItem } from "@/lib/permissions";
import {
  canChangeMembership,
  canDeleteDepartment,
  canDeleteGroup,
  canMarkFinal,
  normalizeGroupName,
} from "@/lib/working-groups";

// Spec 005: every active member may create, rename, sort, assign and delete
// working groups and departments and join or leave themselves; only admins
// change other people's memberships and mark the grouping as decided. Every
// action loads the acting member from the database (the session alone is not
// enough) and checks ids against the current edition.

export type WorkingGroupActionResult = { ok: true } | { ok: false; message: string };

const NO_ACCESS = "Kein Zugriff.";
const NO_EDITION = "Keine aktuelle Ausgabe gefunden.";
const GROUP_NOT_FOUND = "Diesen AK gibt es nicht.";
const DEPARTMENT_NOT_FOUND = "Diesen Aufgabenbereich gibt es nicht.";
const MEMBER_NOT_FOUND = "Diese Person gibt es nicht.";
const DUPLICATE_GROUP = "Diesen AK gibt es schon.";
const DUPLICATE_DEPARTMENT = "Diesen Aufgabenbereich gibt es schon.";
const GROUP_NOT_EMPTY = "Erst die Aufgabenbereiche in einen anderen AK verschieben.";
const DEPARTMENT_IN_USE = "Wird in Protokollen verwendet – stattdessen umbenennen oder verschieben.";
const OTHERS_ADMIN_ONLY = "Nur Admins können andere eintragen.";
const FINAL_ADMIN_ONLY = "Nur Admins können das ändern.";
const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

function fail(message: string): WorkingGroupActionResult {
  return { ok: false, message };
}

const OK: WorkingGroupActionResult = { ok: true };

type Context = { actor: Member; editionId: string };

/** The signed-in member (active, from the database) and the current edition. */
async function loadContext(): Promise<Context | WorkingGroupActionResult> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  if (!actor?.active) return fail(NO_ACCESS);
  const edition = await getCurrentEdition();
  if (!edition) return fail(NO_EDITION);
  return { actor, editionId: edition.id };
}

function isContext(value: Context | WorkingGroupActionResult): value is Context {
  return "actor" in value;
}

/** Context plus the working group, which must belong to the current edition. */
async function loadGroupContext(groupId: unknown) {
  const context = await loadContext();
  if (!isContext(context)) return context;
  const id = z.uuid().safeParse(groupId);
  if (!id.success) return fail(GROUP_NOT_FOUND);
  const [group] = await db
    .select()
    .from(workingGroups)
    .where(and(eq(workingGroups.id, id.data), eq(workingGroups.editionId, context.editionId)))
    .limit(1);
  if (!group) return fail(GROUP_NOT_FOUND);
  return { ...context, group };
}

/** Context plus the department, which must belong to the current edition. */
async function loadDepartmentContext(departmentId: unknown) {
  const context = await loadContext();
  if (!isContext(context)) return context;
  const id = z.uuid().safeParse(departmentId);
  if (!id.success) return fail(DEPARTMENT_NOT_FOUND);
  const [department] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id.data), eq(departments.editionId, context.editionId)))
    .limit(1);
  if (!department) return fail(DEPARTMENT_NOT_FOUND);
  return { ...context, department };
}

/** A working group id from the browser ("" or null = without group), checked. */
async function resolveGroupId(groupId: unknown, editionId: string): Promise<string | null | undefined> {
  const parsed = z.union([z.literal(""), z.uuid()]).nullable().safeParse(groupId);
  if (!parsed.success) return undefined;
  if (!parsed.data) return null;
  const [group] = await db
    .select({ id: workingGroups.id })
    .from(workingGroups)
    .where(and(eq(workingGroups.id, parsed.data), eq(workingGroups.editionId, editionId)))
    .limit(1);
  return group ? group.id : undefined;
}

async function groupNameTaken(editionId: string, name: string, exceptId?: string): Promise<boolean> {
  const [taken] = await db
    .select({ id: workingGroups.id })
    .from(workingGroups)
    .where(
      and(
        eq(workingGroups.editionId, editionId),
        sql`lower(${workingGroups.name}) = lower(${name})`,
        exceptId ? ne(workingGroups.id, exceptId) : undefined
      )
    )
    .limit(1);
  return Boolean(taken);
}

async function departmentNameTaken(editionId: string, name: string, exceptId?: string): Promise<boolean> {
  const [taken] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(
      and(
        eq(departments.editionId, editionId),
        sql`lower(${departments.name}) = lower(${name})`,
        exceptId ? ne(departments.id, exceptId) : undefined
      )
    )
    .limit(1);
  return Boolean(taken);
}

function touchGroup(groupId: string) {
  return db.update(workingGroups).set({ updatedAt: new Date() }).where(eq(workingGroups.id, groupId));
}

const directionInput = z.enum(["up", "down"]);

// --- Working groups ---------------------------------------------------------

/** Adds a working group at the end of the order. */
export async function createWorkingGroup(name: string): Promise<WorkingGroupActionResult> {
  const context = await loadContext();
  if (!isContext(context)) return context;
  const parsed = normalizeGroupName(z.string().catch("").parse(name));
  if (!parsed.ok) return fail(parsed.error);
  if (await groupNameTaken(context.editionId, parsed.name)) return fail(DUPLICATE_GROUP);

  const [{ last }] = await db
    .select({ last: max(workingGroups.sortOrder) })
    .from(workingGroups)
    .where(eq(workingGroups.editionId, context.editionId));
  // The unique index (edition, lower(name)) catches a concurrent duplicate.
  const inserted = await db
    .insert(workingGroups)
    .values({
      editionId: context.editionId,
      name: parsed.name,
      sortOrder: (last ?? 0) + 1,
      createdBy: context.actor.id,
    })
    .onConflictDoNothing()
    .returning({ id: workingGroups.id });
  if (inserted.length === 0) return fail(DUPLICATE_GROUP);

  refresh();
  return OK;
}

export async function renameWorkingGroup(groupId: string, name: string): Promise<WorkingGroupActionResult> {
  const context = await loadGroupContext(groupId);
  if (!("group" in context)) return context;
  const parsed = normalizeGroupName(z.string().catch("").parse(name));
  if (!parsed.ok) return fail(parsed.error);
  if (await groupNameTaken(context.editionId, parsed.name, context.group.id)) return fail(DUPLICATE_GROUP);

  try {
    await db
      .update(workingGroups)
      .set({ name: parsed.name, updatedAt: new Date() })
      .where(eq(workingGroups.id, context.group.id));
  } catch {
    return fail(DUPLICATE_GROUP);
  }
  refresh();
  return OK;
}

export async function moveWorkingGroup(groupId: string, direction: string): Promise<WorkingGroupActionResult> {
  const context = await loadGroupContext(groupId);
  if (!("group" in context)) return context;
  const parsed = directionInput.safeParse(direction);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const ids = (
    await db
      .select({ id: workingGroups.id })
      .from(workingGroups)
      .where(eq(workingGroups.editionId, context.editionId))
      .orderBy(asc(workingGroups.sortOrder), asc(workingGroups.name))
  ).map((group) => group.id);
  const order = moveItem(ids, context.group.id, parsed.data);
  if (!order) return OK;

  // Rewrites all positions as 1, 2, 3 … in one transaction.
  const now = new Date();
  const [first, ...rest] = order.map((id, index) =>
    db.update(workingGroups).set({ sortOrder: index + 1, updatedAt: now }).where(eq(workingGroups.id, id))
  );
  await db.batch([first, ...rest]);
  refresh();
  return OK;
}

/** Only without departments; memberships go with it (ON DELETE CASCADE). */
export async function deleteWorkingGroup(groupId: string): Promise<WorkingGroupActionResult> {
  const context = await loadGroupContext(groupId);
  if (!("group" in context)) return context;
  const [{ total }] = await db
    .select({ total: count() })
    .from(departments)
    .where(eq(departments.workingGroupId, context.group.id));
  if (!canDeleteGroup(total)) return fail(GROUP_NOT_EMPTY);

  await db.delete(workingGroups).where(eq(workingGroups.id, context.group.id));
  refresh();
  return OK;
}

// --- Memberships ------------------------------------------------------------

/** Puts a member into a working group: oneself, or anyone as admin. */
export async function joinWorkingGroup(groupId: string, memberId: string): Promise<WorkingGroupActionResult> {
  const context = await loadGroupContext(groupId);
  if (!("group" in context)) return context;
  const id = z.uuid().safeParse(memberId);
  if (!id.success) return fail(MEMBER_NOT_FOUND);
  if (!canChangeMembership(context.actor, id.data)) return fail(OTHERS_ADMIN_ONLY);
  const target = await findMemberById(id.data);
  if (!target?.active) return fail(MEMBER_NOT_FOUND);

  await db.batch([
    db
      .insert(workingGroupMembers)
      .values({ workingGroupId: context.group.id, memberId: target.id })
      .onConflictDoNothing(),
    touchGroup(context.group.id),
  ]);
  refresh();
  return OK;
}

/**
 * Takes a member out of a working group: oneself, or anyone as admin. The
 * target may be deactivated, so admins can tidy up after a deactivation.
 */
export async function leaveWorkingGroup(groupId: string, memberId: string): Promise<WorkingGroupActionResult> {
  const context = await loadGroupContext(groupId);
  if (!("group" in context)) return context;
  const id = z.uuid().safeParse(memberId);
  if (!id.success) return fail(MEMBER_NOT_FOUND);
  if (!canChangeMembership(context.actor, id.data)) return fail(OTHERS_ADMIN_ONLY);
  const target = await findMemberById(id.data);
  if (!target) return fail(MEMBER_NOT_FOUND);

  await db.batch([
    db
      .delete(workingGroupMembers)
      .where(
        and(eq(workingGroupMembers.workingGroupId, context.group.id), eq(workingGroupMembers.memberId, target.id))
      ),
    touchGroup(context.group.id),
  ]);
  refresh();
  return OK;
}

/** Decided (true) or back to a proposal (false); admins only. */
export async function setWorkingGroupsFinal(final: boolean): Promise<WorkingGroupActionResult> {
  const context = await loadContext();
  if (!isContext(context)) return context;
  if (!canMarkFinal(context.actor)) return fail(FINAL_ADMIN_ONLY);
  const parsed = z.boolean().safeParse(final);
  if (!parsed.success) return fail(GENERIC_ERROR);

  await db
    .update(editions)
    .set({ workingGroupsFinal: parsed.data })
    .where(eq(editions.id, context.editionId));
  refresh();
  return OK;
}

// --- Departments ("Aufgabenbereiche") ---------------------------------------

const departmentName = z
  .string()
  .trim()
  .min(1, "Name fehlt.")
  .max(60, "Name ist zu lang (max. 60 Zeichen).");

/** Adds a department at the end of the order, optionally into a working group. */
export async function createDepartment(name: string, groupId: string | null): Promise<WorkingGroupActionResult> {
  const context = await loadContext();
  if (!isContext(context)) return context;
  const parsed = departmentName.safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const workingGroupId = await resolveGroupId(groupId, context.editionId);
  if (workingGroupId === undefined) return fail(GROUP_NOT_FOUND);
  if (await departmentNameTaken(context.editionId, parsed.data)) return fail(DUPLICATE_DEPARTMENT);

  const [{ last }] = await db
    .select({ last: max(departments.sortOrder) })
    .from(departments)
    .where(eq(departments.editionId, context.editionId));
  const inserted = await db
    .insert(departments)
    .values({ editionId: context.editionId, name: parsed.data, workingGroupId, sortOrder: (last ?? 0) + 1 })
    .onConflictDoNothing()
    .returning({ id: departments.id });
  if (inserted.length === 0) return fail(DUPLICATE_DEPARTMENT);

  refresh();
  return OK;
}

export async function renameDepartment(departmentId: string, name: string): Promise<WorkingGroupActionResult> {
  const context = await loadDepartmentContext(departmentId);
  if (!("department" in context)) return context;
  const parsed = departmentName.safeParse(name);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  if (await departmentNameTaken(context.editionId, parsed.data, context.department.id)) {
    return fail(DUPLICATE_DEPARTMENT);
  }

  try {
    await db.update(departments).set({ name: parsed.data }).where(eq(departments.id, context.department.id));
  } catch {
    return fail(DUPLICATE_DEPARTMENT);
  }
  refresh();
  return OK;
}

/** Moves a department into another working group, or "" / null = without group. */
export async function assignDepartment(
  departmentId: string,
  groupId: string | null
): Promise<WorkingGroupActionResult> {
  const context = await loadDepartmentContext(departmentId);
  if (!("department" in context)) return context;
  const workingGroupId = await resolveGroupId(groupId, context.editionId);
  if (workingGroupId === undefined) return fail(GROUP_NOT_FOUND);

  // Its "Laufende Aufgaben" (spec 018) move along into the same working group.
  await db.batch([
    db.update(departments).set({ workingGroupId }).where(eq(departments.id, context.department.id)),
    db
      .update(planElements)
      .set({ workingGroupId, updatedAt: new Date(), updatedBy: context.actor.id })
      .where(and(eq(planElements.departmentId, context.department.id), eq(planElements.isOngoing, true))),
  ]);
  refresh();
  revalidateMyTasks();
  return OK;
}

/**
 * One step up or down among the departments of the same working group (or
 * among those without one): swaps `sort_order` with the neighbour.
 */
export async function moveDepartment(departmentId: string, direction: string): Promise<WorkingGroupActionResult> {
  const context = await loadDepartmentContext(departmentId);
  if (!("department" in context)) return context;
  const parsed = directionInput.safeParse(direction);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const { department } = context;
  const siblings = await db
    .select({ id: departments.id, sortOrder: departments.sortOrder })
    .from(departments)
    .where(
      and(
        eq(departments.editionId, context.editionId),
        department.workingGroupId
          ? eq(departments.workingGroupId, department.workingGroupId)
          : isNull(departments.workingGroupId)
      )
    )
    .orderBy(asc(departments.sortOrder), asc(departments.name));
  const order = moveItem(
    siblings.map((sibling) => sibling.id),
    department.id,
    parsed.data
  );
  if (!order) return OK;

  // The siblings keep their set of positions, only in the new order.
  const positions = siblings.map((sibling) => sibling.sortOrder);
  const changes = order
    .map((id, index) => ({ id, sortOrder: positions[index] }))
    .filter((change, index) => change.id !== siblings[index].id);
  const [first, ...rest] = changes.map((change) =>
    db.update(departments).set({ sortOrder: change.sortOrder }).where(eq(departments.id, change.id))
  );
  await db.batch([first, ...rest]);
  refresh();
  return OK;
}

/**
 * Only while no minutes item points to the department and its "Laufende
 * Aufgaben" (spec 018) have neither to-dos nor notes; an empty "Laufende
 * Aufgaben" element goes with it (`department_id` would only be cleared).
 */
export async function deleteDepartment(departmentId: string): Promise<WorkingGroupActionResult> {
  const context = await loadDepartmentContext(departmentId);
  if (!("department" in context)) return context;
  const { department } = context;
  const [[{ total }], [{ todos }], [{ notes }]] = await Promise.all([
    db.select({ total: count() }).from(meetingItems).where(eq(meetingItems.departmentId, department.id)),
    db
      .select({ todos: count() })
      .from(planTodos)
      .innerJoin(planElements, eq(planElements.id, planTodos.elementId))
      .where(and(eq(planElements.departmentId, department.id), eq(planElements.isOngoing, true))),
    db
      .select({ notes: count() })
      .from(planNotes)
      .innerJoin(planElements, eq(planElements.id, planNotes.elementId))
      .where(and(eq(planElements.departmentId, department.id), eq(planElements.isOngoing, true))),
  ]);
  if (total > 0) return fail(DEPARTMENT_IN_USE);
  if (!canDeleteDepartment(total, todos + notes)) return fail(DEPARTMENT_HAS_ONGOING);

  try {
    await db.batch([
      db
        .delete(planElements)
        .where(and(eq(planElements.departmentId, department.id), eq(planElements.isOngoing, true))),
      db.delete(departments).where(eq(departments.id, department.id)),
    ]);
  } catch {
    // A minutes item added in the meantime blocks the delete (foreign key).
    return fail(DEPARTMENT_IN_USE);
  }
  refresh();
  revalidateMyTasks();
  return OK;
}
