import {
  EVENT_SIZES,
  GENRES,
  HOME_BASES,
  MUSIC_TYPES,
  SHIRT_KINDS,
  SHIRT_SIZES,
  VEHICLES,
  VEST_SIZES,
  isMotorized,
  type EventSize,
  type Genre,
  type HomeBase,
  type MusicType,
  type ShirtKind,
  type ShirtOrder,
  type ShirtSize,
  type Vehicle,
  type VestSize,
} from "./options";
import {
  ERROR_GENRES_MIN,
  ERROR_YES_NO,
  registrationFieldErrors,
  registrationInput,
  type RegistrationInput,
} from "./registration-schema";

// What the public form holds while typing (spec 031): text as typed, choices
// as "" until picked, shirt counts as text. Pure functions, used by the form
// and its tests.

type YesNoValue = "" | "yes" | "no";

export const TEXT_FIELDS = [
  "contactFirstName",
  "contactLastName",
  "contactEmail",
  "contactPhone",
  "collectiveName",
  "displayName",
  "demands",
  "instagram",
  "tiktok",
  "filesLink",
  "awareness",
  "atmosphere",
  "orderPreference",
  "jointWith",
  "vehicleFilesLink",
  "sectionLeadFirstName",
  "sectionLeadLastName",
  "sectionLeadEmail",
  "sectionLeadPhone",
  "sectionLeadNote",
  "vehicleLeadFirstName",
  "vehicleLeadLastName",
  "vehicleLeadEmail",
  "vehicleLeadPhone",
] as const;
export type TextFieldName = (typeof TEXT_FIELDS)[number];

export type FormValues = Record<TextFieldName, string> & {
  participatedBefore: YesNoValue;
  musicType: MusicType | "";
  genres: Genre[];
  homeBase: HomeBase | "";
  eventSize: EventSize | "";
  vehicle: Vehicle | "";
  tuev: YesNoValue;
  soundCoupling: YesNoValue;
  vehicleLeadSize: VestSize | "";
  shirts: Record<ShirtKind, Record<ShirtSize, string>>;
  stewardsConfirmed: boolean;
  privacyConfirmed: boolean;
};

export function emptyFormValues(): FormValues {
  const text = Object.fromEntries(TEXT_FIELDS.map((field) => [field, ""])) as Record<TextFieldName, string>;
  const sizes = () => Object.fromEntries(SHIRT_SIZES.map((size) => [size, "0"])) as Record<ShirtSize, string>;
  return {
    ...text,
    participatedBefore: "",
    musicType: "",
    genres: [],
    homeBase: "",
    eventSize: "",
    vehicle: "",
    tuev: "",
    soundCoupling: "",
    vehicleLeadSize: "",
    shirts: { standard: sizes(), soli: sizes() },
    stewardsConfirmed: false,
    privacyConfirmed: false,
  };
}

function yesNo(value: YesNoValue): boolean | undefined {
  return value === "" ? undefined : value === "yes";
}

function orUndefined<T extends string>(value: T | ""): T | undefined {
  return value === "" ? undefined : value;
}

