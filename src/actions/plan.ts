"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { refresh } from "next/cache";
import { z } from "zod";
import { revalidateMyTasks } from "@/actions/revalidate-my-tasks";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { loadPlan, type LoadedPlan, type LoadedPlanElement } from "@/db/plan";
import {
  departments,
  members,
  planChanges,
  planElements,
  planLinks,
  planNotes,
  planTodos,
  workingGroups,
  type Member,
} from "@/db/schema";
import { ONGOING_LOCKED } from "@/lib/ak-workspace";
import { todayInBerlin } from "@/lib/dday";
import { dateToDay, dayToDate } from "@/lib/plan-days";
import {
  changeSummaries,
  CREATED_SUMMARY,
  reconnectOnDelete,
  reconnectSummary,
  snapshotOf,
  UNDO_SUMMARY,
  type ElementState,
} from "@/lib/plan-edit";
import {
  computePlan,
  MAX_TASK_DAYS,
  moveElement as moveInPlan,
  resizeFromEnd,
  resizeFromStart,
  wouldCreateCycle,
  type PlanElementChange,
  type PlanLinkInput,
} from "@/lib/plan-engine";

// Spec 008: every active member may edit the whole plan of the current
// edition; notes can only be changed by their author. Every action loads the
// acting member from the database (the session alone is not enough),
// validates its input with Zod and checks ids against the current edition.
// Concurrent edits: the last change wins, but element actions report who
// changed the element since the browser last saw it. Plan changes go to
// `plan_changes`, to-dos and notes do not. Texts of notes and to-dos are
// never logged.

type Failure = { ok: false; message: string };

/** Someone changed the element since the browser loaded it (`by` = their name). */
export type PlanConflict = { by: string | null };

export type PlanActionResult = { ok: true } | Failure;
export type ElementActionResult = { ok: true; conflict: PlanConflict | null } | Failure;
export type CreateElementResult = { ok: true; id: string } | Failure;

/** Values of an element before a move or resize, for "Rückgängig". */
export type PreviousValues = {
  id: string;
  shiftDays: number;
  fixedDate: string | null;
  durationDays: number;
};

/** `updatedAt` = the dragged element's new `updated_at`, to pass to `undoPlanChange`. */
export type MoveActionResult =
  | { ok: true; conflict: PlanConflict | null; previous: PreviousValues[]; updatedAt: string | null }
  | Failure;

/** The element whose panel triggered a link change, with its last seen `updated_at`. */
export type SeenElement = { id: string; updatedAt: string };

const NO_ACCESS = "Kein Zugriff.";
const NO_EDITION = "Keine aktuelle Ausgabe gefunden.";
const ELEMENT_NOT_FOUND = "Dieses Plan-Element gibt es nicht.";
const LINK_NOT_FOUND = "Diese Verbindung gibt es nicht.";
const LINK_EXISTS = "Diese Verbindung gibt es schon.";
const CYCLE = "Das würde einen Kreis ergeben.";
const GROUP_NOT_FOUND = "Diesen AK gibt es nicht.";
const DEPARTMENT_NOT_FOUND = "Diesen Aufgabenbereich gibt es nicht.";
const DEPARTMENT_OTHER_GROUP = "Dieser Aufgabenbereich gehört zu einem anderen AK.";
const MEMBER_NOT_FOUND = "Diese Person gibt es nicht oder sie ist nicht aktiv.";
const MILESTONE_DURATION = "Meilensteine haben keine Dauer.";
const LAG_TOO_LONG =
  "Beim Umhängen würde ein Abstand über 365 Tage entstehen. Bitte erst die Verbindungen anpassen.";
const TODO_NOT_FOUND = "Dieses To-do gibt es nicht.";
const NOTE_NOT_FOUND = "Diese Notiz gibt es nicht.";
const OWN_NOTES = "Nur eigene Notizen lassen sich ändern.";
const INVALID = "Ungültige Eingabe.";
const SAVE_ERROR = "Konnte nicht gespeichert werden.";

/** Milestone → task without an earlier duration. */
const DEFAULT_TASK_DAYS = 7;
/** Moves and fixed dates stay within ten years around the D-Day. */
const MAX_DAYS = 3650;

function fail(message: string): Failure {
  return { ok: false, message };
}

// --- Input ------------------------------------------------------------------

const idInput = z.uuid();
const seenInput = z.iso.datetime({ offset: true });
const nameInput = z
  .string()
  .trim()
  .min(1, "Bitte einen Namen eingeben.")
  .max(120, "Der Name darf höchstens 120 Zeichen lang sein.");
