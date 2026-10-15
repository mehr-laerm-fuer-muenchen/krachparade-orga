"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { revalidateMyTasks } from "@/actions/revalidate-my-tasks";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { loadPlan } from "@/db/plan";
import { meetingItems, meetings, members, planChanges, planElements, planTodos, type Member } from "@/db/schema";
import { changeSummaries, snapshotOf, type ElementState } from "@/lib/plan-edit";

// Spec 009: "Übernehmen" in "Aus meinen AKs – noch niemand eingetragen".
// Every active member may take over any open entry of the current edition,
// but only while nobody is entered yet: the update itself checks that, so two
// people taking over at the same time cannot both win. Ticking off uses the
// existing actions (setDone, toggleTodo, setTodoDone). Texts are never logged.

export type ClaimResult = { ok: true } | { ok: false; message: string };

const NO_ACCESS = "Kein Zugriff.";
const NO_EDITION = "Keine aktuelle Ausgabe gefunden.";
const NOT_FOUND = "Diesen Eintrag gibt es nicht.";
const INVALID = "Ungültige Eingabe.";
const SAVE_ERROR = "Konnte nicht gespeichert werden.";

function fail(message: string): ClaimResult {
  return { ok: false, message };
}

function takenBy(name: string | null): ClaimResult {
  return fail(`Hat inzwischen ${name ?? "jemand anderes"} übernommen.`);
}

const claimInput = z.object({
  kind: z.enum(["element", "plan_todo", "meeting_todo"]),
  id: z.uuid(),
});

type Context = { actor: Member; editionId: string };

/** The signed-in member (active, from the database) and the current edition. */
async function loadContext(): Promise<Context | ClaimResult> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  if (!actor?.active) return fail(NO_ACCESS);
  const edition = await getCurrentEdition();
  if (!edition) return fail(NO_EDITION);
  return { actor, editionId: edition.id };
}

/** Sets the signed-in member as owner of an element, plan to-do or protocol to-do nobody owns yet. */
export async function claimItem(input: z.input<typeof claimInput>): Promise<ClaimResult> {
  const context = await loadContext();
  if (!("actor" in context)) return context;
  const parsed = claimInput.safeParse(input);
  if (!parsed.success) return fail(INVALID);
  const { kind, id } = parsed.data;

  let result: ClaimResult;
  try {
    if (kind === "element") result = await claimElement(context, id);
    else if (kind === "plan_todo") result = await claimPlanTodo(context, id);
    else result = await claimMeetingTodo(context, id);
  } catch {
    return fail(SAVE_ERROR);
  }
  if (result.ok) {
    refresh();
    revalidateMyTasks();
  }
  return result;
}

async function claimElement({ actor, editionId }: Context, id: string): Promise<ClaimResult> {
  const plan = await loadPlan(editionId);
  const element = plan.elements.find((candidate) => candidate.id === id);
  if (!element) return fail(NOT_FOUND);
  if (element.ownerId !== null) return takenBy(element.ownerName);

  const before: ElementState & { id: string } = {
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
  // "Verantwortlich: ‹Name›"
  const [summary] = changeSummaries(
    snapshotOf(before, plan.links),
    snapshotOf({ ...before, ownerId: actor.id }, plan.links),
    new Map([[actor.id, actor.name]])
  );

  // One transaction: the history row is only written if the update took place
  // (owner and `updated_at` are exactly what this call set).
  const now = new Date();
  const [claimed] = await db.batch([
    db
      .update(planElements)
      .set({ ownerId: actor.id, updatedAt: now, updatedBy: actor.id })
      .where(and(eq(planElements.id, element.id), eq(planElements.editionId, editionId), isNull(planElements.ownerId)))
      .returning({ id: planElements.id }),
    db.insert(planChanges).select(
      db
        .select({
          id: sql<string>`gen_random_uuid()`.as("id"),
          elementId: planElements.id,
          memberId: planElements.updatedBy,
          summary: sql<string>`${summary}::text`.as("summary"),
          createdAt: planElements.updatedAt,
        })
        .from(planElements)
        .where(
          and(
            eq(planElements.id, element.id),
            eq(planElements.ownerId, actor.id),
            eq(planElements.updatedBy, actor.id),
            eq(planElements.updatedAt, now)
          )
        )
    ),
  ]);
  if (claimed.length > 0) return { ok: true };

  const [current] = await db
    .select({ ownerName: members.name })
    .from(planElements)
    .leftJoin(members, eq(members.id, planElements.ownerId))
    .where(eq(planElements.id, element.id))
    .limit(1);
  return current ? takenBy(current.ownerName) : fail(NOT_FOUND);
}

async function claimPlanTodo({ actor, editionId }: Context, id: string): Promise<ClaimResult> {
  const [todo] = await db
    .select({ id: planTodos.id, ownerName: members.name, ownerId: planTodos.ownerId })
    .from(planTodos)
    .innerJoin(planElements, eq(planElements.id, planTodos.elementId))
    .leftJoin(members, eq(members.id, planTodos.ownerId))
    .where(and(eq(planTodos.id, id), eq(planElements.editionId, editionId)))
    .limit(1);
  if (!todo) return fail(NOT_FOUND);
  if (todo.ownerId !== null) return takenBy(todo.ownerName);

  const claimed = await db
    .update(planTodos)
    .set({ ownerId: actor.id, updatedAt: new Date() })
    .where(and(eq(planTodos.id, todo.id), isNull(planTodos.ownerId)))
    .returning({ id: planTodos.id });
  if (claimed.length > 0) return { ok: true };

  const [current] = await db
    .select({ ownerName: members.name })
    .from(planTodos)
    .leftJoin(members, eq(members.id, planTodos.ownerId))
    .where(eq(planTodos.id, todo.id))
    .limit(1);
  return current ? takenBy(current.ownerName) : fail(NOT_FOUND);
}

/** Owner of a protocol to-do: a member or a free-text name. */
async function meetingTodoOwner(id: string) {
  const [row] = await db
    .select({ memberName: members.name, ownerName: meetingItems.ownerName })
    .from(meetingItems)
    .leftJoin(members, eq(members.id, meetingItems.ownerId))
    .where(eq(meetingItems.id, id))
    .limit(1);
  return row ? (row.memberName ?? row.ownerName) : undefined;
}

async function claimMeetingTodo({ actor, editionId }: Context, id: string): Promise<ClaimResult> {
  const [item] = await db
    .select({ id: meetingItems.id, meetingId: meetingItems.meetingId, ownerId: meetingItems.ownerId, ownerName: meetingItems.ownerName })
    .from(meetingItems)
    .innerJoin(meetings, eq(meetings.id, meetingItems.meetingId))
    .where(and(eq(meetingItems.id, id), eq(meetingItems.kind, "todo"), eq(meetings.editionId, editionId)))
    .limit(1);
  if (!item) return fail(NOT_FOUND);
  if (item.ownerId !== null || item.ownerName) return takenBy((await meetingTodoOwner(item.id)) ?? null);

  const now = new Date();
  const claimed = await db
    .update(meetingItems)
    .set({ ownerId: actor.id, updatedAt: now })
    .where(and(eq(meetingItems.id, item.id), isNull(meetingItems.ownerId), isNull(meetingItems.ownerName)))
    .returning({ id: meetingItems.id });
  if (claimed.length === 0) {
    const owner = await meetingTodoOwner(item.id);
    return owner === undefined ? fail(NOT_FOUND) : takenBy(owner);
  }
  await db.update(meetings).set({ updatedAt: now }).where(eq(meetings.id, item.meetingId));
  return { ok: true };
}
