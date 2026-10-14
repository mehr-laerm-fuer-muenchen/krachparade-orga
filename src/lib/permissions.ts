import { isAdminEmail } from "./access";

/** The acting member as loaded from the database (never from the session). */
export type Actor = {
  id: string;
  email: string;
  active: boolean;
  isAdmin: boolean;
};

/** The member an action is about. */
export type ManageTarget = {
  id: string;
  email: string;
};

/**
 * `write` covers every admin action without a target person (D-Day,
 * invitations, departments); the others change a person.
 */
export type ManageAction = "write" | "deactivate" | "activate" | "grantAdmin" | "revokeAdmin";

export type ManageResult = { ok: true } | { ok: false; error: string };

export const ERROR_NOT_ADMIN = "Nur Admins können das ändern.";
export const ERROR_SELF_DEACTIVATE = "Du kannst dich nicht selbst deaktivieren.";
export const ERROR_SELF_REVOKE = "Du kannst dir nicht selbst das Admin-Recht nehmen.";
export const ERROR_ADMIN_BY_SERVER = "Admin über Server-Einstellung festgelegt.";

/**
 * Whether `actor` may run `action` on `target`. Spec 002 sets the admin right
 * again on every login for addresses from `ADMIN_EMAILS`, so taking it away
 * from them or deactivating them is locked.
 */
export function canManage(
  actor: Actor | null | undefined,
  target: ManageTarget | null,
  adminEmails: readonly string[],
  action: ManageAction
): ManageResult {
  if (!actor || !actor.active || !actor.isAdmin) {
    return { ok: false, error: ERROR_NOT_ADMIN };
  }
  const self = target !== null && target.id === actor.id;
  if (action === "deactivate") {
    if (self) {
      return { ok: false, error: ERROR_SELF_DEACTIVATE };
    }
    if (target && isAdminEmail(target.email, adminEmails)) {
      return { ok: false, error: ERROR_ADMIN_BY_SERVER };
    }
  }
  if (action === "revokeAdmin") {
    if (self) {
      return { ok: false, error: ERROR_SELF_REVOKE };
    }
    if (target && isAdminEmail(target.email, adminEmails)) {
      return { ok: false, error: ERROR_ADMIN_BY_SERVER };
    }
  }
  return { ok: true };
}

/**
 * Moves `id` one step up or down. Returns the new order, or null if `id` is
 * missing or already at that end.
 */
export function moveItem(
  ids: readonly string[],
  id: string,
  direction: "up" | "down"
): string[] | null {
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) {
    return null;
  }
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