const kindInput = z.enum(["milestone", "task"]);
const durationInput = z
  .number()
  .int()
  .min(1, "Die Dauer muss mindestens 1 Tag sein.")
  .max(MAX_TASK_DAYS, "Die Dauer darf höchstens 365 Tage sein.");
const lagInput = z
  .number()
  .int()
  .min(0, "Der Abstand muss 0 bis 365 Tage sein.")
  .max(365, "Der Abstand muss 0 bis 365 Tage sein.");
const deltaInput = z.number().int().min(-MAX_DAYS).max(MAX_DAYS);
const dateInput = z.iso.date("Bitte ein gültiges Datum eingeben.");
const optionalIdInput = z.uuid().nullable();

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? INVALID;
}

// --- Context ----------------------------------------------------------------

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

type ElementContext = Context & {
  plan: LoadedPlan;
  element: LoadedPlanElement;
  conflict: PlanConflict | null;
};

/**
 * Context plus the whole plan and the element, which must belong to the
 * current edition. Compares `seenUpdatedAt` with the stored `updated_at`.
 */
async function loadElementContext(elementId: unknown, seenUpdatedAt: unknown): Promise<ElementContext | Failure> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(elementId);
  if (!id.success) return fail(ELEMENT_NOT_FOUND);
  const seen = seenInput.safeParse(seenUpdatedAt);
  if (!seen.success) return fail(INVALID);

  const plan = await loadPlan(context.editionId);
  const element = plan.elements.find((candidate) => candidate.id === id.data);
  if (!element) {
    // "Laufende Aufgaben" (spec 018) are not in the plan and cannot be edited there.
    const [ongoing] = await db
      .select({ id: planElements.id })
      .from(planElements)
      .where(
        and(
          eq(planElements.id, id.data),
          eq(planElements.editionId, context.editionId),
          eq(planElements.isOngoing, true)
        )
      )
      .limit(1);
    return fail(ongoing ? ONGOING_LOCKED : ELEMENT_NOT_FOUND);
  }

  const [row] = await db
    .select({ updatedAt: planElements.updatedAt, updatedByName: members.name })
    .from(planElements)
    .leftJoin(members, eq(members.id, planElements.updatedBy))
    .where(eq(planElements.id, element.id))
    .limit(1);
  if (!row) return fail(ELEMENT_NOT_FOUND);
  const conflict = row.updatedAt.getTime() !== new Date(seen.data).getTime() ? { by: row.updatedByName } : null;
  return { ...context, plan, element, conflict };
}

/** The element exists in the current edition (for to-dos and notes). */
async function elementInEdition(elementId: string, editionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: planElements.id })
    .from(planElements)
    .where(and(eq(planElements.id, elementId), eq(planElements.editionId, editionId)))
    .limit(1);
  return Boolean(row);
}

/** An active member, or null for "nobody"; undefined = not allowed. */
async function resolveActiveMember(memberId: string | null): Promise<string | null | undefined> {
  if (memberId === null) return null;
  const member = await findMemberById(memberId);
  return member?.active ? member.id : undefined;
}

// --- Writing ----------------------------------------------------------------

const LINK_COLUMNS = {
  id: planLinks.id,
  fromId: planLinks.fromElementId,
  toId: planLinks.toElementId,
  lagDays: planLinks.lagDays,
};

function stateOf(element: LoadedPlanElement): ElementState & { id: string } {
  return {
    id: element.id,
    name: element.name,
    kind: element.kind,
    durationDays: element.durationDays,
    shiftDays: element.shiftDays,
    fixedDate: element.fixedDate,
    done: element.done,
    wobbly: element.wobbly,
    workingGroupId: element.workingGroupId,
    departmentId: element.departmentId,
    ownerId: element.ownerId,
  };
}

function elementNames(plan: LoadedPlan): Map<string, string> {
  return new Map(plan.elements.map((element) => [element.id, element.name]));
}

function historyQuery(elementId: string, actorId: string, summaries: string[], now: Date) {
  return db
    .insert(planChanges)
    .values(summaries.map((summary) => ({ elementId, memberId: actorId, summary, createdAt: now })));
}

function touchQuery(elementIds: string[], actorId: string, now: Date) {
  return db
    .update(planElements)
    .set({ updatedAt: now, updatedBy: actorId })
    .where(inArray(planElements.id, elementIds));
}

