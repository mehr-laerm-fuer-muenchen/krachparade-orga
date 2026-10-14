export type AccessMember = {
  email: string;
  active: boolean;
};

/** Normalises an e-mail address for comparisons and storage. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * `ADMIN_EMAILS` is a comma separated list. Entries are trimmed and lower
 * cased, empty entries are ignored.
 */
export function parseAdminEmails(value: string | undefined | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
}

export function isAdminEmail(email: string, adminEmails: readonly string[]): boolean {
  return adminEmails.includes(normalizeEmail(email));
}

/**
 * Sign-in is allowed for active members and for every address listed in
 * `ADMIN_EMAILS` (even without or with a deactivated member entry).
 */
export function isAllowed(
  email: string | null | undefined,
  members: readonly AccessMember[],
  adminEmails: readonly string[]
): boolean {
  if (!email) {
    return false;
  }
  const wanted = normalizeEmail(email);
  if (wanted.length === 0) {
    return false;
  }
  if (isAdminEmail(wanted, adminEmails)) {
    return true;
  }
  return members.some((member) => member.active && normalizeEmail(member.email) === wanted);
}
