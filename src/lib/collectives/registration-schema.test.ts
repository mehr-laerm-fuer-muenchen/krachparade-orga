import { describe, expect, it } from "vitest";
import { emptyShirtOrder } from "./options";
import {
  ERROR_DEMANDS,
  ERROR_EMAIL,
  ERROR_GENRES_MAX,
  ERROR_GENRES_MIN,
  ERROR_LINK,
  ERROR_PHONE,
  ERROR_PRIVACY,
  ERROR_REQUIRED,
  ERROR_SHIRTS,
  ERROR_STEWARDS,
  ERROR_YES_NO,
  isValidPhone,
  registrationFieldErrors,
  registrationInput,
} from "./registration-schema";
import { validRegistrationInput } from "./test-data";

function errorsOf(input: unknown) {
  const parsed = registrationInput.safeParse(input);
  if (parsed.success) return {};
  return registrationFieldErrors(parsed.error);
}

describe("registrationInput", () => {
  it("accepts a complete registration, trims and lower-cases e-mails", () => {
    const parsed = registrationInput.parse(validRegistrationInput({ contactFirstName: "  Robin  " }));
    expect(parsed.contactFirstName).toBe("Robin");
    expect(parsed.contactEmail).toBe("robin.beispiel@example.org");
    expect(parsed.tiktok).toBeNull();
    expect(parsed.orderPreference).toBeNull();
    expect(parsed.tuev).toBe(true);
  });

  it("requires the fields that were required in the Google form", () => {
    const errors = errorsOf(
      validRegistrationInput({ contactLastName: " ", awareness: "", vehicleLeadFirstName: "" })
    );
    expect(errors.contactLastName).toBe(ERROR_REQUIRED);
    expect(errors.awareness).toBe(ERROR_REQUIRED);
    expect(errors.vehicleLeadFirstName).toBe(ERROR_REQUIRED);
  });

  it("needs at least 75 characters of demands", () => {
    expect(errorsOf(validRegistrationInput({ demands: "Zu kurz." })).demands).toBe(ERROR_DEMANDS);
    expect(errorsOf(validRegistrationInput({ demands: "x".repeat(75) })).demands).toBeUndefined();
  });

  it("checks e-mails, phone numbers and links", () => {
    const errors = errorsOf(
      validRegistrationInput({
        contactEmail: "keine-mail",
        vehicleLeadPhone: "abc",
        filesLink: "http://example.org",
        sectionLeadEmail: "auch-keine",
      })
    );
    expect(errors.contactEmail).toBe(ERROR_EMAIL);
    expect(errors.vehicleLeadPhone).toBe(ERROR_PHONE);
    expect(errors.filesLink).toBe(ERROR_LINK);
    expect(errors.sectionLeadEmail).toBe(ERROR_EMAIL);
  });

  it("accepts common phone formats only", () => {
    expect(isValidPhone("+49 170 1234567")).toBe(true);
    expect(isValidPhone("0170/123-4567")).toBe(true);
    expect(isValidPhone("(089) 123456")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
    expect(isValidPhone("+++ --- ///")).toBe(false);
    expect(isValidPhone("0170 1234567 ruf an")).toBe(false);
  });

  it("allows up to three genres and needs one unless there is no music", () => {
    const four = ["Techno / Hardtech / Uptime", "Melodic / House", "Jazz / Funk", "Rap / Hip-Hop"];
    expect(errorsOf(validRegistrationInput({ genres: four as never })).genres).toBe(ERROR_GENRES_MAX);
    expect(errorsOf(validRegistrationInput({ genres: [] })).genres).toBe(ERROR_GENRES_MIN);
    expect(errorsOf(validRegistrationInput({ genres: [], musicType: "none" })).genres).toBeUndefined();
    expect(errorsOf(validRegistrationInput({ genres: ["Unbekannt" as never] })).genres).toBeDefined();
  });

  it("asks for TÜV only with a motor", () => {
    expect(errorsOf(validRegistrationInput({ tuev: null })).tuev).toBe(ERROR_YES_NO);
    const parsed = registrationInput.parse(validRegistrationInput({ vehicle: "non_motorized", tuev: null }));
    expect(parsed.tuev).toBeNull();
  });

  it("drops TÜV and section lead without a motor", () => {
    const parsed = registrationInput.parse(validRegistrationInput({ vehicle: "non_motorized", tuev: true }));
    expect(parsed.tuev).toBeNull();
    expect(parsed.sectionLeadFirstName).toBeNull();
    expect(parsed.sectionLeadEmail).toBeNull();
    expect(parsed.sectionLeadPhone).toBeNull();
  });

  it("keeps the section lead optional", () => {
    const parsed = registrationInput.parse(
      validRegistrationInput({
        sectionLeadFirstName: "",
        sectionLeadLastName: "",
        sectionLeadEmail: "",
        sectionLeadPhone: "",
      })
    );
    expect(parsed.sectionLeadFirstName).toBeNull();
    expect(parsed.sectionLeadPhone).toBeNull();
  });

  it("checks shirt counts per size", () => {
    const shirts = emptyShirtOrder();
    shirts.soli.XL = 101;
    shirts.standard.M = 1.5;
    const errors = errorsOf(validRegistrationInput({ shirts }));
    expect(errors["shirts.soli.XL"]).toBe(ERROR_SHIRTS);
    expect(errors["shirts.standard.M"]).toBe(ERROR_SHIRTS);
  });

  it("needs both confirmations", () => {
    const errors = errorsOf(
      validRegistrationInput({ stewardsConfirmed: false as never, privacyConfirmed: undefined as never })
    );
    expect(errors.stewardsConfirmed).toBe(ERROR_STEWARDS);
    expect(errors.privacyConfirmed).toBe(ERROR_PRIVACY);
  });

  it("limits text lengths", () => {
    expect(errorsOf(validRegistrationInput({ collectiveName: "x".repeat(201) })).collectiveName).toBeDefined();
    expect(errorsOf(validRegistrationInput({ atmosphere: "x".repeat(2001) })).atmosphere).toBeDefined();
  });
});