/** Runs all queries in one transaction (`db.batch` of neon-http). */
async function runBatch(queries: BatchItem<"pg">[]): Promise<boolean> {
  const [first, ...rest] = queries;
  if (!first) return true;
  try {
    await db.batch([first, ...rest]);
    return true;
  } catch {
    return false;
  }
}

type ElementPatch = Partial<Omit<ElementState, "name">> & { name?: string; doneAt?: Date | null };

/** Writes a change of one element with its history; nothing if nothing changes. */
async function saveElementPatch(context: ElementContext, patch: ElementPatch, names?: Map<string, string>) {
  const { doneAt, ...statePatch } = patch;
  const before = stateOf(context.element);
  const summaries = changeSummaries(
    snapshotOf(before, context.plan.links),
    snapshotOf({ ...before, ...statePatch }, context.plan.links),
    names ?? elementNames(context.plan)
  );
  if (summaries.length === 0) return { ok: true as const, conflict: context.conflict };

  const now = new Date();
  const saved = await runBatch([
    db
      .update(planElements)
      .set({ ...statePatch, ...(doneAt !== undefined && { doneAt }), updatedAt: now, updatedBy: context.actor.id })
      .where(eq(planElements.id, context.element.id)),
    historyQuery(context.element.id, context.actor.id, summaries, now),
  ]);
  if (!saved) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true as const, conflict: context.conflict };
}

/** Writes the result of a move or resize of `context.element`. */
async function saveEngineChanges(context: ElementContext, changes: PlanElementChange[]): Promise<MoveActionResult> {
  if (changes.length === 0) return { ok: true, conflict: context.conflict, previous: [], updatedAt: null };
  const { plan, actor, element: moved } = context;
  const byId = new Map(plan.elements.map((element) => [element.id, element]));
  const names = elementNames(plan);
  const now = new Date();
  const previous: PreviousValues[] = [];
  const queries: BatchItem<"pg">[] = [];

  for (const change of changes) {
    const element = byId.get(change.id)!;
    const fixedDate = change.fixedDay === undefined ? element.fixedDate : dayToDate(change.fixedDay, plan.dDay);
    const values = {
      shiftDays: change.shiftDays ?? element.shiftDays,
      fixedDate,
      durationDays: change.durationDays ?? element.durationDays,
    };
    previous.push({
      id: element.id,
      shiftDays: element.shiftDays,
      fixedDate: element.fixedDate,
      durationDays: element.durationDays,
    });
    const before = stateOf(element);
    const summaries = changeSummaries(
      snapshotOf(before, plan.links),
      snapshotOf({ ...before, ...values }, plan.links),
      names,
      { movedWith: element.id === moved.id ? undefined : moved.name }
    );
    queries.push(
      db
        .update(planElements)
        .set({ ...values, updatedAt: now, updatedBy: actor.id })
        .where(eq(planElements.id, element.id))
    );
    if (summaries.length > 0) queries.push(historyQuery(element.id, actor.id, summaries, now));
  }

  if (!(await runBatch(queries))) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, conflict: context.conflict, previous, updatedAt: now.toISOString() };
}

/** History rows and `updated_at` for both ends of a changed link. */
function linkHistoryQueries(
  context: ElementContext,
  linksAfter: PlanLinkInput[],
  endpointIds: (string | null)[],
  now: Date
): BatchItem<"pg">[] {
  const names = elementNames(context.plan);
  const ids = [...new Set(endpointIds.filter((id): id is string => id !== null))];
  const queries: BatchItem<"pg">[] = [touchQuery(ids, context.actor.id, now)];
  for (const id of ids) {
    const state = stateOf(context.plan.elements.find((element) => element.id === id)!);
    const summaries = changeSummaries(snapshotOf(state, context.plan.links), snapshotOf(state, linksAfter), names);
    if (summaries.length > 0) queries.push(historyQuery(id, context.actor.id, summaries, now));
  }
  return queries;
}

/** Element context of the panel a link change came from; the element must be an end of the link. */
async function loadLinkContext(
  seen: unknown,
  endpointsOf: (context: ElementContext) => Promise<(string | null)[] | null>
): Promise<ElementContext | Failure> {
  const parsed = z.object({ id: z.string(), updatedAt: z.string() }).safeParse(seen);
  if (!parsed.success) return fail(INVALID);
  const context = await loadElementContext(parsed.data.id, parsed.data.updatedAt);
  if (isFailure(context)) return context;
  const ends = await endpointsOf(context);
  if (ends === null) return fail(LINK_NOT_FOUND);
  if (!ends.includes(context.element.id)) return fail(INVALID);
  return context;
}

