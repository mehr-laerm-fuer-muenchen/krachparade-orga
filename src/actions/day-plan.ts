"use server";

import { and, asc, count, eq, max } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import {
  dayChecks,
  dayEntries,
  dayRolePeople,
  dayRoles,
  dayTracks,
  workingGroups,
  type DayEntry,
  type Member,
} from "@/db/schema";
import {
  CHECK_TEXT_MAX,
  ENTRY_TITLE_MAX,
  LAST_MINUTE,
  NOTE_MAX,
  PERSON_TEXT_MAX,
  PLACE_MAX,
  ROLE_MARK_MAX,
  ROLE_TASK_MAX,
  ROLE_TITLE_MAX,
  TRACK_NAME_MAX,
  moveEntry,
  resizeEntry,
} from "@/lib/day-plan";

// Spec 030: the day plan of the Krachparade (columns, entries, checklists)
// and the roles on the day. Every active member may change everything, as in
// the plan and the minutes. Every action loads the acting member from the
// database (the session alone is not enough), validates its input with Zod
// and checks ids against the current edition. The last change wins. Texts are
// never logged.

type Failure = { ok: false; message: string };

export type DayActionResult = { ok: true } | Failure;
export type DayCreateResult = { ok: true; id: string } | Failure;
/** Values before a move or resize, for "Rückgängig". */
export type DayMoveResult =
  | { ok: true; previous: { startMinute: number; endMinute: number | null; trackId: string } }
  | Failure;

/** A member or a name without an account; null = nobody. */
export type DayPersonInput = { memberId: string } | { name: string } | null;

const NO_ACCESS = "Kein Zugriff.";
const NO_EDITION = "Keine aktuelle Ausgabe gefunden.";
const TRACK_NOT_FOUND = "Diese Spalte gibt es nicht.";
const TRACK_NOT_EMPTY = "Erst die Einträge verschieben.";
const ENTRY_NOT_FOUND = "Diesen Eintrag gibt es nicht.";
const CHECK_NOT_FOUND = "Diesen Checkpunkt gibt es nicht.";
const ROLE_NOT_FOUND = "Diese Rolle gibt es nicht.";
const PERSON_NOT_FOUND = "Diese Person ist bei der Rolle nicht eingetragen.";
const GROUP_NOT_FOUND = "Diesen AK gibt es nicht.";
const MEMBER_NOT_FOUND = "Diese Person gibt es nicht oder sie ist nicht aktiv.";
const NO_TIME = "Der Eintrag hat keine Uhrzeit.";
const END_BEFORE_START = "Das Ende muss nach dem Beginn liegen.";
const END_WITHOUT_START = "Ohne Beginn gibt es kein Ende.";
const INVALID = "Ungültige Eingabe.";
const SAVE_ERROR = "Konnte nicht gespeichert werden.";

function fail(message: string): Failure {
  return { ok: false, message };
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? INVALID;
}

// --- Input ------------------------------------------------------------------

const idInput = z.uuid();
const minuteInput = z.number().int().min(0, "Bitte eine Uhrzeit des Tages eingeben.").max(LAST_MINUTE, "Bitte eine Uhrzeit des Tages eingeben.");
const optionalMinute = minuteInput.nullable();

const required = (max: number, empty: string, long: string) => z.string().trim().min(1, empty).max(max, long);
/** Optional text: empty becomes null. */
const optionalText = (max: number, long: string) =>
  z
    .string()
    .trim()
    .max(max, long)
    .nullable()
    .transform((value) => (value ? value : null));

const trackName = required(TRACK_NAME_MAX, "Bitte einen Namen eingeben.", `Der Name darf höchstens ${TRACK_NAME_MAX} Zeichen lang sein.`);
const entryTitle = required(ENTRY_TITLE_MAX, "Bitte einen Titel eingeben.", `Der Titel darf höchstens ${ENTRY_TITLE_MAX} Zeichen lang sein.`);
const checkText = required(CHECK_TEXT_MAX, "Bitte einen Text eingeben.", `Der Punkt darf höchstens ${CHECK_TEXT_MAX} Zeichen lang sein.`);
const roleTitle = required(ROLE_TITLE_MAX, "Bitte einen Namen eingeben.", `Der Name darf höchstens ${ROLE_TITLE_MAX} Zeichen lang sein.`);

const personInput = z
  .union([
    z.object({ memberId: z.uuid() }).strict(),
    z
      .object({
        name: required(PERSON_TEXT_MAX, "Bitte einen Namen eingeben.", `Der Name darf höchstens ${PERSON_TEXT_MAX} Zeichen lang sein.`),
      })
      .strict(),
  ])
  .nullable();

