import type { ItemKind, MeetingStatus } from "@/lib/protocol-rules";

// Data the meeting page hands to the browser: names only, no e-mail addresses.

export type Person = { id: string; name: string; active: boolean };

export type { DepartmentOption } from "@/lib/department-groups";

export type MeetingData = {
  id: string;
  date: string;
  title: string;
  place: string;
  moderatorId: string | null;
  minuteTakerId: string | null;
  guests: string;
  rawNotes: string;
  /** Short summary (spec 017), empty if none. */
  summary: string;
  status: MeetingStatus;
};

export type ItemData = {
  id: string;
  topic: string;
  kind: ItemKind;
  text: string;
  ownerId: string | null;
  ownerName: string | null;
  dueDate: string | null;
  departmentId: string | null;
  done: boolean;
};

/** Owner of a to-do: a member or a person without an account. */
export type Owner = { memberId: string } | { name: string } | null;

/** Feedback after a save ("Gespeichert" or the error). */
export type Report = (result: { ok: true } | { ok: false; message: string }, success?: string) => void;

export const INPUT =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-text disabled:bg-surface-2 disabled:text-muted";
export const PRIMARY_BUTTON =
  "min-h-11 shrink-0 rounded-md bg-primary px-4 font-semibold text-on-primary disabled:opacity-50";
export const SECONDARY_BUTTON =
  "min-h-11 shrink-0 rounded-md border border-line-strong bg-surface px-3 font-medium text-text hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface";
export const ICON_BUTTON = `${SECONDARY_BUTTON} w-11 px-0`;
/** Icon button in the red of deleting; without `text-text`, which would win over the red in the CSS. */
export const DELETE_ICON_BUTTON = `${ICON_BUTTON.replace("text-text ", "")} text-status-late`;

export function personLabel(person: Person): string {
  return person.active ? person.name : `${person.name} (deaktiviert)`;
}