// --- Elements ---------------------------------------------------------------

const createInput = z.object({
  name: nameInput,
  workingGroupId: optionalIdInput,
  /** Spec 018: optional, must belong to the chosen working group. */
  departmentId: optionalIdInput.optional(),
  kind: kindInput,
  durationDays: durationInput.optional(),
  /** null = the D-Day. */
  successorId: optionalIdInput,
  lagDays: lagInput,
});

/** A new element at the end of the order, always with a successor (element or D-Day). */
export async function createElement(input: z.input<typeof createInput>): Promise<CreateElementResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const parsed = createInput.safeParse(input);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const { name, workingGroupId, kind, successorId, lagDays } = parsed.data;
  if (kind === "milestone" && parsed.data.durationDays !== undefined) return fail(MILESTONE_DURATION);
  const durationDays = kind === "milestone" ? 0 : (parsed.data.durationDays ?? DEFAULT_TASK_DAYS);

  if (workingGroupId !== null) {
    const [group] = await db
      .select({ id: workingGroups.id })
      .from(workingGroups)
      .where(and(eq(workingGroups.id, workingGroupId), eq(workingGroups.editionId, context.editionId)))
      .limit(1);
    if (!group) return fail(GROUP_NOT_FOUND);
  }
  const departmentId = parsed.data.departmentId ?? null;
  if (departmentId !== null) {
    const [department] = await db
      .select({ workingGroupId: departments.workingGroupId })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.editionId, context.editionId)))
      .limit(1);
    if (!department) return fail(DEPARTMENT_NOT_FOUND);
    if (department.workingGroupId !== workingGroupId) return fail(DEPARTMENT_OTHER_GROUP);
  }
  const plan = await loadPlan(context.editionId);
  const successor = successorId === null ? null : plan.elements.find((element) => element.id === successorId);
  if (successor === undefined) return fail(ELEMENT_NOT_FOUND);

  const [{ last }] = await db
    .select({ last: max(planElements.sortOrder) })
    .from(planElements)
    .where(eq(planElements.editionId, context.editionId));
  const id = crypto.randomUUID();
  const now = new Date();
  const link = { fromId: id, toId: successorId, lagDays };
  const queries: BatchItem<"pg">[] = [
    db.insert(planElements).values({
      id,
      editionId: context.editionId,
      workingGroupId,
      departmentId,
      kind,
      name,
      durationDays,
      sortOrder: (last ?? 0) + 1,
      createdBy: context.actor.id,
      updatedBy: context.actor.id,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(planLinks).values({
      editionId: context.editionId,
      fromElementId: id,
      toElementId: successorId,
      lagDays,
    }),
    historyQuery(id, context.actor.id, [CREATED_SUMMARY], now),
  ];
  if (successor) {
    const state = stateOf(successor);
    const names = elementNames(plan).set(id, name);
    const summaries = changeSummaries(
      snapshotOf(state, plan.links),
      snapshotOf(state, [...plan.links, link]),
      names
    );
    queries.push(touchQuery([successor.id], context.actor.id, now));
    queries.push(historyQuery(successor.id, context.actor.id, summaries, now));
  }

  if (!(await runBatch(queries))) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, id };
}

const updateInput = z
  .object({
    name: nameInput,
    kind: kindInput,
    durationDays: durationInput,
    workingGroupId: optionalIdInput,
    departmentId: optionalIdInput,
    ownerId: optionalIdInput,
  })
  .partial()
  .strict();

/**
 * Name, kind, duration, working group, department and owner; only the given
 * fields change. Milestone → duration 0, task → the duration so far or 7. A
 * department that does not fit the new working group is cleared.
 */
