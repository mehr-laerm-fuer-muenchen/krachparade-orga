import { daysUntil } from "../dday";

// Registration window of an edition (spec 031). Calendar days only, both
// limits included; "today" is always passed in.

export type RegistrationWindow = {
  opensOn: string | null;
  closesOn: string | null;
};

export type RegistrationState = "not_configured" | "upcoming" | "open" | "closed";

export function registrationState(window: RegistrationWindow, today: string): RegistrationState {
  if (!window.opensOn || !window.closesOn) return "not_configured";
  if (daysUntil(window.opensOn, today) > 0) return "upcoming";
  if (daysUntil(window.closesOn, today) < 0) return "closed";
  return "open";
}

export const ERROR_WINDOW_ORDER = "Das Ende darf nicht vor dem Start liegen.";
export const ERROR_WINDOW_AFTER_DDAY = "Die Anmeldung muss vor der Krachparade enden.";

/** Error message for a window set by an admin, or null if it is fine. */
export function windowError(opensOn: string, closesOn: string, dDay: string): string | null {
  if (daysUntil(closesOn, opensOn) < 0) return ERROR_WINDOW_ORDER;
  if (daysUntil(dDay, closesOn) < 0) return ERROR_WINDOW_AFTER_DDAY;
  return null;
}
