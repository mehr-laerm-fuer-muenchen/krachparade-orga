import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import type { PlanViewData } from "@/components/plan/plan-view";
import {
  akProgress,
  akSummary,
  attentionItems,
  groupByDepartment,
  ongoingDisplayName,
  type AkDepartmentGroup,
  type AkProgress,
  type AkSummary,
  type AttentionItem,
} from "@/lib/ak-workspace";
import { todayInBerlin } from "@/lib/dday";
import type { PlanNoteView, PlanViewElement } from "@/lib/gantt-layout";
import { displayGroupName } from "@/lib/working-groups";
import { listDepartments } from "./departments";
import { getCurrentEdition } from "./editions";
import { db } from "./index";
import { listMembers } from "./members";
import { loadOngoingElements, loadPlanDetails } from "./plan";
import { loadPlanView } from "./plan-view";
import { meetingItems, meetings, members, workingGroupNotes, type Department } from "./schema";
import { listWorkingGroupMembers, listWorkingGroups } from "./working-groups";

// Spec 018: the AK overview and the AK workspace. The plan comes from
// `loadPlanView` (filtered and computed as on "/"), so the detail panel works
// on these pages as on "/meine". Names only, never e-mail addresses.

export type AkPerson = { id: string; name: string; active: boolean };

export type AkOngoingTodo = { id: string; elementId: string; text: string; ownerName: string | null; done: boolean };

/** "Laufende Aufgaben" of a department; to-dos without a date, notes newest first. */
export type AkOngoing = {
  id: string;
  departmentId: string | null;
  /** "Laufende Aufgaben · ‹Bereich›" */
  displayName: string;
  todos: AkOngoingTodo[];
  notes: PlanNoteView[];
};

export type AkMeetingTodo = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  /** "YYYY-MM-DD" */
  meetingDate: string;
  text: string;
  /** Member or free-text owner. */
  ownerName: string | null;
  dueDate: string | null;
  departmentId: string | null;
  done: boolean;
  createdAt: Date;
};

export type AkDecision = {
  id: string;
  meetingId: string;
  meetingTitle: string;
  meetingDate: string;
  meetingCreatedAt: Date;
  sortOrder: number;
  text: string;
  departmentId: string | null;
};

/** An open plan to-do of an element of the working group, for "Braucht Aufmerksamkeit". */
export type AkPlanTodo = {
  id: string;
  elementId: string;
  text: string;
  ownerName: string | null;
  done: boolean;
  /** For the due text "war fällig 18.12. (3 Tage vor Start)" (spec 023). */
  anchor: "start" | "end";
  daysBefore: number;
  due: number | null;
};

export type AkAttentionItem = AttentionItem<PlanViewElement, AkPlanTodo, AkMeetingTodo>;
export type AkGroup = AkDepartmentGroup<PlanViewElement, AkOngoing, AkMeetingTodo, AkDecision>;

/** Protocol to-dos and decisions with a department, from all meetings of the edition (drafts included). */
async function listDepartmentItems(editionId: string) {
  const rows = await db
    .select({
      id: meetingItems.id,
      kind: meetingItems.kind,
      meetingId: meetings.id,
      meetingTitle: meetings.title,
      meetingDate: meetings.date,
      meetingCreatedAt: meetings.createdAt,
      text: meetingItems.text,
      ownerMemberName: members.name,
      ownerName: meetingItems.ownerName,
      dueDate: meetingItems.dueDate,
      departmentId: meetingItems.departmentId,
      done: meetingItems.done,
      sortOrder: meetingItems.sortOrder,
      createdAt: meetingItems.createdAt,
    })
    .from(meetingItems)
    .innerJoin(meetings, eq(meetings.id, meetingItems.meetingId))
    .leftJoin(members, eq(members.id, meetingItems.ownerId))
    .where(
      and(
        eq(meetings.editionId, editionId),
        inArray(meetingItems.kind, ["todo", "entscheidung"]),
        isNotNull(meetingItems.departmentId)
      )
    )
    .orderBy(desc(meetings.date), desc(meetings.createdAt), asc(meetingItems.sortOrder), asc(meetingItems.createdAt));

  const todos: AkMeetingTodo[] = [];
  const decisions: AkDecision[] = [];
  for (const row of rows) {
    const base = {
      id: row.id,
      meetingId: row.meetingId,
      meetingTitle: row.meetingTitle,
      meetingDate: row.meetingDate,
      text: row.text,
      departmentId: row.departmentId,
    };
    if (row.kind === "todo") {
      todos.push({
        ...base,
        ownerName: row.ownerMemberName ?? row.ownerName,
        dueDate: row.dueDate,
        done: row.done,
        createdAt: row.createdAt,
      });
    } else {
      decisions.push({ ...base, meetingCreatedAt: row.meetingCreatedAt, sortOrder: row.sortOrder });
    }
  }
  return { todos, decisions };
}

