import { formatGermanDate } from "./dday";
import { groupByTopic, ITEM_KIND_LABELS, type ItemKind } from "./protocol-rules";

// Plain text (Telegram) and Markdown exports of a meeting (spec 004). Only
// names, never e-mail addresses.

export type ExportMeeting = {
  title: string;
  date: string;
  place: string;
  moderatorId: string | null;
  minuteTakerId: string | null;
  attendeeIds: readonly string[];
  guests: string;
  /** Short summary (spec 017), its own paragraph after the attendees. */
  summary?: string | null;
};

/** Items in their display order (`sortOrder`). */
export type ExportItem = {
  topic: string;
  kind: ItemKind;
  text: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  done: boolean;
};

/** Member id → name. */
export type Names = ReadonlyMap<string, string>;

function ownerOf(item: ExportItem, names: Names): string | null {
  if (item.ownerId) return names.get(item.ownerId) ?? null;
  return item.ownerName?.trim() || null;
}

function nameOf(id: string | null, names: Names): string | null {
  return id ? (names.get(id) ?? null) : null;
}

function attendeeNames(meeting: ExportMeeting, names: Names): string[] {
  return meeting.attendeeIds
    .map((id) => names.get(id))
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b, "de"));
}

/** "2026-10-21" → "21.10." */
function shortDate(date: string): string {
  return formatGermanDate(date).slice(0, 6);
}

function todoDetails(item: ExportItem, names: Names, formatDate: (date: string) => string): string {
  const parts = [ownerOf(item, names), item.dueDate ? `bis ${formatDate(item.dueDate)}` : null].filter(
    Boolean
  );
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

/** Flowing text without tables, for pasting into Telegram. */
export function toTelegramText(meeting: ExportMeeting, items: readonly ExportItem[], names: Names): string {
  const blocks: string[] = [`${meeting.title} – ${formatGermanDate(meeting.date)}`];

  const present = [...attendeeNames(meeting, names), meeting.guests.trim()].filter(Boolean);
  if (present.length > 0) {
    blocks[0] += `\nAnwesend: ${present.join(", ")}`;
  }

  const summary = meeting.summary?.trim();
  if (summary) blocks.push(summary);

  const decisions = items.filter((item) => item.kind === "entscheidung");
  if (decisions.length > 0) {
    blocks.push(["Beschlüsse:", ...decisions.map((item) => `– ${item.text}`)].join("\n"));
  }

  const todos = items.filter((item) => item.kind === "todo");
  if (todos.length > 0) {
    blocks.push(
      [
        "To-dos:",
        ...todos.map(
          (item) => `– ${item.done ? "✓ " : ""}${item.text}${todoDetails(item, names, shortDate)}`
        ),
      ].join("\n")
    );
  }

  for (const { topic, items: topicItems } of groupByTopic(items)) {
    const notes = topicItems.filter((item) => item.kind === "info" || item.kind === "diskussion");
    if (notes.length > 0) {
      blocks.push([`${topic}:`, ...notes.map((item) => `– ${item.text}`)].join("\n"));
    }
  }

  return blocks.join("\n\n");
}

/** Head with the meeting data, a heading per TOP, items with their kind. */
export function toMarkdown(meeting: ExportMeeting, items: readonly ExportItem[], names: Names): string {
  const head: [string, string | null][] = [
    ["Datum", formatGermanDate(meeting.date)],
    ["Ort", meeting.place.trim() || null],
    ["Moderation", nameOf(meeting.moderatorId, names)],
    ["Protokoll", nameOf(meeting.minuteTakerId, names)],
    ["Anwesend", attendeeNames(meeting, names).join(", ") || null],
    ["Gäste", meeting.guests.trim() || null],
  ];
  const lines = [
    `# ${meeting.title}`,
    "",
    ...head.filter(([, value]) => value).map(([label, value]) => `- **${label}:** ${value}`),
  ];

  const summary = meeting.summary?.trim();
  if (summary) lines.push("", "**Kurzfassung**", "", summary);

  for (const { topic, items: topicItems } of groupByTopic(items)) {
    lines.push("", `## ${topic}`, "");
    for (const item of topicItems) {
      const details = item.kind === "todo" ? todoDetails(item, names, formatGermanDate) : "";
      const done = item.kind === "todo" && item.done ? " ✓" : "";
      lines.push(`- **${ITEM_KIND_LABELS[item.kind]}:** ${item.text}${details}${done}`);
    }
  }

  return lines.join("\n");
}
