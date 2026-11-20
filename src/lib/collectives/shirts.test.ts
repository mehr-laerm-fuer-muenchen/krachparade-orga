import { describe, expect, it } from "vitest";
import { emptyShirtOrder, type RegistrationStatus, type ShirtOrder } from "./options";
import { shirtOverview, shirtSizesLabel, type ShirtOverviewInput } from "./shirts";

function order(fill: (shirts: ShirtOrder) => void): ShirtOrder {
  const shirts = emptyShirtOrder();
  fill(shirts);
  return shirts;
}

function entry(collectiveName: string, status: RegistrationStatus, shirts: ShirtOrder): ShirtOverviewInput {
  return { id: `id-${collectiveName}`, collectiveName, status, shirts };
}

describe("shirtOverview", () => {
  it("is empty without registrations", () => {
    const overview = shirtOverview([]);
    expect(overview.byCollective).toEqual([]);
    expect(overview.expected.total).toBe(0);
    expect(overview.expected.revenueTotal).toBe(0);
    expect(overview.confirmed.soliShare).toBe(0);
  });

  it("adds up pieces and revenue with the soli share", () => {
    const shirts = order((s) => {
      s.standard.M = 2;
      s.soli.L = 1;
    });
    const { expected } = shirtOverview([entry("Laut", "new", shirts)]);
    expect(expected.pieces.standard.M).toBe(2);
    expect(expected.pieces.soli.L).toBe(1);
    expect(expected.count).toEqual({ standard: 2, soli: 1 });
    expect(expected.total).toBe(3);
    expect(expected.revenue).toEqual({ standard: 60, soli: 40 });
    expect(expected.revenueTotal).toBe(100);
    expect(expected.soliShare).toBe(10);
  });

  it("leaves rejected registrations out everywhere", () => {
    const shirts = order((s) => {
      s.standard.S = 5;
    });
    const overview = shirtOverview([entry("Abgesagt", "rejected", shirts)]);
    expect(overview.expected.total).toBe(0);
    expect(overview.confirmed.total).toBe(0);
    expect(overview.byCollective).toEqual([]);
  });

  it("counts only accepted ones as confirmed, all others as expected", () => {
    const one = order((s) => {
      s.standard.M = 1;
    });
    const overview = shirtOverview([
      entry("A", "accepted", one),
      entry("B", "new", one),
      entry("C", "waitlist", one),
    ]);
    expect(overview.confirmed.total).toBe(1);
    expect(overview.confirmed.revenueTotal).toBe(30);
    expect(overview.expected.total).toBe(3);
    expect(overview.expected.revenueTotal).toBe(90);
  });

  it("lists collectives with shirts by name, with their amount", () => {
    const overview = shirtOverview([
      entry("Zebra", "new", order((s) => (s.soli.XL = 2))),
      entry("Ohne Shirts", "accepted", emptyShirtOrder()),
      entry("Ämter", "waitlist", order((s) => (s.standard.S = 1))),
    ]);
    expect(overview.byCollective.map((c) => c.collectiveName)).toEqual(["Ämter", "Zebra"]);
    expect(overview.byCollective[1]).toMatchObject({ id: "id-Zebra", status: "new", total: 2, amount: 80 });
  });
});

describe("shirtSizesLabel", () => {
  it("lists the sizes in order, or a dash", () => {
    const shirts = order((s) => {
      s.standard.L = 1;
      s.standard.M = 2;
    });
    expect(shirtSizesLabel(shirts, "standard")).toBe("2 × M, 1 × L");
    expect(shirtSizesLabel(shirts, "soli")).toBe("–");
  });
});