export async function updateElement(
  elementId: string,
  input: z.input<typeof updateInput>,
  seenUpdatedAt: string
): Promise<ElementActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const fields = parsed.data;
  const element = context.element;

  const kind = fields.kind ?? element.kind;
  if (kind === "milestone" && fields.durationDays !== undefined) return fail(MILESTONE_DURATION);
  const previousDuration = element.kind === "task" ? element.durationDays : DEFAULT_TASK_DAYS;
  const durationDays = kind === "milestone" ? 0 : (fields.durationDays ?? previousDuration);

  const workingGroupId = fields.workingGroupId === undefined ? element.workingGroupId : fields.workingGroupId;
  if (workingGroupId !== element.workingGroupId && workingGroupId !== null) {
    const [group] = await db
      .select({ id: workingGroups.id })
      .from(workingGroups)
      .where(and(eq(workingGroups.id, workingGroupId), eq(workingGroups.editionId, context.editionId)))
      .limit(1);
    if (!group) return fail(GROUP_NOT_FOUND);
  }

  let departmentId = fields.departmentId === undefined ? element.departmentId : fields.departmentId;
  if (departmentId !== null) {
    const [department] = await db
      .select({ workingGroupId: departments.workingGroupId })
      .from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.editionId, context.editionId)))
      .limit(1);
    if (!department) {
      if (fields.departmentId !== undefined) return fail(DEPARTMENT_NOT_FOUND);
      departmentId = null;
    } else if (department.workingGroupId !== workingGroupId) {
      if (fields.departmentId !== undefined) return fail(DEPARTMENT_OTHER_GROUP);
      departmentId = null;
    }
  }

  let ownerId = element.ownerId;
  if (fields.ownerId !== undefined) {
    const resolved = await resolveActiveMember(fields.ownerId);
    if (resolved === undefined) return fail(MEMBER_NOT_FOUND);
    ownerId = resolved;
  }

  // Names of the working groups, departments and members in the history texts.
  const names = elementNames(context.plan);
  const groupIds = [element.workingGroupId, workingGroupId].filter((id): id is string => id !== null);
  const departmentIds = [element.departmentId, departmentId].filter((id): id is string => id !== null);
  const memberIds = [element.ownerId, ownerId].filter((id): id is string => id !== null);
  const [groupRows, departmentRows, memberRows] = await Promise.all([
    db
      .select({ id: workingGroups.id, name: workingGroups.name })
      .from(workingGroups)
      .where(inArray(workingGroups.id, groupIds)),
    db
      .select({ id: departments.id, name: departments.name })
      .from(departments)
      .where(inArray(departments.id, departmentIds)),
    db.select({ id: members.id, name: members.name }).from(members).where(inArray(members.id, memberIds)),
  ]);
  for (const row of [...groupRows, ...departmentRows, ...memberRows]) names.set(row.id, row.name);

  return saveElementPatch(
    context,
    { name: fields.name ?? element.name, kind, durationDays, workingGroupId, departmentId, ownerId },
    names
  );
}

/** Moves an element by `delta` days, with its predecessors (engine rules). */
export async function moveElement(elementId: string, delta: number, seenUpdatedAt: string): Promise<MoveActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const parsed = deltaInput.safeParse(delta);
  if (!parsed.success) return fail(INVALID);
  return saveEngineChanges(context, moveInPlan(context.plan, context.element.id, parsed.data));
}

/** Drags the start or end of a task by `delta` days; the other edge stays. */
export async function resizeElement(
  elementId: string,
  edge: "start" | "end",
  delta: number,
  seenUpdatedAt: string
): Promise<MoveActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const parsed = z.object({ edge: z.enum(["start", "end"]), delta: deltaInput }).safeParse({ edge, delta });
  if (!parsed.success) return fail(INVALID);
  const resize = parsed.data.edge === "start" ? resizeFromStart : resizeFromEnd;
  return saveEngineChanges(context, resize(context.plan, context.element.id, parsed.data.delta));
}

const previousInput = z
  .array(
    z.object({
      id: idInput,
      shiftDays: deltaInput,
      fixedDate: dateInput.nullable(),
      durationDays: z.number().int().min(0).max(MAX_TASK_DAYS),
    })
  )
  .min(1)
  .max(1000);

/**
 * Restores exactly the values returned by a move or resize (`shift_days`,
 * `fixed_date`, `duration_days`). `seenUpdatedAt` belongs to the first
 * element, the one that was dragged.
 */
export async function undoPlanChange(previous: PreviousValues[], seenUpdatedAt: string): Promise<ElementActionResult> {
  const parsed = previousInput.safeParse(previous);
  if (!parsed.success) return fail(INVALID);
  const context = await loadElementContext(parsed.data[0].id, seenUpdatedAt);
  if (isFailure(context)) return context;
  const byId = new Map(context.plan.elements.map((element) => [element.id, element]));
  if (new Set(parsed.data.map((values) => values.id)).size !== parsed.data.length) return fail(INVALID);

  const now = new Date();
  const queries: BatchItem<"pg">[] = [];
  for (const { id, shiftDays, fixedDate, durationDays } of parsed.data) {
    const element = byId.get(id);
    if (!element) return fail(ELEMENT_NOT_FOUND);
    const validDuration = element.kind === "milestone" ? durationDays === 0 : durationDays >= 1;
    if (!validDuration) return fail(INVALID);
    queries.push(
      db
        .update(planElements)
        .set({ shiftDays, fixedDate, durationDays, updatedAt: now, updatedBy: context.actor.id })
        .where(eq(planElements.id, id)),
      historyQuery(id, context.actor.id, [UNDO_SUMMARY], now)
    );
  }
  if (!(await runBatch(queries))) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, conflict: context.conflict };
}

