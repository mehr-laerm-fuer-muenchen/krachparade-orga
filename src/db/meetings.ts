import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { meetingAttendees, meetingItems, meetings, type Meeting, type MeetingItem } from "./schema";

/** The meeting, only if it belongs to `editionId`. */
export async function findMeeting(id: string, editionId: string): Promise<Meeting | undefined> {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.editionId, editionId)))
    .limit(1);
  return meeting;
}

export type MeetingSummary = Pick<Meeting, "id" | "date" | "title" | "status"> & {
  decisions: number;
  openTodos: number;
};

/** Meetings of an edition, newest date first, with their counts. */
export async function listMeetings(editionId: string): Promise<MeetingSummary[]> {
  const rows = await db
    .select({
      id: meetings.id,
      date: meetings.date,
      title: meetings.title,
      status: meetings.status,
      decisions: count(sql`case when ${meetingItems.kind} = 'entscheidung' then 1 end`),
      openTodos: count(
        sql`case when ${meetingItems.kind} = 'todo' and not ${meetingItems.done} then 1 end`
      ),
    })
    .from(meetings)
    .leftJoin(meetingItems, eq(meetingItems.meetingId, meetings.id))
    .where(eq(meetings.editionId, editionId))
    .groupBy(meetings.id)
    .orderBy(desc(meetings.date), desc(meetings.createdAt));
  return rows;
}

/** Items of a meeting in display order. */
export async function listMeetingItems(meetingId: string): Promise<MeetingItem[]> {
  return db
    .select()
    .from(meetingItems)
    .where(eq(meetingItems.meetingId, meetingId))
    .orderBy(asc(meetingItems.sortOrder), asc(meetingItems.createdAt));
}

export async function listAttendeeIds(meetingId: string): Promise<string[]> {
  const rows = await db
    .select({ memberId: meetingAttendees.memberId })
    .from(meetingAttendees)
    .where(eq(meetingAttendees.meetingId, meetingId));
  return rows.map((row) => row.memberId);
}

export type EditionItem = MeetingItem & { meetingDate: string };

/** Items of one kind in all meetings of an edition, newest meeting first. */
export async function listEditionItems(
  editionId: string,
  kind: "entscheidung" | "todo",
  ownerId?: string
): Promise<EditionItem[]> {
  const rows = await db
    .select({ item: meetingItems, meetingDate: meetings.date })
    .from(meetingItems)
    .innerJoin(meetings, eq(meetings.id, meetingItems.meetingId))
    .where(
      and(
        eq(meetings.editionId, editionId),
        eq(meetingItems.kind, kind),
        ownerId ? eq(meetingItems.ownerId, ownerId) : undefined
      )
    )
    .orderBy(
      desc(meetings.date),
      desc(meetings.createdAt),
      asc(meetingItems.sortOrder),
      asc(meetingItems.createdAt)
    );
  return rows.map((row) => ({ ...row.item, meetingDate: row.meetingDate }));
}
