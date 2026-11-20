import { z } from "zod";
import {
  EVENT_SIZES,
  GENRES,
  HOME_BASES,
  MAX_GENRES,
  MAX_SHIRTS_PER_SIZE,
  MUSIC_TYPES,
  SHIRT_SIZES,
  VEHICLES,
  VEST_SIZES,
  isMotorized,
} from "./options";

/** Input rules of the public registration form (spec 031). */

export const NAME_MAX = 80;
export const SHORT_MAX = 200;
export const TEXT_MAX = 2000;
export const EMAIL_MAX = 254;
export const LINK_MAX = 500;
export const DEMANDS_MIN = 75;

export const ERROR_REQUIRED = "Bitte ausfüllen.";
export const ERROR_CHOICE = "Bitte eine Antwort wählen.";
export const ERROR_YES_NO = "Bitte Ja oder Nein wählen.";
export const ERROR_EMAIL = "Bitte eine gültige E-Mail-Adresse angeben.";
export const ERROR_PHONE = "Bitte eine gültige Handynummer angeben (nur Ziffern, Leerzeichen, + - / ( )).";
export const ERROR_LINK = "Bitte einen Link angeben, der mit https:// beginnt.";
export const ERROR_DEMANDS = "Bitte formuliert eure Forderungen etwas ausführlicher (mindestens 75 Zeichen).";
export const ERROR_GENRES_MAX = `Bitte höchstens ${MAX_GENRES} Genres wählen.`;
export const ERROR_GENRES_MIN = "Bitte mindestens ein Genre wählen.";
export const ERROR_SHIRTS = "Bitte eine Zahl zwischen 0 und 100 eingeben.";
export const ERROR_STEWARDS = "Ohne Ordner geht es nicht. Bitte bestätigt die Auflagen.";
export const ERROR_PRIVACY = "Bitte stimmt der Speicherung zu.";

function tooLong(max: number) {
  return `Höchstens ${max} Zeichen.`;
}

function requiredText(max: number) {
  return z.string({ error: ERROR_REQUIRED }).trim().min(1, ERROR_REQUIRED).max(max, tooLong(max));
}

/** Trimmed; empty → null. */
function optionalText(max: number) {
  return z
    .string()
    .nullish()
    .transform((value) => value?.trim() ?? "")
    .pipe(z.string().max(max, tooLong(max)))
    .transform((value) => (value.length > 0 ? value : null));
}

const email = z
  .string({ error: ERROR_EMAIL })
  .trim()
  .toLowerCase()
  .max(EMAIL_MAX, ERROR_EMAIL)
  .pipe(z.email({ error: ERROR_EMAIL }));

const optionalEmail = z
  .string()
  .nullish()
  .transform((value) => value?.trim().toLowerCase() ?? "")
  .pipe(z.union([z.literal(""), z.email({ error: ERROR_EMAIL }).max(EMAIL_MAX, ERROR_EMAIL)]))
  .transform((value) => (value.length > 0 ? value : null));

const PHONE_PATTERN = /^[0-9+\-/() ]{6,30}$/;

export function isValidPhone(value: string): boolean {
  return PHONE_PATTERN.test(value) && (value.match(/\d/g)?.length ?? 0) >= 6;
}

const phone = z
  .string({ error: ERROR_PHONE })
  .trim()
  .refine(isValidPhone, ERROR_PHONE);

const optionalPhone = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? "")
  .refine((value) => value === "" || isValidPhone(value), ERROR_PHONE)
  .transform((value) => (value.length > 0 ? value : null));

export function isHttpsLink(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.includes(".");
  } catch {
    return false;
  }
}

const optionalLink = z
  .string()
  .nullish()
  .transform((value) => value?.trim() ?? "")
  .refine((value) => value === "" || (value.length <= LINK_MAX && isHttpsLink(value)), ERROR_LINK)
  .transform((value) => (value.length > 0 ? value : null));

const yesNo = z.boolean({ error: ERROR_YES_NO });

const shirtCount = z
  .number({ error: ERROR_SHIRTS })
  .int(ERROR_SHIRTS)
  .min(0, ERROR_SHIRTS)
  .max(MAX_SHIRTS_PER_SIZE, ERROR_SHIRTS);