/** Back to the latest date ("Auf spätesten Termin"): `shift_days` = 0. */
export async function resetShift(elementId: string, seenUpdatedAt: string): Promise<ElementActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  // While a fixed date is set the shift is ignored; removing it resets the shift.
  if (context.element.fixedDate !== null) return { ok: true, conflict: context.conflict };
  return saveElementPatch(context, { shiftDays: 0 });
}

/**
 * Sets a fixed date (`undefined` = the current planned start) or removes it
 * (`null`, then `shift_days` = 0).
 */
export async function setFixedDate(
  elementId: string,
  date: string | null | undefined,
  seenUpdatedAt: string
): Promise<ElementActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const { plan, element } = context;
  if (date === null) return saveElementPatch(context, { fixedDate: null, shiftDays: 0 });

  let fixedDate: string;
  if (date === undefined) {
    try {
      const today = dateToDay(todayInBerlin(new Date()), plan.dDay);
      const computed = computePlan(plan.elements, plan.links, today);
      fixedDate = dayToDate(computed.elements.get(element.id)!.plannedStart, plan.dDay);
    } catch {
      return fail(SAVE_ERROR);
    }
  } else {
    const parsed = dateInput.safeParse(date);
    if (!parsed.success) return fail(firstMessage(parsed.error));
    if (Math.abs(dateToDay(parsed.data, plan.dDay)) > MAX_DAYS) return fail("Bitte ein Datum näher an der Krachparade wählen.");
    fixedDate = parsed.data;
  }
  return saveElementPatch(context, { fixedDate });
}

/** "Erreicht": sets or clears `done` and `done_at`. */
export async function setDone(elementId: string, done: boolean, seenUpdatedAt: string): Promise<ElementActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const parsed = z.boolean().safeParse(done);
  if (!parsed.success) return fail(INVALID);
  if (parsed.data === context.element.done) return { ok: true, conflict: context.conflict };
  return saveElementPatch(context, { done: parsed.data, doneAt: parsed.data ? new Date() : null });
}

/** "Wackelt" as a manual assessment. */
export async function setWobbly(
  elementId: string,
  wobbly: boolean,
  seenUpdatedAt: string
): Promise<ElementActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const parsed = z.boolean().safeParse(wobbly);
  if (!parsed.success) return fail(INVALID);
  return saveElementPatch(context, { wobbly: parsed.data });
}

/**
 * Deletes an element. Its predecessors are linked to its successors so all
 * dates stay (`reconnectOnDelete`); to-dos, notes, history and links go with
 * it (ON DELETE CASCADE), linked protocol items lose the link.
 */
export async function deleteElement(elementId: string, seenUpdatedAt: string): Promise<ElementActionResult> {
  const context = await loadElementContext(elementId, seenUpdatedAt);
  if (isFailure(context)) return context;
  const { element, actor, editionId } = context;

  const links = await db
    .select(LINK_COLUMNS)
    .from(planLinks)
    .where(eq(planLinks.editionId, editionId));
  const result = reconnectOnDelete(links, element);
  if ([...result.create, ...result.update].some((link) => link.lagDays > 365)) return fail(LAG_TOO_LONG);

  const now = new Date();
  const predecessorIds = [...new Set(links.filter((link) => link.toId === element.id).map((link) => link.fromId))];
  const queries: BatchItem<"pg">[] = [
    ...result.create.map((link) =>
      db
        .insert(planLinks)
        .values({ editionId, fromElementId: link.fromId, toElementId: link.toId, lagDays: link.lagDays })
    ),
    ...result.update.map((link) =>
      db.update(planLinks).set({ lagDays: link.lagDays }).where(eq(planLinks.id, link.id))
    ),
    ...predecessorIds.map((id) => historyQuery(id, actor.id, [reconnectSummary(element.name)], now)),
    db.delete(planElements).where(eq(planElements.id, element.id)),
  ];
  if (predecessorIds.length > 0) queries.push(touchQuery(predecessorIds, actor.id, now));

  if (!(await runBatch(queries))) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, conflict: context.conflict };
}

// --- Links ------------------------------------------------------------------