/** The "Laufende Aufgaben" elements with their to-dos and notes. */
async function loadOngoing(editionId: string, memberId: string): Promise<AkOngoing[]> {
  const [elements, details] = await Promise.all([loadOngoingElements(editionId), loadPlanDetails(editionId)]);
  return elements.map((element) => ({
    id: element.id,
    departmentId: element.departmentId,
    displayName: ongoingDisplayName(element.departmentName ?? ""),
    todos: details.todos
      .filter((todo) => todo.elementId === element.id)
      .map((todo) => ({ id: todo.id, elementId: todo.elementId, text: todo.text, ownerName: todo.ownerName, done: todo.done })),
    notes: details.notes
      .filter((note) => note.elementId === element.id)
      .map((note) => ({
        id: note.id,
        authorName: note.authorName,
        date: todayInBerlin(note.createdAt),
        text: note.text,
        own: note.authorId === memberId,
        edited: note.updatedAt.getTime() > note.createdAt.getTime(),
      })),
  }));
}

function planTodosOf(elements: readonly PlanViewElement[]): AkPlanTodo[] {
  return elements.flatMap((element) =>
    element.todos.map((todo) => ({
      id: todo.id,
      elementId: element.id,
      text: todo.text,
      ownerName: todo.ownerName,
      done: todo.done,
      anchor: todo.anchor,
      daysBefore: todo.daysBefore,
      due: todo.due,
    }))
  );
}

function departmentsOf(departments: readonly Department[], groupId: string) {
  return departments.filter((department) => department.workingGroupId === groupId);
}

export type AkOverviewCard = {
  id: string;
  /** "AK ‹Name›" */
  title: string;
  departments: string[];
  members: AkPerson[];
  summary: AkSummary;
  progress: AkProgress;
};

export type LoadedAkOverview =
  | { status: "no_edition" }
  | { status: "cycle" }
  | { status: "ok"; final: boolean; dDay: string; cards: AkOverviewCard[] };

/** All working groups of the current edition with their situation (spec 018). `today` = "YYYY-MM-DD". */
export const loadAkOverview = cache(async (memberId: string, today: string): Promise<LoadedAkOverview> => {
  const edition = await getCurrentEdition();
  if (!edition) return { status: "no_edition" };
  const [view, groups, memberships, departments, ongoing, items] = await Promise.all([
    loadPlanView(edition, memberId, today),
    listWorkingGroups(edition.id),
    listWorkingGroupMembers(edition.id),
    listDepartments(edition.id),
    loadOngoingElements(edition.id),
    listDepartmentItems(edition.id),
  ]);
  if (view.status === "cycle") return { status: "cycle" };
  const elements = view.status === "ok" ? view.data.elements : [];
  const details = ongoing.length > 0 ? await loadPlanDetails(edition.id) : { todos: [], notes: [] };

  const cards = groups.map((group) => {
    const own = departmentsOf(departments, group.id);
    const departmentIds = new Set(own.map((department) => department.id));
    const groupElements = elements.filter((element) => element.workingGroupId === group.id);
    const ongoingIds = ongoing.filter((element) => element.workingGroupId === group.id).map((element) => element.id);
    const ongoingSet = new Set(ongoingIds);
    const ongoingTodos = details.todos.filter((todo) => ongoingSet.has(todo.elementId));
    const meetingTodos = items.todos.filter((todo) => todo.departmentId !== null && departmentIds.has(todo.departmentId));
    return {
      id: group.id,
      title: displayGroupName(group.name),
      departments: own.map((department) => department.name),
      members: memberships
        .filter((row) => row.workingGroupId === group.id)
        .map((row) => ({ id: row.memberId, name: row.name, active: row.active })),
      summary: akSummary(
        {
          dDay: edition.dDay,
          elements: groupElements,
          ongoingIds,
          planTodos: [...planTodosOf(groupElements), ...ongoingTodos],
          meetingTodos,
        },
        today
      ),
      progress: akProgress({ elements: groupElements, ongoingTodos, meetingTodos }),
    };
  });
  return { status: "ok", final: edition.workingGroupsFinal, dDay: edition.dDay, cards };
});

