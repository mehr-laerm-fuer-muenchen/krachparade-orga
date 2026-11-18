// Spec 032: a registration whose confirmation mail has not gone out after
// this many minutes gets the marker "Mail fehlt" on /kollektive.
export const MAIL_MISSING_AFTER_MINUTES = 10;

export function isConfirmationMissing(sentAt: Date | null, createdAt: Date, now: Date): boolean {
  if (sentAt) return false;
  return now.getTime() - createdAt.getTime() > MAIL_MISSING_AFTER_MINUTES * 60 * 1000;
}