/** End of `fromId` → start of `toId` (null = D-Day). Cycles are refused. */
export async function addLink(
  fromId: string,
  toId: string | null,
  lagDays: number,
  seen: SeenElement
): Promise<ElementActionResult> {
  const parsed = z
    .object({ fromId: idInput, toId: optionalIdInput, lagDays: lagInput })
    .safeParse({ fromId, toId, lagDays });
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const link = parsed.data;
  const context = await loadLinkContext(seen, async () => [link.fromId, link.toId]);
  if (isFailure(context)) return context;

  const ids = new Set(context.plan.elements.map((element) => element.id));
  if (!ids.has(link.fromId) || (link.toId !== null && !ids.has(link.toId))) return fail(ELEMENT_NOT_FOUND);
  if (context.plan.links.some((other) => other.fromId === link.fromId && other.toId === link.toId)) {
    return fail(LINK_EXISTS);
  }
  if (wouldCreateCycle(context.plan.links, link.fromId, link.toId)) return fail(CYCLE);

  const now = new Date();
  const saved = await runBatch([
    db.insert(planLinks).values({
      editionId: context.editionId,
      fromElementId: link.fromId,
      toElementId: link.toId,
      lagDays: link.lagDays,
    }),
    ...linkHistoryQueries(context, [...context.plan.links, link], [link.fromId, link.toId], now),
  ]);
  if (!saved) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, conflict: context.conflict };
}

async function findLink(linkId: unknown, editionId: string) {
  const id = idInput.safeParse(linkId);
  if (!id.success) return undefined;
  const [link] = await db
    .select(LINK_COLUMNS)
    .from(planLinks)
    .where(and(eq(planLinks.id, id.data), eq(planLinks.editionId, editionId)))
    .limit(1);
  return link;
}

type FoundLink = NonNullable<Awaited<ReturnType<typeof findLink>>>;

/** Loads the context of a link change and the link itself (current edition only). */
async function loadExistingLinkContext(linkId: unknown, seen: unknown) {
  let link: FoundLink | undefined;
  const context = await loadLinkContext(seen, async ({ editionId }) => {
    link = await findLink(linkId, editionId);
    return link ? [link.fromId, link.toId] : null;
  });
  if (isFailure(context)) return context;
  return { ...context, link: link! };
}

function sameLink(a: PlanLinkInput, b: PlanLinkInput): boolean {
  return a.fromId === b.fromId && a.toId === b.toId;
}

export async function updateLinkLag(linkId: string, lagDays: number, seen: SeenElement): Promise<ElementActionResult> {
  const parsed = lagInput.safeParse(lagDays);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const context = await loadExistingLinkContext(linkId, seen);
  if (isFailure(context)) return context;
  const { link } = context;
  if (link.lagDays === parsed.data) return { ok: true, conflict: context.conflict };

  const now = new Date();
  const linksAfter = context.plan.links.map((other) =>
    sameLink(other, link) ? { ...other, lagDays: parsed.data } : other
  );
  const saved = await runBatch([
    db.update(planLinks).set({ lagDays: parsed.data }).where(eq(planLinks.id, link.id)),
    ...linkHistoryQueries(context, linksAfter, [link.fromId, link.toId], now),
  ]);
  if (!saved) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, conflict: context.conflict };
}

export async function removeLink(linkId: string, seen: SeenElement): Promise<ElementActionResult> {
  const context = await loadExistingLinkContext(linkId, seen);
  if (isFailure(context)) return context;
  const { link } = context;

  const now = new Date();
  const saved = await runBatch([
    db.delete(planLinks).where(eq(planLinks.id, link.id)),
    ...linkHistoryQueries(
      context,
      context.plan.links.filter((other) => !sameLink(other, link)),
      [link.fromId, link.toId],
      now
    ),
  ]);
  if (!saved) return fail(SAVE_ERROR);
  refresh();
  revalidateMyTasks();
  return { ok: true, conflict: context.conflict };
}

// --- To-dos -----------------------------------------------------------------

const todoInput = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Bitte einen Text eingeben.")
    .max(200, "Das To-do darf höchstens 200 Zeichen lang sein."),
  ownerId: optionalIdInput,
  anchor: z.enum(["start", "end"]),
  daysBefore: z
    .number()
    .int()
    .min(0, "Bitte 0 bis 365 Tage eingeben.")
    .max(365, "Bitte 0 bis 365 Tage eingeben."),
});

