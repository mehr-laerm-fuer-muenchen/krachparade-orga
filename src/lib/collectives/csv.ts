import { registrationCosts } from "./costs";
import {
  EVENT_SIZE_LABELS,
  HOME_BASE_LABELS,
  MUSIC_TYPE_LABELS,
  REGISTRATION_STATUS_LABELS,
  SHIRT_KINDS,
  SHIRT_KIND_LABELS,
  SHIRT_SIZES,
  VEHICLE_LABELS,
  type EventSize,
  type HomeBase,
  type MusicType,
  type RegistrationStatus,
  type ShirtOrder,
  type Vehicle,
  type VestSize,
} from "./options";

/** One stored registration as the CSV export needs it (spec 031). */
export type CsvRegistration = {
  createdAt: Date;
  status: RegistrationStatus;
  internalNote: string | null;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  collectiveName: string;
  displayName: string;
  demands: string;
  instagram: string | null;
  tiktok: string | null;
  filesLink: string | null;
  participatedBefore: boolean;
  musicType: MusicType;
  genres: readonly string[];
  homeBase: HomeBase;
  eventSize: EventSize;
  vehicle: Vehicle;
  tuev: boolean | null;
  awareness: string;
  soundCoupling: boolean;
  atmosphere: string;
  orderPreference: string | null;
  jointWith: string | null;
  vehicleFilesLink: string | null;
  sectionLeadFirstName: string | null;
  sectionLeadLastName: string | null;
  sectionLeadEmail: string | null;
  sectionLeadPhone: string | null;
  sectionLeadNote: string | null;
  vehicleLeadFirstName: string;
  vehicleLeadLastName: string;
  vehicleLeadEmail: string;
  vehicleLeadSize: VestSize;
  vehicleLeadPhone: string;
  shirts: ShirtOrder;
};

function yesNo(value: boolean | null): string {
  if (value === null) return "–";
  return value ? "Ja" : "Nein";
}

/** "18.11.2026 14:05" in Europe/Berlin. */
function formatDateTime(moment: Date): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(moment);
}

const COLUMNS: [header: string, value: (entry: CsvRegistration) => string | number | null][] = [
  ["Eingegangen", (entry) => formatDateTime(entry.createdAt)],
  ["Status", (entry) => REGISTRATION_STATUS_LABELS[entry.status]],
  ["Interne Notiz", (entry) => entry.internalNote],
  ["Vorname Hauptansprechpartner/in", (entry) => entry.contactFirstName],
  ["Nachname Hauptansprechpartner/in", (entry) => entry.contactLastName],
  ["E-Mail Hauptansprechpartner/in", (entry) => entry.contactEmail],
  ["Telefon Hauptansprechpartner/in", (entry) => entry.contactPhone],
  ["Name Kollektiv", (entry) => entry.collectiveName],
  ["Schreibweise", (entry) => entry.displayName],
  ["Forderungen", (entry) => entry.demands],
  ["Instagram", (entry) => entry.instagram],
  ["TikTok", (entry) => entry.tiktok],
  ["Link Dateien Kollektiv", (entry) => entry.filesLink],
  ["Schon teilgenommen", (entry) => yesNo(entry.participatedBefore)],
  ["Musik", (entry) => MUSIC_TYPE_LABELS[entry.musicType]],
  ["Genres", (entry) => entry.genres.join(", ")],
  ["Homebase", (entry) => HOME_BASE_LABELS[entry.homeBase]],
  ["Leute pro Event", (entry) => EVENT_SIZE_LABELS[entry.eventSize]],
  ["Fahrzeug", (entry) => VEHICLE_LABELS[entry.vehicle]],
  ["TÜV", (entry) => yesNo(entry.tuev)],
  ["Awareness / Code of Conduct", (entry) => entry.awareness],
  ["Soundkopplung", (entry) => yesNo(entry.soundCoupling)],
  ["Atmosphäre", (entry) => entry.atmosphere],
  ["Wunsch Wagenreihenfolge", (entry) => entry.orderPreference],
  ["Zusammenschluss mit", (entry) => entry.jointWith],
  ["Link Dateien Wagen", (entry) => entry.vehicleFilesLink],
  ["Vorname Abschnittsleitung", (entry) => entry.sectionLeadFirstName],
  ["Nachname Abschnittsleitung", (entry) => entry.sectionLeadLastName],
  ["E-Mail Abschnittsleitung", (entry) => entry.sectionLeadEmail],
  ["Telefon Abschnittsleitung", (entry) => entry.sectionLeadPhone],
  ["Anmerkung Abschnittsleitung", (entry) => entry.sectionLeadNote],
  ["Vorname Wagenverantwortliche/r", (entry) => entry.vehicleLeadFirstName],
  ["Nachname Wagenverantwortliche/r", (entry) => entry.vehicleLeadLastName],
  ["E-Mail Wagenverantwortliche/r", (entry) => entry.vehicleLeadEmail],
  ["Westengröße Wagenverantwortliche/r", (entry) => entry.vehicleLeadSize],
  ["Telefon Wagenverantwortliche/r", (entry) => entry.vehicleLeadPhone],
  ...SHIRT_KINDS.flatMap((kind) =>
    SHIRT_SIZES.map(
      (size) =>
        [`T-Shirts ${SHIRT_KIND_LABELS[kind]} ${size}`, (entry: CsvRegistration) => entry.shirts[kind][size]] as [
          string,
          (entry: CsvRegistration) => number,
        ]
    )
  ),
  ["Kosten gesamt (€)", (entry) => registrationCosts(entry).total],
];

/**
 * One cell: quoted when needed; text starting with = + - @ (or tab / CR) gets
 * a leading ' so spreadsheet programs never run it as a formula.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Semicolon separated, CRLF line ends, with BOM so Excel reads UTF-8. */
export function registrationsCsv(entries: readonly CsvRegistration[]): string {
  const lines = [
    COLUMNS.map(([header]) => csvCell(header)).join(";"),
    ...entries.map((entry) => COLUMNS.map(([, value]) => csvCell(value(entry))).join(";")),
  ];
  return `﻿${lines.join("\r\n")}\r\n`;
}