export type LoadedAkWorkspace =
  | { status: "not_found" }
  | { status: "cycle"; title: string }
  | {
      status: "ok";
      group: { id: string; name: string; title: string };
      dDay: string;
      members: AkPerson[];
      /** Who can be entered for a point: the AK's active members first, then all other active members. */
      people: { id: string; name: string }[];
      departments: { id: string; name: string; sortOrder: number }[];
      /** For the detail panel and the cards; null without plan elements. */
      plan: PlanViewData | null;
      attention: AkAttentionItem[];
      groups: AkGroup[];
      notes: PlanNoteView[];
    };

/**
 * One working group of the current edition (spec 018): plan elements, its
 * "Laufende Aufgaben", protocol to-dos and decisions of its departments and
 * its notes. Unknown or invalid ids, other editions → `not_found`.
 */
export const loadAkWorkspace = cache(
  async (workingGroupId: string, memberId: string, today: string): Promise<LoadedAkWorkspace> => {
    const id = z.uuid().safeParse(workingGroupId);
    const edition = await getCurrentEdition();
    if (!id.success || !edition) return { status: "not_found" };
    const groups = await listWorkingGroups(edition.id);
    const group = groups.find((candidate) => candidate.id === id.data);
    if (!group) return { status: "not_found" };
    const title = displayGroupName(group.name);

    const [view, memberships, departments, ongoing, items, noteRows, people] = await Promise.all([
      loadPlanView(edition, memberId, today),
      listWorkingGroupMembers(edition.id),
      listDepartments(edition.id),
      loadOngoing(edition.id, memberId),
      listDepartmentItems(edition.id),
      db
        .select({
          id: workingGroupNotes.id,
          authorId: workingGroupNotes.authorId,
          authorName: members.name,
          text: workingGroupNotes.text,
          createdAt: workingGroupNotes.createdAt,
          updatedAt: workingGroupNotes.updatedAt,
        })
        .from(workingGroupNotes)
        .innerJoin(members, eq(members.id, workingGroupNotes.authorId))
        .where(eq(workingGroupNotes.workingGroupId, group.id))
        .orderBy(desc(workingGroupNotes.createdAt)),
      listMembers(),
    ]);
    if (view.status === "cycle") return { status: "cycle", title };

    const plan = view.status === "ok" ? view.data : null;
    const elements = (plan?.elements ?? []).filter((element) => element.workingGroupId === group.id);
    const own = departmentsOf(departments, group.id).map((department) => ({
      id: department.id,
      name: department.name,
      sortOrder: department.sortOrder,
    }));
    const departmentIds = new Set(own.map((department) => department.id));
    const ownOngoing = ongoing.filter(
      (element) => element.departmentId !== null && departmentIds.has(element.departmentId)
    );
    const meetingTodos = items.todos.filter(
      (todo) => todo.departmentId !== null && departmentIds.has(todo.departmentId)
    );
    const decisions = items.decisions.filter(
      (decision) => decision.departmentId !== null && departmentIds.has(decision.departmentId)
    );
    const groupMembers = memberships
      .filter((row) => row.workingGroupId === group.id)
      .map((row) => ({ id: row.memberId, name: row.name, active: row.active }));
    const memberIds = new Set(groupMembers.map((person) => person.id));
    const active = people
      .filter((person) => person.active)
      .map((person) => ({ id: person.id, name: person.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    return {
      status: "ok",
      group: { id: group.id, name: group.name, title },
      dDay: edition.dDay,
      members: groupMembers,
      people: [
        ...active.filter((person) => memberIds.has(person.id)),
        ...active.filter((person) => !memberIds.has(person.id)),
      ],
      departments: own,
      plan,
      attention: attentionItems(
        { dDay: edition.dDay, elements, planTodos: planTodosOf(elements), meetingTodos },
        today
      ),
      groups: groupByDepartment(own, elements, ownOngoing, meetingTodos, decisions),
      notes: noteRows.map((note) => ({
        id: note.id,
        authorName: note.authorName,
        date: todayInBerlin(note.createdAt),
        text: note.text,
        own: note.authorId === memberId,
        edited: note.updatedAt.getTime() > note.createdAt.getTime(),
      })),
    };
  }
);