/** "" → 0 is not done on purpose: an emptied field asks for a number. */
function count(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

export function shirtNumbers(values: FormValues): ShirtOrder {
  const order = {} as ShirtOrder;
  for (const kind of SHIRT_KINDS) {
    order[kind] = {} as Record<ShirtSize, number>;
    for (const size of SHIRT_SIZES) order[kind][size] = count(values.shirts[kind][size]);
  }
  return order;
}

/** Shirt order for the live cost overview: anything invalid counts as 0. */
export function shirtNumbersForCosts(values: FormValues): ShirtOrder {
  const order = shirtNumbers(values);
  for (const kind of SHIRT_KINDS) {
    for (const size of SHIRT_SIZES) {
      const value = order[kind][size];
      order[kind][size] = Number.isInteger(value) && value > 0 && value <= 100 ? value : 0;
    }
  }
  return order;
}

export function toRegistrationInput(values: FormValues): RegistrationInput {
  const motorized = values.vehicle !== "" && isMotorized(values.vehicle);
  return {
    ...Object.fromEntries(TEXT_FIELDS.map((field) => [field, values[field]])),
    participatedBefore: yesNo(values.participatedBefore),
    musicType: orUndefined(values.musicType),
    genres: values.genres,
    homeBase: orUndefined(values.homeBase),
    eventSize: orUndefined(values.eventSize),
    vehicle: orUndefined(values.vehicle),
    tuev: motorized ? (yesNo(values.tuev) ?? null) : null,
    soundCoupling: yesNo(values.soundCoupling),
    vehicleLeadSize: orUndefined(values.vehicleLeadSize),
    shirts: shirtNumbers(values),
    stewardsConfirmed: values.stewardsConfirmed,
    privacyConfirmed: values.privacyConfirmed,
  } as RegistrationInput;
}

/**
 * All errors at once: Zod's own plus the checks across fields, which Zod only
 * runs once everything else is valid.
 */
export function formErrors(values: FormValues): Record<string, string> {
  const parsed = registrationInput.safeParse(toRegistrationInput(values));
  const errors = parsed.success ? {} : registrationFieldErrors(parsed.error);
  if (values.musicType !== "" && values.musicType !== "none" && values.genres.length === 0) {
    errors.genres ??= ERROR_GENRES_MIN;
  }
  if (values.vehicle !== "" && isMotorized(values.vehicle) && values.tuev === "") {
    errors.tuev ??= ERROR_YES_NO;
  }
  return errors;
}

/** Order of the fields on the page, to jump to the first error. */
export const FIELD_ORDER: string[] = [
  "contactFirstName",
  "contactLastName",
  "contactEmail",
  "contactPhone",
  "collectiveName",
  "displayName",
  "demands",
  "instagram",
  "tiktok",
  "filesLink",
  "participatedBefore",
  "musicType",
  "genres",
  "homeBase",
  "eventSize",
  "vehicle",
  "tuev",
  "awareness",
  "soundCoupling",
  "atmosphere",
  "orderPreference",
  "jointWith",
  "vehicleFilesLink",
  "sectionLeadFirstName",
  "sectionLeadLastName",
  "sectionLeadEmail",
  "sectionLeadPhone",
  "sectionLeadNote",
  "vehicleLeadFirstName",
  "vehicleLeadLastName",
  "vehicleLeadEmail",
  "vehicleLeadSize",
  "vehicleLeadPhone",
  ...SHIRT_KINDS.flatMap((kind) => SHIRT_SIZES.map((size) => `shirts.${kind}.${size}`)),
  "stewardsConfirmed",
  "privacyConfirmed",
];

export function firstErrorField(errors: Record<string, string>): string | null {
  return FIELD_ORDER.find((field) => field in errors) ?? Object.keys(errors)[0] ?? null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | "" {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

function pickYesNo(value: unknown): YesNoValue {
  return value === "yes" || value === "no" ? value : "";
}

/**
 * A draft from localStorage, checked field by field; unknown or broken parts
 * fall back to empty. Confirmations are never restored.
 */
export function parseDraft(raw: unknown): FormValues {
  const values = emptyFormValues();
  if (typeof raw !== "object" || raw === null) return values;
  const draft = raw as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const value = draft[field];
    if (typeof value === "string") values[field] = value.slice(0, 5000);
  }
  values.participatedBefore = pickYesNo(draft.participatedBefore);
  values.musicType = pick(draft.musicType, MUSIC_TYPES);
  values.genres = Array.isArray(draft.genres)
    ? [...new Set(draft.genres.filter((genre): genre is Genre => (GENRES as readonly unknown[]).includes(genre)))].slice(0, 3)
    : [];
  values.homeBase = pick(draft.homeBase, HOME_BASES);
  values.eventSize = pick(draft.eventSize, EVENT_SIZES);
  values.vehicle = pick(draft.vehicle, VEHICLES);
  values.tuev = pickYesNo(draft.tuev);
  values.soundCoupling = pickYesNo(draft.soundCoupling);
  values.vehicleLeadSize = pick(draft.vehicleLeadSize, VEST_SIZES);
  const shirts = draft.shirts as Record<string, Record<string, unknown>> | undefined;
  for (const kind of SHIRT_KINDS) {
    for (const size of SHIRT_SIZES) {
      const value = shirts?.[kind]?.[size];
      if (typeof value === "string" && /^\d{0,3}$/.test(value)) values.shirts[kind][size] = value;
    }
  }
  return values;
}
