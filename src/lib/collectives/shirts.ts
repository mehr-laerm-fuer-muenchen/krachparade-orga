import { SHIRT_PRICE_EUR, shirtCount } from "./costs";
import { SHIRT_KINDS, SHIRT_SIZES, emptyShirtOrder, type RegistrationStatus, type ShirtKind, type ShirtOrder } from "./options";

// Spec 033: the T-shirt overview on /kollektive. Prices only come from
// costs.ts, so the sums match the thank-you page and the confirmation mail.

export type ShirtOverviewInput = {
  id: string;
  collectiveName: string;
  status: RegistrationStatus;
  shirts: ShirtOrder;
};

export type ShirtTotals = {
  /** Pieces per kind and size. */
  pieces: ShirtOrder;
  count: Record<ShirtKind, number>;
  total: number;
  /** Revenue in whole euros. */
  revenue: Record<ShirtKind, number>;
  revenueTotal: number;
  /** Surcharge of the soli shirts over the standard price. */
  soliShare: number;
};

export type CollectiveShirts = {
  id: string;
  collectiveName: string;
  status: RegistrationStatus;
  pieces: ShirtOrder;
  total: number;
  amount: number;
};

export type ShirtOverview = {
  /** Only accepted registrations. */
  confirmed: ShirtTotals;
  /** All registrations except rejected ones. */
  expected: ShirtTotals;
  /** Collectives with at least one shirt, without rejected ones, by name. */
  byCollective: CollectiveShirts[];
};

function emptyTotals(): ShirtTotals {
  return {
    pieces: emptyShirtOrder(),
    count: { standard: 0, soli: 0 },
    total: 0,
    revenue: { standard: 0, soli: 0 },
    revenueTotal: 0,
    soliShare: 0,
  };
}

function addTo(totals: ShirtTotals, shirts: ShirtOrder) {
  for (const kind of SHIRT_KINDS) {
    for (const size of SHIRT_SIZES) totals.pieces[kind][size] += shirts[kind][size] ?? 0;
    const count = shirtCount(shirts, kind);
    totals.count[kind] += count;
    totals.total += count;
    totals.revenue[kind] += count * SHIRT_PRICE_EUR[kind];
    totals.revenueTotal += count * SHIRT_PRICE_EUR[kind];
  }
  totals.soliShare = totals.count.soli * (SHIRT_PRICE_EUR.soli - SHIRT_PRICE_EUR.standard);
}

export function shirtOverview(entries: readonly ShirtOverviewInput[]): ShirtOverview {
  const confirmed = emptyTotals();
  const expected = emptyTotals();
  const byCollective: CollectiveShirts[] = [];

  for (const entry of entries) {
    if (entry.status === "rejected") continue;
    addTo(expected, entry.shirts);
    if (entry.status === "accepted") addTo(confirmed, entry.shirts);
    const total = SHIRT_KINDS.reduce((sum, kind) => sum + shirtCount(entry.shirts, kind), 0);
    if (total === 0) continue;
    byCollective.push({
      id: entry.id,
      collectiveName: entry.collectiveName,
      status: entry.status,
      pieces: entry.shirts,
      total,
      amount: SHIRT_KINDS.reduce((sum, kind) => sum + shirtCount(entry.shirts, kind) * SHIRT_PRICE_EUR[kind], 0),
    });
  }

  byCollective.sort((a, b) => a.collectiveName.localeCompare(b.collectiveName, "de"));
  return { confirmed, expected, byCollective };
}

/** "2 × M, 1 × L", or "–" without shirts of this kind. */
export function shirtSizesLabel(pieces: ShirtOrder, kind: ShirtKind): string {
  const parts = SHIRT_SIZES.filter((size) => (pieces[kind][size] ?? 0) > 0).map(
    (size) => `${pieces[kind][size]} × ${size}`
  );
  return parts.length > 0 ? parts.join(", ") : "–";
}
