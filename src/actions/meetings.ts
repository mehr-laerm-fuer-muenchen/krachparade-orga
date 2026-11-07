"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revalidateMyTasks } from "@/actions/revalidate-my-tasks";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMeeting, listMeetingItems } from "@/db/meetings";
import { findMemberById } from "@/db/members";
import { departments, meetingAttendees, meetingItems, meetings, members, type Member } from "@/db/schema";
import { todayInBerlin } from "@/lib/dday";
import { moveItem } from "@/lib/permissions";
import { SUMMARY_MAX } from "@/lib/protocol-read";
import { canDeleteMeeting, groupByTopic, ITEM_KINDS, MEETING_STATUSES } from "@/lib/protocol-rules";

// Spec 004: everyone who is signed in and active may edit everything. Every
// action loads the acting member from the database (the session alone is not
// enough), validates its input with Zod and checks ids against the database.
// Concurrent edits: the last change wins. Item texts and notes are never
// logged.

export type MeetingActionResult = { ok: true } | { ok: false; message: string };

const NO_ACCESS = "Kein Zugriff.";
const NOT_FOUND = "Dieses Treffen gibt es nicht.";
const ITEM_NOT_FOUND = "Diesen Punkt gibt es nicht.";
const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";
const DELETE_DENIED = "Nur Admins oder wer das Treffen angelegt hat, können es löschen.";

function fail(message: string): MeetingActionResult {
  return { ok: false, message };
}

const OK: MeetingActionResult = { ok: true };

/** The signed-in member, loaded from the database; null unless active. */
async function loadActor(): Promise<Member | null> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  return actor?.active ? actor : null;
}

type Context = { actor: Member; editionId: string };

async function loadContext(): Promise<Context | MeetingActionResult> {
  const actor = await loadActor();
  if (!actor) return fail(NO_ACCESS);
  const edition = await getCurrentEdition();
  if (!edition) return fail("Keine aktuelle Ausgabe gefunden.");
  return { actor, editionId: edition.id };
}

function isContext(value: Context | MeetingActionResult): value is Context {
  return "actor" in value;
}

/** Actor plus the meeting, which must belong to the current edition. */
async function loadMeetingContext(meetingId: unknown) {
  const context = await loadContext();
  if (!isContext(context)) return context;
  const id = z.uuid().safeParse(meetingId);
  if (!id.success) return fail(NOT_FOUND);
  const meeting = await findMeeting(id.data, context.editionId);
  if (!meeting) return fail(NOT_FOUND);
  return { ...context, meeting };
}

/** Actor plus the item and its meeting (current edition only). */
async function loadItemContext(itemId: unknown) {
  const context = await loadContext();
  if (!isContext(context)) return context;
  const id = z.uuid().safeParse(itemId);
  if (!id.success) return fail(ITEM_NOT_FOUND);
  const [row] = await db
    .select({ item: meetingItems, meeting: meetings })
    .from(meetingItems)
    .innerJoin(meetings, eq(meetings.id, meetingItems.meetingId))
    .where(and(eq(meetingItems.id, id.data), eq(meetings.editionId, context.editionId)))
    .limit(1);
  if (!row) return fail(ITEM_NOT_FOUND);
  return { ...context, ...row };
}

function touchMeeting(meetingId: string) {
  return db.update(meetings).set({ updatedAt: new Date() }).where(eq(meetings.id, meetingId));
}

/** All given member ids exist. */
async function membersExist(ids: readonly (string | null)[]): Promise<boolean> {
  const wanted = [...new Set(ids.filter((id): id is string => id !== null))];
  if (wanted.length === 0) return true;
  const found = await db.select({ id: members.id }).from(members).where(inArray(members.id, wanted));
  return found.length === wanted.length;
}

async function departmentInEdition(departmentId: string | null, editionId: string): Promise<boolean> {
  if (departmentId === null) return true;
  const [department] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.id, departmentId), eq(departments.editionId, editionId)))
    .limit(1);
  return Boolean(department);
}

// --- Meetings ---------------------------------------------------------------

