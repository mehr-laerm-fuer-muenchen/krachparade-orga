// Spec 031: protection of the public registration form.

/** Seconds between loading the form and sending it, at least. */
export const MIN_FILL_SECONDS = 20;
/** Registrations per edition, at most. */
export const MAX_REGISTRATIONS = 300;
/** The thank-you page shows name and costs only this long after sending. */
export const THANKS_VISIBLE_MINUTES = 60;
/** Internal note on /kollektive/[id], at most. */
export const NOTE_MAX = 2000;
