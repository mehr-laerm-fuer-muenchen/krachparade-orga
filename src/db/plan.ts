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
};

export type LoadedPlan = {
  dDay: string;
  elements: LoadedPlanElement[];
  links: PlanLinkInput[];
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
      })
      .from(planElements)
      .leftJoin(workingGroups, eq(workingGroups.id, planElements.workingGroupId))
      .leftJoin(departments, eq(departments.id, planElements.departmentId))
      .leftJoin(members, eq(members.id, planElements.ownerId))
      .where(eq(planElements.editionId, editionId))
      .orderBy(asc(planElements.sortOrder), asc(planElements.name)),
    db
      .select({ fromId: planLinks.fromElementId, toId: planLinks.toElementId, lagDays: planLinks.lagDays })
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

export type LoadedPlanNote = { id: string; elementId: string; authorName: string; createdAt: Date; text: string };

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
        authorName: members.name,
        createdAt: planNotes.createdAt,
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