/** A to-do `daysBefore` the start or end of an element, at the end of its list. */
export async function addTodo(elementId: string, input: z.input<typeof todoInput>): Promise<PlanActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(elementId);
  if (!id.success || !(await elementInEdition(id.data, context.editionId))) return fail(ELEMENT_NOT_FOUND);
  const parsed = todoInput.safeParse(input);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const ownerId = await resolveActiveMember(parsed.data.ownerId);
  if (ownerId === undefined) return fail(MEMBER_NOT_FOUND);

  const [{ last }] = await db
    .select({ last: max(planTodos.sortOrder) })
    .from(planTodos)
    .where(eq(planTodos.elementId, id.data));
  try {
    await db.insert(planTodos).values({
      elementId: id.data,
      text: parsed.data.text,
      ownerId,
      anchor: parsed.data.anchor,
      daysBefore: parsed.data.daysBefore,
      sortOrder: (last ?? 0) + 1,
      createdBy: context.actor.id,
    });
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  revalidateMyTasks();
  return { ok: true };
}

/** The to-do, if its element belongs to the current edition. */
async function loadTodoContext(todoId: unknown) {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(todoId);
  if (!id.success) return fail(TODO_NOT_FOUND);
  const [todo] = await db
    .select({ id: planTodos.id })
    .from(planTodos)
    .innerJoin(planElements, eq(planElements.id, planTodos.elementId))
    .where(and(eq(planTodos.id, id.data), eq(planElements.editionId, context.editionId)))
    .limit(1);
  if (!todo) return fail(TODO_NOT_FOUND);
  return { ...context, todo };
}

/** Ticks a to-do off (sets `done_at`) or opens it again. */
export async function toggleTodo(todoId: string, done: boolean): Promise<PlanActionResult> {
  const context = await loadTodoContext(todoId);
  if (isFailure(context)) return context;
  const parsed = z.boolean().safeParse(done);
  if (!parsed.success) return fail(INVALID);
  const now = new Date();
  await db
    .update(planTodos)
    .set({ done: parsed.data, doneAt: parsed.data ? now : null, updatedAt: now })
    .where(eq(planTodos.id, context.todo.id));
  refresh();
  revalidateMyTasks();
  return { ok: true };
}

export async function deleteTodo(todoId: string): Promise<PlanActionResult> {
  const context = await loadTodoContext(todoId);
  if (isFailure(context)) return context;
  await db.delete(planTodos).where(eq(planTodos.id, context.todo.id));
  refresh();
  revalidateMyTasks();
  return { ok: true };
}

// --- Notes ------------------------------------------------------------------

const noteInput = z
  .string()
  .trim()
  .min(1, "Bitte einen Text eingeben.")
  .max(2000, "Die Notiz darf höchstens 2000 Zeichen lang sein.");

export async function addNote(elementId: string, text: string): Promise<PlanActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(elementId);
  if (!id.success || !(await elementInEdition(id.data, context.editionId))) return fail(ELEMENT_NOT_FOUND);
  const parsed = noteInput.safeParse(text);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  try {
    await db.insert(planNotes).values({ elementId: id.data, authorId: context.actor.id, text: parsed.data });
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** The note, if its element belongs to the current edition and the actor wrote it. */
async function loadOwnNoteContext(noteId: unknown) {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(noteId);
  if (!id.success) return fail(NOTE_NOT_FOUND);
  const [note] = await db
    .select({ id: planNotes.id, authorId: planNotes.authorId })
    .from(planNotes)
    .innerJoin(planElements, eq(planElements.id, planNotes.elementId))
    .where(and(eq(planNotes.id, id.data), eq(planElements.editionId, context.editionId)))
    .limit(1);
  if (!note) return fail(NOTE_NOT_FOUND);
  if (note.authorId !== context.actor.id) return fail(OWN_NOTES);
  return { ...context, note };
}

/** Only the author may change a note. */
export async function updateNote(noteId: string, text: string): Promise<PlanActionResult> {
  const context = await loadOwnNoteContext(noteId);
  if (isFailure(context)) return context;
  const parsed = noteInput.safeParse(text);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  await db.update(planNotes).set({ text: parsed.data, updatedAt: new Date() }).where(eq(planNotes.id, context.note.id));
  refresh();
  return { ok: true };
}

/** Only the author may delete a note. */
export async function deleteNote(noteId: string): Promise<PlanActionResult> {
  const context = await loadOwnNoteContext(noteId);
  if (isFailure(context)) return context;
  await db.delete(planNotes).where(eq(planNotes.id, context.note.id));
  refresh();
  return { ok: true };
}
