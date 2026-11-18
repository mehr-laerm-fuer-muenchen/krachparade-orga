import { registrationCosts } from "./costs";
import {
  REGISTRATION_STATUSES,
  SHIRT_KINDS,
  SHIRT_SIZES,
  VEHICLES,
  VEST_SIZES,
  type RegistrationStatus,
  type ShirtOrder,
  type Vehicle,
  type VestSize,
} from "./options";

/** The fields the key figures on /kollektive need (spec 031). */
export type SummaryInput = {
  status: RegistrationStatus;
  vehicle: Vehicle;
  tuev: boolean | null;
  soundCoupling: boolean;
  sectionLeadFirstName: string | null;
  sectionLeadLastName: string | null;
  sectionLeadEmail: string | null;
  vehicleLeadSize: VestSize;
  shirts: ShirtOrder;
};

export type RegistrationSummary = {
  /** All registrations, also rejected ones. */
  total: number;
  byStatus: Record<RegistrationStatus, number>;
  /** The figures below leave out rejected registrations. */
  counted: number;
  byVehicle: Record<Vehicle, number>;
  tuev: number;
  soundCoupling: number;
  sectionLeads: number;
  vests: Record<VestSize, number>;
  shirts: ShirtOrder;
  expectedPayments: number;
};

function zeroes<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

/** A section lead counts once any of name or e-mail is given. */
export function hasSectionLead(entry: Pick<SummaryInput, "sectionLeadFirstName" | "sectionLeadLastName" | "sectionLeadEmail">): boolean {
  return Boolean(entry.sectionLeadFirstName || entry.sectionLeadLastName || entry.sectionLeadEmail);
}

export function summarizeRegistrations(entries: readonly SummaryInput[]): RegistrationSummary {
  const summary: RegistrationSummary = {
    total: entries.length,
    byStatus: zeroes(REGISTRATION_STATUSES),
    counted: 0,
    byVehicle: zeroes(VEHICLES),
    tuev: 0,
    soundCoupling: 0,
    sectionLeads: 0,
    vests: zeroes(VEST_SIZES),
    shirts: { standard: zeroes(SHIRT_SIZES), soli: zeroes(SHIRT_SIZES) },
    expectedPayments: 0,
  };

  for (const entry of entries) {
    summary.byStatus[entry.status] += 1;
    if (entry.status === "rejected") continue;
    summary.counted += 1;
    summary.byVehicle[entry.vehicle] += 1;
    if (entry.tuev === true) summary.tuev += 1;
    if (entry.soundCoupling) summary.soundCoupling += 1;
    if (hasSectionLead(entry)) summary.sectionLeads += 1;
    summary.vests[entry.vehicleLeadSize] += 1;
    for (const kind of SHIRT_KINDS) {
      for (const size of SHIRT_SIZES) {
        summary.shirts[kind][size] += entry.shirts[kind][size] ?? 0;
      }
    }
    summary.expectedPayments += registrationCosts(entry).total;
  }
  return summary;
}
