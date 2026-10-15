import type { Actor } from "./permissions";

/** Rules for working groups ("AKs") and departments (spec 005). */

export const GROUP_NAME_MAX = 60;

export const ERROR_NAME_MISSING = "Name fehlt.";
export const ERROR_NAME_TOO_LONG = `Name ist zu lang (max. ${GROUP_NAME_MAX} Zeichen).`;

export type NameResult = { ok: true; name: string } | { ok: false; error: string };

/**
 * Trims, collapses whitespace and drops a leading "AK " (any case), so
 * "AK Kommunikation" is stored as "Kommunikation" and shown once with "AK".
 */
export function normalizeGroupName(input: string): NameResult {
  const name = input
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^ak(?: |$)/i, "")
    .trim();
  if (name.length === 0) {
    return { ok: false, error: ERROR_NAME_MISSING };
  }
  if (name.length > GROUP_NAME_MAX) {
    return { ok: false, error: ERROR_NAME_TOO_LONG };
  }
  return { ok: true, name };
}

export function displayGroupName(name: string): string {
  return `AK ${name}`;
}

type RightsActor = Pick<Actor, "id" | "active" | "isAdmin">;

/** Everyone may join or leave themselves; only admins change other people. */
export function canChangeMembership(actor: RightsActor, targetMemberId: string): boolean {
  return actor.active && (actor.id === targetMemberId || actor.isAdmin);
}

/** Marking the grouping as decided (or back to a proposal) is for admins. */
export function canMarkFinal(actor: Pick<Actor, "active" | "isAdmin">): boolean {
  return actor.active && actor.isAdmin;
}

/** A working group can only go once no department belongs to it any more. */
export function canDeleteGroup(departmentCount: number): boolean {
  return departmentCount === 0;
}

/** A department can only go while no minutes item points to it. */
export function canDeleteDepartment(referenceCount: number): boolean {
  return referenceCount === 0;
}
