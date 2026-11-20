import { formatGermanDate } from "../dday";
import { formatEuro, registrationCosts, shirtCount } from "./costs";
import { ORGA_EMAIL, SHIRT_KINDS, SHIRT_KIND_LABELS, SHIRT_SIZES, VEHICLE_LABELS, isMotorized } from "./options";
import type { RegistrationData } from "./registration-schema";
import { hasSectionLead } from "./summary";

// Spec 032: the confirmation mail after a registration. Plain text, without
// phone numbers and without free texts (demands, notes …), so the public
// form cannot be used to send other content to third parties.

export type ConfirmationInput = Pick<
  RegistrationData,
  | "contactFirstName"
  | "contactEmail"
  | "collectiveName"
  | "displayName"
  | "vehicle"
  | "tuev"
  | "soundCoupling"
  | "vehicleLeadFirstName"
  | "vehicleLeadLastName"
  | "vehicleLeadEmail"
  | "sectionLeadFirstName"
  | "sectionLeadLastName"
  | "sectionLeadEmail"
  | "shirts"
>;

export type ConfirmationMail = { to: string; cc: string | null; subject: string; text: string };

// Control characters plus the Unicode line and paragraph separators.
const CONTROL_CHARACTERS = new RegExp("[\u0000-\u001f\u007f\u2028\u2029]+", "g");

/** One line: no line breaks or other control characters (no header injection). */
export function singleLine(text: string): string {
  return text
    .replace(CONTROL_CHARACTERS, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function yesNo(value: boolean): string {
  return value ? "ja" : "nein";
}

export function confirmationMail(registration: ConfirmationInput, dDay: string): ConfirmationMail {
  const name = singleLine(registration.collectiveName);
  const costs = registrationCosts(registration);
  const motorized = isMotorized(registration.vehicle);

  const shirtLines = SHIRT_KINDS.filter((kind) => shirtCount(registration.shirts, kind) > 0).map(
    (kind) =>
      `  ${SHIRT_KIND_LABELS[kind]}: ${SHIRT_SIZES.filter((size) => registration.shirts[kind][size] > 0)
        .map((size) => `${registration.shirts[kind][size]} × ${size}`)
        .join(", ")}`
  );

  const lines = [
    `Hallo ${singleLine(registration.contactFirstName)},`,
    "",
    `danke für eure Anmeldung zur Krachparade am ${formatGermanDate(dDay)}! Sie ist bei uns angekommen.`,
    "",
    "Die Anmeldung ist verbindlich, sobald wir sie bestätigt haben. Bitte überweist erst nach unserer Bestätigung.",
    "",
    "Eure Angaben",
    `  Kollektiv: ${name}`,
    `  Schreibweise: ${singleLine(registration.displayName)}`,
    `  Fahrzeug: ${VEHICLE_LABELS[registration.vehicle]}`,
    ...(motorized ? [`  TÜV über uns: ${yesNo(registration.tuev === true)}`] : []),
    `  Soundkopplung: ${yesNo(registration.soundCoupling)}`,
    `  Wagenverantwortliche/r: ${singleLine(`${registration.vehicleLeadFirstName} ${registration.vehicleLeadLastName}`)}`,
    ...(motorized ? [`  Abschnittsleitung gemeldet: ${yesNo(hasSectionLead(registration))}`] : []),
    shirtLines.length > 0 ? "  T-Shirts:" : "  T-Shirts: keine",
    ...shirtLines,
    "",
    "Kosten",
    `  Pfand für das Wagenpaket: ${formatEuro(costs.deposit)}`,
    `  TÜV: ${formatEuro(costs.tuev)}`,
    `  T-Shirts Standard: ${formatEuro(costs.shirtsStandard)}`,
    `  T-Shirts Soli: ${formatEuro(costs.shirtsSoli)}`,
    `  Summe: ${formatEuro(costs.total)}`,
    "",
    "Das Pfand bekommt ihr zurück, sobald das Wagenpaket wieder bei uns ist.",
    "",
    `Änderungen oder Fragen? Antwortet einfach auf diese Mail oder schreibt an ${ORGA_EMAIL}.`,
    "",
    "Eure Krachparade-Orga",
    "Mehr Lärm für München",
  ];

  const cc = singleLine(registration.vehicleLeadEmail);
  const to = singleLine(registration.contactEmail);
  return {
    to,
    cc: cc && cc !== to ? cc : null,
    subject: `Eure Anmeldung zur Krachparade ${formatGermanDate(dDay)}: ${name}`,
    text: `${lines.join("\n")}\n`,
  };
}
