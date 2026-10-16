import { departmentLabel, type DepartmentOption } from "./department-groups";
import { groupByTopic, sortTodos, type ItemKind, type MeetingStatus } from "./protocol-rules";

// Read view of a meeting (spec 017): which view opens and what it shows.
// Only names, never e-mail addresses.

export const MEETING_VIEWS = ["lesen", "bearbeiten"] as const;

export type MeetingView = (typeof MEETING_VIEWS)[number];

/** Drafts open for editing, final minutes for reading. */
export function defaultView(status: MeetingStatus): MeetingView {
  return status === "final" ? "lesen" : "bearbeiten";
}

/** `?ansicht=` wins if it names a view; anything else counts as missing. */
export function resolveView(param: string | undefined, status: MeetingStatus): MeetingView {
  return (MEETING_VIEWS as readonly string[]).includes(param ?? "")
    ? (param as MeetingView)
    : defaultView(status);
}

/** Longest summary in characters; the counter appears from `SUMMARY_COUNTER_FROM` on. */
export const SUMMARY_MAX = 2000;
export const SUMMARY_COUNTER_FROM = 1800;

/** "1 234" with a narrow no-break space as thousands separator. */
function groupDigits(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "1 834 / 2 000" once the summary gets long, otherwise null. */
export function summaryCounter(length: number): string | null {
  return length >= SUMMARY_COUNTER_FROM ? `${groupDigits(length)} / ${groupDigits(SUMMARY_MAX)}` : null;
}

/** Items in their display order (`sortOrder`). */
export type ReadItem = {
  id: string;
  topic: string;
  kind: ItemKind;
  text: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  departmentId: string | null;
  done: boolean;
  createdAt: Date;
};

/** A member or (`withoutAccount`) a person without an account. */
export type ReadOwner = { name: string; withoutAccount: boolean };

export type ReadDecision = { id: string; text: string; topic: string; department: string | null };

export type ReadTodo = {
  id: string;
  text: string;
  owner: ReadOwner | null;
  dueDate: string | null;
  department: string | null;
  done: boolean;
};

export type ReadNote = { id: string; text: string; department: string | null };

export type ReadTopic = { topic: string; infos: ReadNote[]; discussions: ReadNote[] };

export type ReadModel = { decisions: ReadDecision[]; todos: ReadTodo[]; topics: ReadTopic[] };

function ownerOf(item: ReadItem, names: ReadonlyMap<string, string>): ReadOwner | null {
  if (item.ownerId) {
    const name = names.get(item.ownerId);
    return name ? { name, withoutAccount: false } : null;
  }
  const name = item.ownerName?.trim();
  return name ? { name, withoutAccount: true } : null;
}

/**
 * Decisions in the order of TOPs and items, to-dos open first (by due date,
 * see `sortTodos`) then done ones, and per TOP its infos and discussions. TOPs
 * without either are left out. `names`: member id → name.
 */
export function readModel(
  items: readonly ReadItem[],
  departments: readonly DepartmentOption[],
  names: ReadonlyMap<string, string>
): ReadModel {
  const departmentOf = (id: string | null) => {
    const department = id ? departments.find((entry) => entry.id === id) : undefined;
    return department ? departmentLabel(department) : null;
  };
  const topics = groupByTopic(items);
  const ordered = topics.flatMap((entry) => entry.items);

  const decisions = ordered
    .filter((item) => item.kind === "entscheidung")
    .map((item) => ({ id: item.id, text: item.text, topic: item.topic, department: departmentOf(item.departmentId) }));

  const todoItems = ordered.filter((item) => item.kind === "todo");
  const todos = [
    ...sortTodos(todoItems.filter((item) => !item.done)),
    ...sortTodos(todoItems.filter((item) => item.done)),
  ].map((item) => ({
    id: item.id,
    text: item.text,
    owner: ownerOf(item, names),
    dueDate: item.dueDate,
    department: departmentOf(item.departmentId),
    done: item.done,
  }));

  const note = (item: ReadItem): ReadNote => ({
    id: item.id,
    text: item.text,
    department: departmentOf(item.departmentId),
  });
  const readTopics = topics
    .map(({ topic, items: topicItems }) => ({
      topic,
      infos: topicItems.filter((item) => item.kind === "info").map(note),
      discussions: topicItems.filter((item) => item.kind === "diskussion").map(note),
    }))
    .filter((entry) => entry.infos.length > 0 || entry.discussions.length > 0);

  return { decisions, todos, topics: readTopics };
}
