import { describe, expect, it } from "vitest";
import { csvCell, registrationsCsv, type CsvRegistration } from "./csv";
import { emptyShirtOrder } from "./options";
import { registrationInput } from "./registration-schema";
import { summarizeRegistrations } from "./summary";
import { validRegistrationInput } from "./test-data";

function stored(overrides: Partial<CsvRegistration> = {}): CsvRegistration {
  const data = registrationInput.parse(validRegistrationInput());
  return {
    ...data,
    createdAt: new Date("2027-01-20T10:15:00Z"),
    confirmationSentAt: null,
    status: "new",
    internalNote: null,
    ...overrides,
  };
}

describe("summarizeRegistrations", () => {
  it("counts by status and leaves rejected ones out of the figures", () => {
    const shirts = emptyShirtOrder();
    shirts.standard.M = 2;
    const summary = summarizeRegistrations([
      stored({ status: "accepted", shirts }),
      stored({
        status: "waitlist",
        vehicle: "non_motorized",
        tuev: null,
        soundCoupling: false,
        sectionLeadFirstName: null,
        sectionLeadLastName: null,
        sectionLeadEmail: null,
        vehicleLeadSize: "XXL",
      }),
      stored({ status: "rejected", vehicle: "truck_large" }),
    ]);

    expect(summary.total).toBe(3);
    expect(summary.byStatus).toEqual({ new: 0, accepted: 1, waitlist: 1, rejected: 1 });
    expect(summary.counted).toBe(2);
    expect(summary.byVehicle.truck_small).toBe(1);
    expect(summary.byVehicle.non_motorized).toBe(1);
    expect(summary.byVehicle.truck_large).toBe(0);
    expect(summary.tuev).toBe(1);
    expect(summary.soundCoupling).toBe(1);
    expect(summary.sectionLeads).toBe(1);
    expect(summary.vests).toEqual({ S: 0, L: 1, XXL: 1 });
    expect(summary.shirts.standard.M).toBe(2);
    // 150 + 100 + 60, plus 150 for the collective without a motor.
    expect(summary.expectedPayments).toBe(460);
  });

  it("works for an empty list", () => {
    const summary = summarizeRegistrations([]);
    expect(summary.total).toBe(0);
    expect(summary.expectedPayments).toBe(0);
  });
});

describe("csv", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell('Sag "Hallo"; tschüss')).toBe('"Sag ""Hallo""; tschüss"');
    expect(csvCell("Zeile 1\nZeile 2")).toBe('"Zeile 1\nZeile 2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(3)).toBe("3");
  });

  it("defuses formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+49 000 0000001")).toBe("'+49 000 0000001");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@kollektiv")).toBe("'@kollektiv");
  });

  it("starts with a BOM and has one line per registration", () => {
    const csv = registrationsCsv([
      stored(),
      stored({ collectiveName: "Zweites", confirmationSentAt: new Date("2027-01-20T10:16:00Z") }),
    ]);
    expect(csv.startsWith("﻿Eingegangen;Status;Bestätigung verschickt;")).toBe(true);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("20.01.2027, 11:15;Neu;nein;");
    expect(lines[2]).toContain(";Neu;20.01.2027, 11:16;");
    expect(lines[1]).toContain("Testkollektiv Lautstark");
    expect(lines[1]).toContain(";Ja;");
    expect(lines[1].endsWith(";250")).toBe(true);
  });
});
