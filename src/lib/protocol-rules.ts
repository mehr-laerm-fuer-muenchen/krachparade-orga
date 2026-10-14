// Rules for meetings and their items (spec 004). Calendar days only
// ("YYYY-MM-DD"); "today" is always passed in (todayInBerlin on the server).

export const ITEM_KINDS = ["info", "diskussion", "entscheidung", "todo"] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  info: "Info",
  diskussion: "Diskussion",
  entscheidung: "Entscheidung",
  todo: "To-do",
};

export const MEETING_STATUSES = ["entwurf", "final"] as const;

export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export function isItemKind(value: string): value is ItemKind {
  return (ITEM_KINDS as readonly string[]).includes(value);
}

/** An open to-do whose due date lies before `today`. */
export function isOverdue(
  item: { kind: string; done: boolean; dueDate: string | null },
  today: string
): boolean {
  return item.kind === "todo" && !item.done && item.dueDate !== null && item.dueDate < today;
}

/** Admins and whoever created the meeting may delete it, both only while active. */
export function canDeleteMeeting(
  actor: { id: string; active: boolean; isAdmin: boolean } | null | undefined,
  meeting: { createdBy: string }
): boolean {
  return Boolean(actor?.active && (actor.isAdmin || actor.id === meeting.createdBy));
}

/** By due date (earliest first, without date last), then by creation time. */
export function sortTodos<T extends { dueDate: string | null; createdAt: Date }>(
  items: readonly T[]
): T[] {
  return [...items].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export type Topic<T> = { topic: string; items: T[] };

/**
 * Groups items (already in `sortOrder`) by TOP. A TOP takes the position of
 * its first item.
 */
export function groupByTopic<T extends { topic: string }>(items: readonly T[]): Topic<T>[] {
  const topics: Topic<T>[] = [];
  for (const item of items) {
    const existing = topics.find((entry) => entry.topic === item.topic);
    if (existing) {
      existing.items.push(item);
    } else {
      topics.push({ topic: item.topic, items: [item] });
    }
  }
  return topics;
}
