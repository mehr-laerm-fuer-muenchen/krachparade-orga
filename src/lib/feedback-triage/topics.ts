// Spec 022: topic issues carry the ids of their feedback entries as an HTML
// comment, e.g. `<!-- meldungen: <uuid>,<uuid> -->`.

import type { FeedbackStatus } from "../feedback/status";

const MARKER = /<!--\s*meldungen:\s*([^>]*?)\s*-->/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const PRIORITY_LABELS = ["p1", "p2", "p3"] as const;
export type PriorityLabel = (typeof PRIORITY_LABELS)[number];
export type Priority = PriorityLabel | "keine";

/** An open topic issue as written to `triage-out/themen.json`. */
export type OpenTopic = {
  number: number;
  title: string;
  labels: string[];
  ids: string[];
};

/** `triage-out/themen.json`: open topics plus the titles of the last closed ones. */
export type TopicsFile = {
  offen: OpenTopic[];
  geschlossen: { number: number; title: string }[];
};

function normalize(ids: Iterable<string>): string[] {
  return [...new Set([...ids].map((id) => id.trim().toLowerCase()).filter((id) => UUID.test(id)))].sort();
}

/**
 * Reads the ids from a topic body (sorted, without duplicates, only full
 * UUIDs). If the body holds several markers, the last one counts.
 */
export function readTopicMarker(issueBody: string | null | undefined): string[] {
  if (!issueBody) return [];
  const last = [...issueBody.matchAll(MARKER)].at(-1);
  return last ? normalize(last[1].split(",")) : [];
}

/** The marker for a topic body (sorted, without duplicates). */
export function writeTopicMarker(ids: Iterable<string>): string {
  return `<!-- meldungen: ${normalize(ids).join(",")} -->`;
}

/**
 * Open topics whose known entries are all done or rejected. Ids unknown to
 * the database do not count; a topic with only unknown ids stays open.
 */
export function topicsToClose<T extends Pick<OpenTopic, "ids">>(
  topics: T[],
  statusById: Record<string, FeedbackStatus>
): T[] {
  return topics.filter((topic) => {
    const known = topic.ids.filter((id) => Object.hasOwn(statusById, id));
    return known.length > 0 && known.every((id) => statusById[id] === "done" || statusById[id] === "rejected");
  });
}

/** The strongest priority from the current labels and the new entries; p1 > p2 > p3. */
export function highestPriority(labels: string[], newPriorities: Priority[]): PriorityLabel | null {
  const all = new Set<string>([...labels, ...newPriorities]);
  return PRIORITY_LABELS.find((label) => all.has(label)) ?? null;
}
