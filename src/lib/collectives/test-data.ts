import { emptyShirtOrder } from "./options";
import type { RegistrationInput } from "./registration-schema";

/** A complete, made-up registration for tests (spec 031). */
export function validRegistrationInput(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  return {
    contactFirstName: "Robin",
    contactLastName: "Beispiel",
    contactEmail: "Robin.Beispiel@Example.org",
    contactPhone: "+49 000 0000001",
    collectiveName: "Testkollektiv Lautstark",
    displayName: "TESTKOLLEKTIV LAUTSTARK",
    demands:
      "Mehr Freiräume für Subkultur in München, bezahlbare Proberäume und eine Stadt, in der laute Kultur Platz hat.",
    instagram: "@testkollektiv",
    tiktok: "",
    filesLink: "https://example.org/dateien",
    participatedBefore: true,
    musicType: "dj",
    genres: ["Techno / Hardtech / Uptime", "Melodic / House"],
    homeBase: "munich",
    eventSize: "50-200",
    vehicle: "truck_small",
    tuev: true,
    awareness: "Awareness-Team mit zwei Personen auf dem Wagen.",
    soundCoupling: true,
    atmosphere: "Tanzbar und solidarisch.",
    orderPreference: "",
    jointWith: null,
    vehicleFilesLink: undefined,
    sectionLeadFirstName: "Jo",
    sectionLeadLastName: "Muster",
    sectionLeadEmail: "jo.muster@example.org",
    sectionLeadPhone: "+49 000 0000002",
    sectionLeadNote: "",
    vehicleLeadFirstName: "Kai",
    vehicleLeadLastName: "Probe",
    vehicleLeadEmail: "kai.probe@example.org",
    vehicleLeadSize: "L",
    vehicleLeadPhone: "+49 000 0000003",
    shirts: emptyShirtOrder(),
    stewardsConfirmed: true,
    privacyConfirmed: true,
    ...overrides,
  };
}
