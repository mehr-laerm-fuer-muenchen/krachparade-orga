import { z } from "zod";
import { FEEDBACK_KINDS } from "./kinds";
import { FEEDBACK_STATUSES } from "./status";

/** Input rules for feedback (spec 014). */

export const MESSAGE_MAX = 2000;
export const REPLY_MAX = 2000;
export const PATH_MAX = 300;
export const TITLE_MAX = 200;
export const CONTEXT_MAX = 200;
export const DEVICE_MAX = 100;
export const VIEWPORT_MAX = 20;

export const ERROR_KIND = "Bitte Fehler oder Wunsch wählen.";
export const ERROR_MESSAGE = "Bitte kurz beschreiben.";
export const ERROR_TOO_LONG = `Höchstens ${MESSAGE_MAX} Zeichen.`;
export const ERROR_PATH = "Die Seite konnte nicht erkannt werden.";
export const ERROR_STATUS = "Bitte einen Status wählen.";

/** Optional captured text: trimmed, empty → null, too long → shortened. */
function optionalText(max: number) {
  return z
    .string()
    .nullish()
    .transform((value) => {
      const text = value?.trim() ?? "";
      return text.length > 0 ? text.slice(0, max) : null;
    });
}

/** Path only: query and hash are cut off, must start with "/". */
const pagePath = z
  .string({ error: ERROR_PATH })
  .transform((value) => value.trim().split(/[?#]/)[0].slice(0, PATH_MAX))
  .refine((value) => value.startsWith("/"), ERROR_PATH);

export const createFeedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS, { error: ERROR_KIND }),
  message: z.string({ error: ERROR_MESSAGE }).trim().min(1, ERROR_MESSAGE).max(MESSAGE_MAX, ERROR_TOO_LONG),
  pagePath,
  pageTitle: optionalText(TITLE_MAX),
  context: optionalText(CONTEXT_MAX),
  device: optionalText(DEVICE_MAX),
  viewport: optionalText(VIEWPORT_MAX),
});

export type CreateFeedbackInput = z.input<typeof createFeedbackInput>;
export type CreateFeedbackData = z.output<typeof createFeedbackInput>;

export const updateFeedbackInput = z.object({
  status: z.enum(FEEDBACK_STATUSES, { error: ERROR_STATUS }),
  reply: z
    .string()
    .nullish()
    .transform((value) => value?.trim() ?? "")
    .pipe(z.string().max(REPLY_MAX, ERROR_TOO_LONG))
    .transform((value) => (value.length > 0 ? value : null)),
});

export type UpdateFeedbackInput = z.input<typeof updateFeedbackInput>;
export type UpdateFeedbackData = z.output<typeof updateFeedbackInput>;

/** First message per top-level field, for errors shown under each field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    if (!(field in result)) result[field] = issue.message;
  }
  return result;
}