const entryPatch = z
  .object({
    title: entryTitle,
    trackId: idInput,
    startMinute: optionalMinute,
    endMinute: optionalMinute,
    approx: z.boolean(),
    place: optionalText(PLACE_MAX, `Der Ort darf höchstens ${PLACE_MAX} Zeichen lang sein.`),
    workingGroupId: idInput.nullable(),
    person: personInput,
    note: optionalText(NOTE_MAX, `Die Notiz darf höchstens ${NOTE_MAX} Zeichen lang sein.`),
  })
  .partial()
  .strict();

export type DayEntryPatch = z.input<typeof entryPatch>;

const newEntry = z.object({
  trackId: z.string(),
  title: entryTitle,
  startMinute: optionalMinute,
  endMinute: optionalMinute,
});

const rolePatch = z
  .object({
    title: roleTitle,
    task: optionalText(ROLE_TASK_MAX, `Die Aufgabe darf höchstens ${ROLE_TASK_MAX} Zeichen lang sein.`),
    mark: optionalText(ROLE_MARK_MAX, `Das Kennzeichen darf höchstens ${ROLE_MARK_MAX} Zeichen lang sein.`),
    workingGroupId: idInput.nullable(),
  })
  .partial()
  .strict();

export type DayRolePatch = z.input<typeof rolePatch>;

// --- Context ----------------------------------------------------------------

type Context = { actor: Member; editionId: string };

/** The signed-in member (active, from the database) and the current edition. */
async function loadContext(): Promise<Context | Failure> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  if (!actor?.active) return fail(NO_ACCESS);
  const edition = await getCurrentEdition();
  if (!edition) return fail(NO_EDITION);
  return { actor, editionId: edition.id };
}

function isFailure(value: object): value is Failure {
  return "ok" in value && value.ok === false;
}

async function trackInEdition(trackId: unknown, editionId: string) {
  const id = idInput.safeParse(trackId);
  if (!id.success) return undefined;
  const [track] = await db
    .select()
    .from(dayTracks)
    .where(and(eq(dayTracks.id, id.data), eq(dayTracks.editionId, editionId)))
    .limit(1);
  return track;
}

async function entryInEdition(entryId: unknown, editionId: string): Promise<DayEntry | undefined> {
  const id = idInput.safeParse(entryId);
  if (!id.success) return undefined;
  const [entry] = await db
    .select()
    .from(dayEntries)
    .where(and(eq(dayEntries.id, id.data), eq(dayEntries.editionId, editionId)))
    .limit(1);
  return entry;
}

async function roleInEdition(roleId: unknown, editionId: string) {
  const id = idInput.safeParse(roleId);
  if (!id.success) return undefined;
  const [role] = await db
    .select()
    .from(dayRoles)
    .where(and(eq(dayRoles.id, id.data), eq(dayRoles.editionId, editionId)))
    .limit(1);
  return role;
}

async function groupInEdition(groupId: string, editionId: string): Promise<boolean> {
  const [group] = await db
    .select({ id: workingGroups.id })
    .from(workingGroups)
    .where(and(eq(workingGroups.id, groupId), eq(workingGroups.editionId, editionId)))
    .limit(1);
  return Boolean(group);
}

/** Columns of a person; undefined = the member does not exist or is not active. */
async function resolvePerson(
  person: z.output<typeof personInput>
): Promise<{ memberId: string | null; name: string | null } | undefined> {
  if (person === null) return { memberId: null, name: null };
  if ("name" in person) return { memberId: null, name: person.name };
  const member = await findMemberById(person.memberId);
  return member?.active ? { memberId: member.id, name: null } : undefined;
}

/** Checks the combination of start and end. */
function timeProblem(startMinute: number | null, endMinute: number | null): string | null {
  if (endMinute === null) return null;
  if (startMinute === null) return END_WITHOUT_START;
  if (endMinute <= startMinute) return END_BEFORE_START;
  return null;
}

function touchEntry(entryId: string, actorId: string) {
  return db.update(dayEntries).set({ updatedAt: new Date(), updatedBy: actorId }).where(eq(dayEntries.id, entryId));
}

// --- Columns ----------------------------------------------------------------