/** Creates a meeting dated today (Berlin) in the current edition and opens it. */
export async function createMeeting(): Promise<void> {
  const context = await loadContext();
  if (!isContext(context)) redirect("/protokolle");
  const [meeting] = await db
    .insert(meetings)
    .values({
      editionId: context.editionId,
      date: todayInBerlin(new Date()),
      createdBy: context.actor.id,
    })
    .returning({ id: meetings.id });
  redirect(`/protokolle/${meeting.id}`);
}

const optionalMemberId = z.union([z.literal(""), z.uuid()]).transform((value) => value || null);

const meetingHeadInput = z
  .object({
    date: z.iso.date("Bitte ein gültiges Datum eingeben."),
    title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(200, "Der Titel ist zu lang."),
    place: z.string().trim().max(200, "Der Ort ist zu lang."),
    moderatorId: optionalMemberId,
    minuteTakerId: optionalMemberId,
    guests: z.string().trim().max(1000, "Zu viel Text bei den Gästen."),
  })
  .partial();

export type MeetingHeadInput = z.input<typeof meetingHeadInput>;

/** Changes one or more head fields (date, title, place, moderation …). */
export async function updateMeetingHead(
  meetingId: string,
  input: MeetingHeadInput
): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = meetingHeadInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const values = parsed.data;
  if (!(await membersExist([values.moderatorId ?? null, values.minuteTakerId ?? null]))) {
    return fail("Diese Person gibt es nicht.");
  }
  await db
    .update(meetings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(meetings.id, context.meeting.id));
  refresh();
  revalidateMyTasks();
  return OK;
}

/** Marks one member as present or absent. */
export async function setAttendance(
  meetingId: string,
  memberId: string,
  present: boolean
): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = z.object({ memberId: z.uuid(), present: z.boolean() }).safeParse({ memberId, present });
  if (!parsed.success || !(await membersExist([parsed.data.memberId]))) {
    return fail("Diese Person gibt es nicht.");
  }
  const change = parsed.data.present
    ? db
        .insert(meetingAttendees)
        .values({ meetingId: context.meeting.id, memberId: parsed.data.memberId })
        .onConflictDoNothing()
    : db
        .delete(meetingAttendees)
        .where(
          and(
            eq(meetingAttendees.meetingId, context.meeting.id),
            eq(meetingAttendees.memberId, parsed.data.memberId)
          )
        );
  await db.batch([change, touchMeeting(context.meeting.id)]);
  refresh();
  return OK;
}

/** Draft or final; "final" is only a marker and locks nothing. */
export async function setMeetingStatus(meetingId: string, status: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = z.enum(MEETING_STATUSES).safeParse(status);
  if (!parsed.success) return fail(GENERIC_ERROR);
  await db
    .update(meetings)
    .set({ status: parsed.data, updatedAt: new Date() })
    .where(eq(meetings.id, context.meeting.id));
  refresh();
  return OK;
}

const notesInput = z.string().max(200_000, "Die Notiz ist zu lang (höchstens 200 000 Zeichen).");

export async function saveMeetingNotes(meetingId: string, rawNotes: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = notesInput.safeParse(rawNotes);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  await db
    .update(meetings)
    .set({ rawNotes: parsed.data, updatedAt: new Date() })
    .where(eq(meetings.id, context.meeting.id));
  refresh();
  return OK;
}

const summaryInput = z
  .string()
  .trim()
  .max(SUMMARY_MAX, "Die Kurzfassung ist zu lang (höchstens 2000 Zeichen).")
  .transform((value) => value || null);

/** A few sentences on top of the read view (spec 017); empty clears it. */
export async function saveMeetingSummary(meetingId: string, summary: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = summaryInput.safeParse(summary);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  await db
    .update(meetings)
    .set({ summary: parsed.data, updatedAt: new Date() })
    .where(eq(meetings.id, context.meeting.id));
  refresh();
  return OK;
}

/** Admins and the creator only, checked with `active`/`is_admin` from the database. */
export async function deleteMeeting(meetingId: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  if (!canDeleteMeeting(context.actor, context.meeting)) return fail(DELETE_DENIED);
  // Attendees and items go with it (ON DELETE CASCADE).
  await db.delete(meetings).where(eq(meetings.id, context.meeting.id));
  revalidateMyTasks();
  redirect("/protokolle");
}

