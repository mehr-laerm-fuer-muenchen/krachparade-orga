import { and, asc, count, desc, eq } from "drizzle-orm";
import { dateToDay } from "@/lib/plan-days";
import type { PlanElementInput, PlanElementKind, PlanLinkInput } from "@/lib/plan-engine";
import { db } from "./index";
import {
  departments,
  editions,
  members,
  planElements,
  planLinks,
  planChanges,
  planNotes,
  planTodos,
  workingGroups,
} from "./schema";

/** A plan element ready for the engine, with names for display (never e-mail addresses). */
export type LoadedPlanElement = PlanElementInput & {
  name: string;
  fixedDate: string | null;
  workingGroupId: string | null;
  workingGroupName: string | null;
  workingGroupSortOrder: number | null;
  departmentId: string | null;
  departmentName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  openTodos: number;
  /** Last change, for the conflict notice (spec 008). */
  updatedAt: Date;
};

/** A link with its id (spec 008: the panel changes and removes links by id). */
export type LoadedPlanLink = PlanLinkInput & { id: string };

export type LoadedPlan = {
  dDay: string;
  elements: LoadedPlanElement[];
  links: LoadedPlanLink[];
};

/** The plan of an edition (spec 006): elements, links and open to-dos per element. Read only. */
export async function loadPlan(editionId: string): Promise<LoadedPlan> {
  const [edition] = await db
    .select({ dDay: editions.dDay })
    .from(editions)
    .where(eq(editions.id, editionId))
    .limit(1);
  if (!edition) {
    throw new Error("Ausgabe nicht gefunden.");
  }

  const [rows, linkRows, todoRows] = await Promise.all([
    db
      .select({
        id: planElements.id,
        kind: planElements.kind,
        name: planElements.name,
        durationDays: planElements.durationDays,
        shiftDays: planElements.shiftDays,
        fixedDate: planElements.fixedDate,
        done: planElements.done,
        wobbly: planElements.wobbly,
        sortOrder: planElements.sortOrder,
        workingGroupId: planElements.workingGroupId,
        workingGroupName: workingGroups.name,
        workingGroupSortOrder: workingGroups.sortOrder,
        departmentId: planElements.departmentId,
        departmentName: departments.name,
        ownerId: planElements.ownerId,
        ownerName: members.name,
        updatedAt: planElements.updatedAt,
      })
      .from(planElements)
      .leftJoin(workingGroups, eq(workingGroups.id, planElements.workingGroupId))
      .leftJoin(departments, eq(departments.id, planElements.departmentId))
      .leftJoin(members, eq(members.id, planElements.ownerId))
      .where(eq(planElements.editionId, editionId))
      .orderBy(asc(planElements.sortOrder), asc(planElements.name)),
    db
      .select({
        id: planLinks.id,
        fromId: planLinks.fromElementId,
        toId: planLinks.toElementId,
        lagDays: planLinks.lagDays,
      })
      .from(planLinks)
      .where(eq(planLinks.editionId, editionId)),
    db
      .select({ elementId: planTodos.elementId, total: count() })
      .from(planTodos)
      .innerJoin(planElements, eq(planElements.id, planTodos.elementId))
      .where(and(eq(planElements.editionId, editionId), eq(planTodos.done, false)))
      .groupBy(planTodos.elementId),
  ]);

  const openTodos = new Map(todoRows.map((row) => [row.elementId, row.total]));
  return {
    dDay: edition.dDay,
    elements: rows.map((row) => ({
      ...row,
      kind: row.kind as PlanElementKind,
      fixedDay: row.fixedDate === null ? null : dateToDay(row.fixedDate, edition.dDay),
      openTodos: openTodos.get(row.id) ?? 0,
    })),
    links: linkRows,
  };
}

export type LoadedPlanTodo = {
  id: string;
  elementId: string;
  text: string;
  ownerName: string | null;
  anchor: "start" | "end";
  daysBefore: number;
  done: boolean;
};

export type LoadedPlanNote = {
  id: string;
  elementId: string;
  authorId: string;
  authorName: string;
  createdAt: Date;
  /** Later than `createdAt` once the note was edited (spec 008). */
  updatedAt: Date;
  text: string;
};

/**
 * To-dos (in their order) and notes (newest first) of an edition's plan for
 * the detail panel (spec 007). Names only, never e-mail addresses. Read only.
 */
export async function loadPlanDetails(
  editionId: string
): Promise<{ todos: LoadedPlanTodo[]; notes: LoadedPlanNote[] }> {
  const [todos, notes] = await Promise.all([
    db
      .select({
        id: planTodos.id,
        elementId: planTodos.elementId,
        text: planTodos.text,
        ownerName: members.name,
        anchor: planTodos.anchor,
        daysBefore: planTodos.daysBefore,
        done: planTodos.done,
      })
      .from(planTodos)
      .innerJoin(planElements, eq(planElements.id, planTodos.elementId))
      .leftJoin(members, eq(members.id, planTodos.ownerId))
      .where(eq(planElements.editionId, editionId))
      .orderBy(asc(planTodos.sortOrder), asc(planTodos.createdAt)),
    db
      .select({
        id: planNotes.id,
        elementId: planNotes.elementId,
        authorId: planNotes.authorId,
        authorName: members.name,
        createdAt: planNotes.createdAt,
        updatedAt: planNotes.updatedAt,
        text: planNotes.text,
      })
      .from(planNotes)
      .innerJoin(planElements, eq(planElements.id, planNotes.elementId))
      .innerJoin(members, eq(members.id, planNotes.authorId))
      .where(eq(planElements.editionId, editionId))
      .orderBy(desc(planNotes.createdAt)),
  ]);
  return {
    todos: todos.map((todo) => ({ ...todo, anchor: todo.anchor === "end" ? "end" : "start" })),
    notes,
  };
}

/**
 * Choices of the detail panel (spec 008): departments with their working
 * group and active members. Names only, never e-mail addresses.
 */
export async function loadPlanOptions(editionId: string) {
  const [departmentRows, memberRows] = await Promise.all([
    db
      .select({ id: departments.id, name: departments.name, workingGroupId: departments.workingGroupId })
      .from(departments)
      .where(eq(departments.editionId, editionId))
      .orderBy(asc(departments.sortOrder), asc(departments.name)),
    db
      .select({ id: members.id, name: members.name })
      .from(members)
      .where(eq(members.active, true))
      .orderBy(asc(members.name)),
  ]);
  return { departments: departmentRows, members: memberRows };
}

export type LoadedPlanChange = { id: string; memberName: string | null; createdAt: Date; summary: string };

/**
 * Change history of one plan element (spec 008): the newest `limit` entries
 * (newest first) with the name of who changed it, plus the total count.
 */
export async function loadPlanChanges(
  elementId: string,
  limit: number
): Promise<{ changes: LoadedPlanChange[]; total: number }> {
  const [changes, [{ total }]] = await Promise.all([
    db
      .select({
        id: planChanges.id,
        memberName: members.name,
        createdAt: planChanges.createdAt,
        summary: planChanges.summary,
      })
      .from(planChanges)
      .leftJoin(members, eq(members.id, planChanges.memberId))
      .where(eq(planChanges.elementId, elementId))
      .orderBy(desc(planChanges.createdAt), desc(planChanges.id))
      .limit(limit),
    db.select({ total: count() }).from(planChanges).where(eq(planChanges.elementId, elementId)),
  ]);
  return { changes, total };
}
