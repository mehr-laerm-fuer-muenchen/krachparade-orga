import { describe, expect, it } from "vitest";
import {
  emptyFormValues,
  firstErrorField,
  formErrors,
  parseDraft,
  shirtNumbersForCosts,
  toRegistrationInput,
  type FormValues,
} from "./form-values";
import { ERROR_GENRES_MIN, ERROR_SHIRTS, ERROR_YES_NO, registrationInput } from "./registration-schema";

function filled(overrides: Partial<FormValues> = {}): FormValues {
  return {
    ...emptyFormValues(),
    contactFirstName: "Robin",
    contactLastName: "Beispiel",
    contactEmail: "robin.beispiel@example.org",
    contactPhone: "+49 000 0000001",
    collectiveName: "E2E Testkollektiv",
    displayName: "E2E TESTKOLLEKTIV",
    demands: "x".repeat(80),
    participatedBefore: "no",
    musicType: "dj",
    genres: ["Melodic / House"],
    homeBase: "munich",
    eventSize: "1-50",
    vehicle: "truck_small",
    tuev: "yes",
    awareness: "Awareness-Team",
    soundCoupling: "no",
    atmosphere: "Tanzbar",
    vehicleLeadFirstName: "Kai",
    vehicleLeadLastName: "Probe",
    vehicleLeadEmail: "kai.probe@example.org",
    vehicleLeadSize: "L",
    vehicleLeadPhone: "+49 000 0000003",
    stewardsConfirmed: true,
    privacyConfirmed: true,
    ...overrides,
  };
}

describe("form values", () => {
  it("turns a filled form into valid input", () => {
    expect(formErrors(filled())).toEqual({});
    const parsed = registrationInput.parse(toRegistrationInput(filled()));
    expect(parsed.tuev).toBe(true);
    expect(parsed.participatedBefore).toBe(false);
    expect(parsed.shirts.standard.M).toBe(0);
  });

  it("reports every missing answer of an empty form, in page order", () => {
    const errors = formErrors(emptyFormValues());
    expect(errors.contactFirstName).toBeDefined();
    expect(errors.vehicle).toBeDefined();
    expect(errors.stewardsConfirmed).toBeDefined();
    expect(firstErrorField(errors)).toBe("contactFirstName");
  });

  it("checks genres and TÜV even while other fields are missing", () => {
    const errors = formErrors({ ...emptyFormValues(), musicType: "live", vehicle: "car" });
    expect(errors.genres).toBe(ERROR_GENRES_MIN);
    expect(errors.tuev).toBe(ERROR_YES_NO);
  });

  it("ignores the TÜV answer without a motor", () => {
    expect(toRegistrationInput(filled({ vehicle: "non_motorized", tuev: "yes" })).tuev).toBeNull();
    expect(formErrors(filled({ vehicle: "non_motorized", tuev: "" }))).toEqual({});
  });

  it("asks for a number in emptied shirt fields", () => {
    const values = filled();
    values.shirts.standard.L = "";
    values.shirts.soli.S = "abc";
    const errors = formErrors(values);
    expect(errors["shirts.standard.L"]).toBe(ERROR_SHIRTS);
    expect(errors["shirts.soli.S"]).toBe(ERROR_SHIRTS);
  });

  it("counts only valid shirt numbers for the live costs", () => {
    const values = filled();
    values.shirts.standard.M = "2";
    values.shirts.standard.L = "";
    values.shirts.soli.XL = "500";
    const order = shirtNumbersForCosts(values);
    expect(order.standard.M).toBe(2);
    expect(order.standard.L).toBe(0);
    expect(order.soli.XL).toBe(0);
  });
});

describe("parseDraft", () => {
  it("restores known fields and drops broken ones", () => {
    const values = parseDraft({
      contactFirstName: "Robin",
      musicType: "rave",
      vehicle: "car",
      tuev: "yes",
      genres: ["Melodic / House", "Unbekannt", "Melodic / House"],
      shirts: { standard: { M: "2", L: "<script>" } },
      stewardsConfirmed: true,
      privacyConfirmed: true,
    });
    expect(values.contactFirstName).toBe("Robin");
    expect(values.musicType).toBe("");
    expect(values.vehicle).toBe("car");
    expect(values.tuev).toBe("yes");
    expect(values.genres).toEqual(["Melodic / House"]);
    expect(values.shirts.standard.M).toBe("2");
    expect(values.shirts.standard.L).toBe("0");
    expect(values.stewardsConfirmed).toBe(false);
    expect(values.privacyConfirmed).toBe(false);
  });

  it("falls back to an empty form", () => {
    expect(parseDraft(null)).toEqual(emptyFormValues());
    expect(parseDraft("kaputt")).toEqual(emptyFormValues());
  });
});