// --- Items ------------------------------------------------------------------

const topicInput = z.string().trim().min(1, "Bitte eine Überschrift eingeben.").max(200, "Die Überschrift ist zu lang.");

const itemFields = z
  .object({
    kind: z.enum(ITEM_KINDS),
    text: z.string().trim().min(1, "Bitte einen Text eingeben.").max(2000, "Der Text ist zu lang (höchstens 2000 Zeichen)."),
    ownerId: z.uuid().nullable(),
    ownerName: z
      .string()
      .trim()
      .max(80, "Der Name ist zu lang (höchstens 80 Zeichen).")
      .nullable()
      .transform((value) => value || null),
    dueDate: z.iso.date("Bitte ein gültiges Datum eingeben.").nullable(),
    departmentId: z.uuid().nullable(),
  })
  .refine((item) => !(item.ownerId && item.ownerName), {
    message: "Bitte entweder ein Mitglied oder einen Namen ohne Account wählen.",
  })
  // Only to-dos have an owner, a due date and a done state.
  .transform((item) =>
    item.kind === "todo" ? item : { ...item, ownerId: null, ownerName: null, dueDate: null }
  );

export type ItemFields = z.input<typeof itemFields>;

async function checkItemRefs(
  fields: z.output<typeof itemFields>,
  editionId: string
): Promise<MeetingActionResult | null> {
  if (!(await membersExist([fields.ownerId]))) return fail("Diese Person gibt es nicht.");
  if (!(await departmentInEdition(fields.departmentId, editionId))) {
    return fail("Diesen Aufgabenbereich gibt es nicht.");
  }
  return null;
}

/** Adds an item at the end of its TOP (a new TOP is saved with its first item). */
export async function createMeetingItem(
  meetingId: string,
  topic: string,
  input: ItemFields
): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsedTopic = topicInput.safeParse(topic);
  if (!parsedTopic.success) return fail(parsedTopic.error.issues[0]?.message ?? GENERIC_ERROR);
  const parsed = itemFields.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const denied = await checkItemRefs(parsed.data, context.editionId);
  if (denied) return denied;

  // A TOP takes the position of its first item, so appending keeps the order.
  const [{ last }] = await db
    .select({ last: max(meetingItems.sortOrder) })
    .from(meetingItems)
    .where(eq(meetingItems.meetingId, context.meeting.id));
  await db.batch([
    db.insert(meetingItems).values({
      ...parsed.data,
      meetingId: context.meeting.id,
      topic: parsedTopic.data,
      sortOrder: (last ?? 0) + 1,
      createdBy: context.actor.id,
    }),
    touchMeeting(context.meeting.id),
  ]);
  refresh();
  revalidateMyTasks();
  return OK;
}

export async function updateMeetingItem(itemId: string, input: ItemFields): Promise<MeetingActionResult> {
  const context = await loadItemContext(itemId);
  if (!("item" in context)) return context;
  const parsed = itemFields.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const denied = await checkItemRefs(parsed.data, context.editionId);
  if (denied) return denied;

  const todo = parsed.data.kind === "todo";
  await db.batch([
    db
      .update(meetingItems)
      .set({
        ...parsed.data,
        done: todo ? context.item.done : false,
        doneAt: todo ? context.item.doneAt : null,
        updatedAt: new Date(),
      })
      .where(eq(meetingItems.id, context.item.id)),
    touchMeeting(context.meeting.id),
  ]);
  refresh();
  revalidateMyTasks();
  return OK;
}

export async function deleteMeetingItem(itemId: string): Promise<MeetingActionResult> {
  const context = await loadItemContext(itemId);
  if (!("item" in context)) return context;
  await db.batch([
    db.delete(meetingItems).where(eq(meetingItems.id, context.item.id)),
    touchMeeting(context.meeting.id),
  ]);
  refresh();
  revalidateMyTasks();
  return OK;
}