export async function createTrack(name: string): Promise<DayCreateResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const parsed = trackName.safeParse(name);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  try {
    const [{ last }] = await db
      .select({ last: max(dayTracks.position) })
      .from(dayTracks)
      .where(eq(dayTracks.editionId, context.editionId));
    const [created] = await db
      .insert(dayTracks)
      .values({ editionId: context.editionId, name: parsed.data, position: (last ?? 0) + 1 })
      .returning({ id: dayTracks.id });
    refresh();
    return { ok: true, id: created.id };
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function renameTrack(trackId: string, name: string): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const track = await trackInEdition(trackId, context.editionId);
  if (!track) return fail(TRACK_NOT_FOUND);
  const parsed = trackName.safeParse(name);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  try {
    await db.update(dayTracks).set({ name: parsed.data, updatedAt: new Date() }).where(eq(dayTracks.id, track.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** Swaps the column with its neighbour on the left or right; at the edge nothing changes. */
export async function moveTrack(trackId: string, direction: "left" | "right"): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const track = await trackInEdition(trackId, context.editionId);
  if (!track) return fail(TRACK_NOT_FOUND);
  const parsedDirection = z.enum(["left", "right"]).safeParse(direction);
  if (!parsedDirection.success) return fail(INVALID);

  try {
    const tracks = await db
      .select({ id: dayTracks.id })
      .from(dayTracks)
      .where(eq(dayTracks.editionId, context.editionId))
      .orderBy(asc(dayTracks.position), asc(dayTracks.createdAt));
    const index = tracks.findIndex((candidate) => candidate.id === track.id);
    const otherIndex = parsedDirection.data === "left" ? index - 1 : index + 1;
    if (index === -1 || otherIndex < 0 || otherIndex >= tracks.length) return { ok: true };
    const order = tracks.map((candidate) => candidate.id);
    [order[index], order[otherIndex]] = [order[otherIndex], order[index]];
    const now = new Date();
    const [first, ...rest] = order.map((id, position) =>
      db
        .update(dayTracks)
        .set({ position: position + 1, updatedAt: now })
        .where(eq(dayTracks.id, id))
    );
    await db.batch([first, ...rest]);
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** Only empty columns can be deleted. */
export async function deleteTrack(trackId: string): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const track = await trackInEdition(trackId, context.editionId);
  if (!track) return fail(TRACK_NOT_FOUND);
  try {
    const [{ entries }] = await db
      .select({ entries: count() })
      .from(dayEntries)
      .where(eq(dayEntries.trackId, track.id));
    if (entries > 0) return fail(TRACK_NOT_EMPTY);
    await db.delete(dayTracks).where(eq(dayTracks.id, track.id));
  } catch {
    // `on delete restrict`: an entry was added in the meantime.
    return fail(TRACK_NOT_EMPTY);
  }
  refresh();
  return { ok: true };
}

// --- Entries ----------------------------------------------------------------

/** A new entry in the column; without times it has no time of day. */
export async function createEntry(input: {
  trackId: string;
  title: string;
  startMinute: number | null;
  endMinute: number | null;
}): Promise<DayCreateResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const parsed = newEntry.safeParse(input);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const { title, startMinute, endMinute } = parsed.data;
  const track = await trackInEdition(parsed.data.trackId, context.editionId);
  if (!track) return fail(TRACK_NOT_FOUND);
  const problem = timeProblem(startMinute, endMinute);
  if (problem) return fail(problem);

  try {
    const [created] = await db
      .insert(dayEntries)
      .values({
        editionId: context.editionId,
        trackId: track.id,
        title,
        startMinute,
        endMinute,
        createdBy: context.actor.id,
        updatedBy: context.actor.id,
      })
      .returning({ id: dayEntries.id });
    refresh();
    return { ok: true, id: created.id };
  } catch {
    return fail(SAVE_ERROR);
  }
}

/** Changes single fields (saved on blur or change); start and end are checked together with the stored values. */
export async function updateEntry(entryId: string, patch: DayEntryPatch): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const entry = await entryInEdition(entryId, context.editionId);
  if (!entry) return fail(ENTRY_NOT_FOUND);
  const parsed = entryPatch.safeParse(patch);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  const { person, ...fields } = parsed.data;

  if (fields.trackId !== undefined && !(await trackInEdition(fields.trackId, context.editionId))) {
    return fail(TRACK_NOT_FOUND);
  }
  if (fields.workingGroupId && !(await groupInEdition(fields.workingGroupId, context.editionId))) {
    return fail(GROUP_NOT_FOUND);
  }
  // Without a start there is no end: removing the start also removes the end.
  const startMinute = fields.startMinute !== undefined ? fields.startMinute : entry.startMinute;
  let endMinute = fields.endMinute !== undefined ? fields.endMinute : entry.endMinute;
  if (fields.startMinute === null && fields.endMinute === undefined) endMinute = null;
  const problem = timeProblem(startMinute, endMinute);
  if (problem) return fail(problem);

  let personColumns: { personMemberId: string | null; personText: string | null } | undefined;
  if (person !== undefined) {
    const resolved = await resolvePerson(person);
    if (!resolved) return fail(MEMBER_NOT_FOUND);
    personColumns = { personMemberId: resolved.memberId, personText: resolved.name };
  }

  try {
    await db
      .update(dayEntries)
      .set({
        ...fields,
        startMinute,
        endMinute,
        ...personColumns,
        updatedAt: new Date(),
        updatedBy: context.actor.id,
      })
      .where(eq(dayEntries.id, entry.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** New start (and column); the duration stays, at the edges of the day the entry stops. */
export async function moveEntryTo(entryId: string, startMinute: number, trackId: string): Promise<DayMoveResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const entry = await entryInEdition(entryId, context.editionId);
  if (!entry) return fail(ENTRY_NOT_FOUND);
  if (entry.startMinute === null) return fail(NO_TIME);
  const start = minuteInput.safeParse(startMinute);
  if (!start.success) return fail(firstMessage(start.error));
  const track = await trackInEdition(trackId, context.editionId);
  if (!track) return fail(TRACK_NOT_FOUND);

  const moved = moveEntry(entry, start.data - entry.startMinute);
  try {
    await db
      .update(dayEntries)
      .set({
        startMinute: moved.startMinute,
        endMinute: moved.endMinute,
        trackId: track.id,
        updatedAt: new Date(),
        updatedBy: context.actor.id,
      })
      .where(eq(dayEntries.id, entry.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return {
    ok: true,
    previous: { startMinute: entry.startMinute, endMinute: entry.endMinute, trackId: entry.trackId },
  };
}

/** New end: at least start + 5 minutes, at most 23:59. */
export async function resizeEntryTo(entryId: string, endMinute: number): Promise<DayMoveResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const entry = await entryInEdition(entryId, context.editionId);
  if (!entry) return fail(ENTRY_NOT_FOUND);
  if (entry.startMinute === null) return fail(NO_TIME);
  const parsed = z.number().int().safeParse(endMinute);
  if (!parsed.success) return fail(INVALID);
  const end = resizeEntry(entry, parsed.data);
  if (end === null) return fail(END_BEFORE_START);

  try {
    await db
      .update(dayEntries)
      .set({ endMinute: end, updatedAt: new Date(), updatedBy: context.actor.id })
      .where(eq(dayEntries.id, entry.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return {
    ok: true,
    previous: { startMinute: entry.startMinute, endMinute: entry.endMinute, trackId: entry.trackId },
  };
}

/** Deletes the entry with its checklist. */
export async function deleteEntry(entryId: string): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const entry = await entryInEdition(entryId, context.editionId);
  if (!entry) return fail(ENTRY_NOT_FOUND);
  try {
    await db.delete(dayEntries).where(eq(dayEntries.id, entry.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

// --- Checklist --------------------------------------------------------------

export async function addCheck(entryId: string, text: string, person: DayPersonInput = null): Promise<DayCreateResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const entry = await entryInEdition(entryId, context.editionId);
  if (!entry) return fail(ENTRY_NOT_FOUND);
  const parsedText = checkText.safeParse(text);
  if (!parsedText.success) return fail(firstMessage(parsedText.error));
  const parsedPerson = personInput.safeParse(person);
  if (!parsedPerson.success) return fail(firstMessage(parsedPerson.error));
  const resolved = await resolvePerson(parsedPerson.data);
  if (!resolved) return fail(MEMBER_NOT_FOUND);

  try {
    const [{ last }] = await db
      .select({ last: max(dayChecks.position) })
      .from(dayChecks)
      .where(eq(dayChecks.entryId, entry.id));
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(dayChecks).values({
        id,
        entryId: entry.id,
        text: parsedText.data,
        memberId: resolved.memberId,
        nameText: resolved.name,
        position: (last ?? 0) + 1,
      }),
      touchEntry(entry.id, context.actor.id),
    ]);
    refresh();
    return { ok: true, id };
  } catch {
    return fail(SAVE_ERROR);
  }
}

/** The checkpoint, if its entry belongs to the current edition. */
async function checkInEdition(checkId: unknown, editionId: string) {
  const id = idInput.safeParse(checkId);
  if (!id.success) return undefined;
  const [check] = await db
    .select({ id: dayChecks.id, entryId: dayChecks.entryId })
    .from(dayChecks)
    .innerJoin(dayEntries, eq(dayEntries.id, dayChecks.entryId))
    .where(and(eq(dayChecks.id, id.data), eq(dayEntries.editionId, editionId)))
    .limit(1);
  return check;
}

export async function toggleCheck(checkId: string, done: boolean): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const check = await checkInEdition(checkId, context.editionId);
  if (!check) return fail(CHECK_NOT_FOUND);
  const parsed = z.boolean().safeParse(done);
  if (!parsed.success) return fail(INVALID);
  try {
    await db.batch([
      db
        .update(dayChecks)
        .set({ done: parsed.data, doneAt: parsed.data ? new Date() : null })
        .where(eq(dayChecks.id, check.id)),
      touchEntry(check.entryId, context.actor.id),
    ]);
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

export async function deleteCheck(checkId: string): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const check = await checkInEdition(checkId, context.editionId);
  if (!check) return fail(CHECK_NOT_FOUND);
  try {
    await db.batch([db.delete(dayChecks).where(eq(dayChecks.id, check.id)), touchEntry(check.entryId, context.actor.id)]);
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

// --- Roles ------------------------------------------------------------------

export async function createRole(title: string): Promise<DayCreateResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const parsed = roleTitle.safeParse(title);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  try {
    const [{ last }] = await db
      .select({ last: max(dayRoles.position) })
      .from(dayRoles)
      .where(eq(dayRoles.editionId, context.editionId));
    const [created] = await db
      .insert(dayRoles)
      .values({ editionId: context.editionId, title: parsed.data, position: (last ?? 0) + 1 })
      .returning({ id: dayRoles.id });
    refresh();
    return { ok: true, id: created.id };
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function updateRole(roleId: string, patch: DayRolePatch): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const role = await roleInEdition(roleId, context.editionId);
  if (!role) return fail(ROLE_NOT_FOUND);
  const parsed = rolePatch.safeParse(patch);
  if (!parsed.success) return fail(firstMessage(parsed.error));
  if (parsed.data.workingGroupId && !(await groupInEdition(parsed.data.workingGroupId, context.editionId))) {
    return fail(GROUP_NOT_FOUND);
  }
  try {
    await db
      .update(dayRoles)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(dayRoles.id, role.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** Deletes the role with its people. */
export async function deleteRole(roleId: string): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const role = await roleInEdition(roleId, context.editionId);
  if (!role) return fail(ROLE_NOT_FOUND);
  try {
    await db.delete(dayRoles).where(eq(dayRoles.id, role.id));
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}

/** A member or a name without an account for the role. */
export async function addRolePerson(roleId: string, person: NonNullable<DayPersonInput>): Promise<DayCreateResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const role = await roleInEdition(roleId, context.editionId);
  if (!role) return fail(ROLE_NOT_FOUND);
  const parsed = personInput.safeParse(person);
  if (!parsed.success || parsed.data === null) return fail(parsed.success ? INVALID : firstMessage(parsed.error));
  const resolved = await resolvePerson(parsed.data);
  if (!resolved) return fail(MEMBER_NOT_FOUND);

  try {
    const [{ last }] = await db
      .select({ last: max(dayRolePeople.position) })
      .from(dayRolePeople)
      .where(eq(dayRolePeople.roleId, role.id));
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(dayRolePeople).values({
        id,
        roleId: role.id,
        memberId: resolved.memberId,
        nameText: resolved.name,
        position: (last ?? 0) + 1,
      }),
      db.update(dayRoles).set({ updatedAt: new Date() }).where(eq(dayRoles.id, role.id)),
    ]);
    refresh();
    return { ok: true, id };
  } catch {
    return fail(SAVE_ERROR);
  }
}

export async function removeRolePerson(personId: string): Promise<DayActionResult> {
  const context = await loadContext();
  if (isFailure(context)) return context;
  const id = idInput.safeParse(personId);
  if (!id.success) return fail(PERSON_NOT_FOUND);
  const [row] = await db
    .select({ id: dayRolePeople.id, roleId: dayRolePeople.roleId })
    .from(dayRolePeople)
    .innerJoin(dayRoles, eq(dayRoles.id, dayRolePeople.roleId))
    .where(and(eq(dayRolePeople.id, id.data), eq(dayRoles.editionId, context.editionId)))
    .limit(1);
  if (!row) return fail(PERSON_NOT_FOUND);
  try {
    await db.batch([
      db.delete(dayRolePeople).where(eq(dayRolePeople.id, row.id)),
      db.update(dayRoles).set({ updatedAt: new Date() }).where(eq(dayRoles.id, row.roleId)),
    ]);
  } catch {
    return fail(SAVE_ERROR);
  }
  refresh();
  return { ok: true };
}