const shirtSizes = z.object(
  Object.fromEntries(SHIRT_SIZES.map((size) => [size, shirtCount])) as Record<
    (typeof SHIRT_SIZES)[number],
    typeof shirtCount
  >
);

export const registrationInput = z
  .object({
    contactFirstName: requiredText(NAME_MAX),
    contactLastName: requiredText(NAME_MAX),
    contactEmail: email,
    contactPhone: phone,

    collectiveName: requiredText(SHORT_MAX),
    displayName: requiredText(SHORT_MAX),
    demands: requiredText(TEXT_MAX).refine((value) => value.length >= DEMANDS_MIN, ERROR_DEMANDS),
    instagram: optionalText(SHORT_MAX),
    tiktok: optionalText(SHORT_MAX),
    filesLink: optionalLink,
    participatedBefore: yesNo,
    musicType: z.enum(MUSIC_TYPES, { error: ERROR_CHOICE }),
    genres: z
      .array(z.enum(GENRES, { error: ERROR_CHOICE }), { error: ERROR_CHOICE })
      .max(MAX_GENRES, ERROR_GENRES_MAX)
      .transform((values) => [...new Set(values)]),
    homeBase: z.enum(HOME_BASES, { error: ERROR_CHOICE }),
    eventSize: z.enum(EVENT_SIZES, { error: ERROR_CHOICE }),

    vehicle: z.enum(VEHICLES, { error: ERROR_CHOICE }),
    tuev: z.boolean().nullish(),
    awareness: requiredText(TEXT_MAX),
    soundCoupling: yesNo,
    atmosphere: requiredText(TEXT_MAX),
    orderPreference: optionalText(TEXT_MAX),
    jointWith: optionalText(TEXT_MAX),
    vehicleFilesLink: optionalLink,

    sectionLeadFirstName: optionalText(NAME_MAX),
    sectionLeadLastName: optionalText(NAME_MAX),
    sectionLeadEmail: optionalEmail,
    sectionLeadPhone: optionalPhone,
    sectionLeadNote: optionalText(TEXT_MAX),

    vehicleLeadFirstName: requiredText(NAME_MAX),
    vehicleLeadLastName: requiredText(NAME_MAX),
    vehicleLeadEmail: email,
    vehicleLeadSize: z.enum(VEST_SIZES, { error: ERROR_CHOICE }),
    vehicleLeadPhone: phone,

    shirts: z.object({ standard: shirtSizes, soli: shirtSizes }),

    stewardsConfirmed: z.literal(true, { error: ERROR_STEWARDS }),
    privacyConfirmed: z.literal(true, { error: ERROR_PRIVACY }),
  })
  .superRefine((data, ctx) => {
    if (data.musicType !== "none" && data.genres.length === 0) {
      ctx.addIssue({ code: "custom", path: ["genres"], message: ERROR_GENRES_MIN });
    }
    if (isMotorized(data.vehicle) && typeof data.tuev !== "boolean") {
      ctx.addIssue({ code: "custom", path: ["tuev"], message: ERROR_YES_NO });
    }
  })
  .transform((data) => {
    // Without a motor there is no TÜV question and no section lead, as in the
    // Google form; answers from a former choice are dropped.
    if (isMotorized(data.vehicle)) {
      return { ...data, tuev: data.tuev ?? false };
    }
    return {
      ...data,
      tuev: null,
      sectionLeadFirstName: null,
      sectionLeadLastName: null,
      sectionLeadEmail: null,
      sectionLeadPhone: null,
      sectionLeadNote: null,
    };
  });

export type RegistrationInput = z.input<typeof registrationInput>;
export type RegistrationData = z.output<typeof registrationInput>;

/**
 * First message per field, keyed by the dotted path (e.g. "shirts.standard.M"),
 * so the form can show it right at the field. Errors of list items (a genre)
 * belong to the whole list.
 */
export function registrationFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path
      .filter((segment) => typeof segment !== "number")
      .map(String)
      .join(".");
    if (!(field in result)) result[field] = issue.message;
  }
  return result;
}
