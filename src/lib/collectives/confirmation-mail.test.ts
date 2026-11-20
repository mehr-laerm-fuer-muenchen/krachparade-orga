import { describe, expect, it } from "vitest";
import { confirmationMail, singleLine } from "./confirmation-mail";
import { emptyShirtOrder } from "./options";
import { registrationInput } from "./registration-schema";
import { validRegistrationInput } from "./test-data";

function mailFor(overrides: Parameters<typeof validRegistrationInput>[0] = {}) {
  return confirmationMail(registrationInput.parse(validRegistrationInput(overrides)), "2027-05-08");
}

describe("confirmationMail", () => {
  it("goes to the contact person, vehicle lead in CC", () => {
    const mail = mailFor();
    expect(mail.to).toBe("robin.beispiel@example.org");
    expect(mail.cc).toBe("kai.probe@example.org");
    expect(mail.subject).toBe("Eure Anmeldung zur Krachparade 08.05.2027: Testkollektiv Lautstark");
  });

  it("has no CC when both addresses are the same", () => {
    expect(mailFor({ vehicleLeadEmail: "robin.beispiel@example.org" }).cc).toBeNull();
  });

  it("sums up the registration with costs", () => {
    const shirts = emptyShirtOrder();
    shirts.standard.M = 2;
    const { text } = mailFor({ shirts });
    expect(text).toContain("Hallo Robin,");
    expect(text).toContain("Krachparade am 08.05.2027");
    expect(text).toContain("Fahrzeug: Kleiner LKW");
    expect(text).toContain("TÜV über uns: ja");
    expect(text).toContain("Abschnittsleitung gemeldet: ja");
    expect(text).toContain("Standard: 2 × M");
    expect(text).toContain("Summe: 310 €");
    expect(text).toContain("erst nach unserer Bestätigung");
  });

  it("never contains phone numbers or free texts", () => {
    const { text, subject } = mailFor({ orderPreference: "Bitte ganz vorne", sectionLeadNote: "Nur vormittags" });
    for (const phone of ["0000001", "0000002", "0000003"]) expect(text).not.toContain(phone);
    expect(text).not.toContain("Subkultur");
    expect(text).not.toContain("Awareness");
    expect(text).not.toContain("ganz vorne");
    expect(text).not.toContain("vormittags");
    expect(subject).not.toContain("\n");
  });

  it("leaves out TÜV and section lead without a motor", () => {
    const { text } = mailFor({ vehicle: "non_motorized", tuev: null });
    expect(text).not.toContain("TÜV über uns");
    expect(text).not.toContain("Abschnittsleitung");
    expect(text).toContain("T-Shirts: keine");
    expect(text).toContain("Summe: 150 €");
  });

  it("reports a missing section lead", () => {
    const { text } = mailFor({ sectionLeadFirstName: "", sectionLeadLastName: "", sectionLeadEmail: "" });
    expect(text).toContain("Abschnittsleitung gemeldet: nein");
  });

  it("keeps names on one line", () => {
    const { subject, text } = mailFor({ collectiveName: "Lautstark\r\nBcc: fremd@example.org" });
    expect(subject).toBe("Eure Anmeldung zur Krachparade 08.05.2027: Lautstark Bcc: fremd@example.org");
    expect(text).toContain("Kollektiv: Lautstark Bcc: fremd@example.org\n");
    expect(singleLine(" a\n\n b\t c ")).toBe("a b c");
  });
});