/** Ticks a to-do off or opens it again (sets or clears `done_at`). */
export async function setTodoDone(itemId: string, done: boolean): Promise<MeetingActionResult> {
  const context = await loadItemContext(itemId);
  if (!("item" in context)) return context;
  const parsed = z.boolean().safeParse(done);
  if (!parsed.success) return fail(GENERIC_ERROR);
  if (context.item.kind !== "todo") return fail("Nur To-dos lassen sich abhaken.");
  const now = new Date();
  await db.batch([
    db
      .update(meetingItems)
      .set({ done: parsed.data, doneAt: parsed.data ? now : null, updatedAt: now })
      .where(eq(meetingItems.id, context.item.id)),
    touchMeeting(context.meeting.id),
  ]);
  refresh();
  revalidateMyTasks();
  return OK;
}

const direction = z.enum(["up", "down"]);

/** Rewrites the positions of all items of a meeting as 1, 2, 3 … in one transaction. */
async function saveOrder(meetingId: string, ids: readonly string[]) {
  const now = new Date();
  await db.batch([
    touchMeeting(meetingId),
    ...ids.map((id, index) =>
      db.update(meetingItems).set({ sortOrder: index + 1, updatedAt: now }).where(eq(meetingItems.id, id))
    ),
  ]);
}

/** Moves an item one step up or down within its TOP. */
export async function moveMeetingItem(itemId: string, to: string): Promise<MeetingActionResult> {
  const context = await loadItemContext(itemId);
  if (!("item" in context)) return context;
  const parsed = direction.safeParse(to);
  if (!parsed.success) return fail(GENERIC_ERROR);

  const topics = groupByTopic(await listMeetingItems(context.meeting.id)).map(({ topic, items }) => {
    const ids = items.map((item) => item.id);
    return topic === context.item.topic ? (moveItem(ids, context.item.id, parsed.data) ?? ids) : ids;
  });
  await saveOrder(context.meeting.id, topics.flat());
  refresh();
  return OK;
}

/** Moves a whole TOP one step up or down. */
export async function moveTopic(meetingId: string, topic: string, to: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = z.object({ topic: z.string(), to: direction }).safeParse({ topic, to });
  if (!parsed.success) return fail(GENERIC_ERROR);

  const topics = groupByTopic(await listMeetingItems(context.meeting.id));
  const order = moveItem(
    topics.map((entry) => entry.topic),
    parsed.data.topic,
    parsed.data.to
  );
  if (!order) return OK;
  const byTopic = new Map(topics.map((entry) => [entry.topic, entry.items.map((item) => item.id)]));
  await saveOrder(
    context.meeting.id,
    order.flatMap((name) => byTopic.get(name) ?? [])
  );
  refresh();
  return OK;
}

/**
 * Deletes a TOP with all its items (spec 029). Same rights as deleting an
 * item: every active member. A TOP without items is fine too.
 */
export async function deleteTopic(meetingId: string, topic: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsed = z.string().min(1).max(200).safeParse(topic);
  if (!parsed.success) return fail(GENERIC_ERROR);
  await db.batch([
    db
      .delete(meetingItems)
      .where(and(eq(meetingItems.meetingId, context.meeting.id), eq(meetingItems.topic, parsed.data))),
    touchMeeting(context.meeting.id),
  ]);
  refresh();
  // Its to-dos leave "Meine Aufgaben" and the AK workspace too.
  revalidateMyTasks();
  return OK;
}

/** Renames a TOP: changes `topic` of all its items in this meeting. */
export async function renameTopic(meetingId: string, from: string, to: string): Promise<MeetingActionResult> {
  const context = await loadMeetingContext(meetingId);
  if (!("meeting" in context)) return context;
  const parsedFrom = z.string().safeParse(from);
  const parsedTo = topicInput.safeParse(to);
  if (!parsedFrom.success) return fail(GENERIC_ERROR);
  if (!parsedTo.success) return fail(parsedTo.error.issues[0]?.message ?? GENERIC_ERROR);
  const now = new Date();
  await db.batch([
    db
      .update(meetingItems)
      .set({ topic: parsedTo.data, updatedAt: now })
      .where(and(eq(meetingItems.meetingId, context.meeting.id), eq(meetingItems.topic, parsedFrom.data))),
    touchMeeting(context.meeting.id),
  ]);
  refresh();
  return OK;
}
