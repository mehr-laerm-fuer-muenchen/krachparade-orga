import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type {
  EventSize,
  HomeBase,
  MusicType,
  RegistrationStatus,
  Vehicle,
  VestSize,
} from "@/lib/collectives/options";
import type { RegistrationData } from "@/lib/collectives/registration-schema";
import { db } from "./index";
import { collectiveRegistrations, editions, type CollectiveRegistration } from "./schema";

// Spec 031: registrations of collectives. Pages and actions check access
// before calling these functions.

/** A stored registration with the text columns narrowed to their options. */
export type Registration = Omit<
  CollectiveRegistration,
  "status" | "musicType" | "homeBase" | "eventSize" | "vehicle" | "vehicleLeadSize"
> & {
  status: RegistrationStatus;
  musicType: MusicType;
  homeBase: HomeBase;
  eventSize: EventSize;
  vehicle: Vehicle;
  vehicleLeadSize: VestSize;
};

/** Checked form input → row values (confirmations become timestamps). */
export function registrationRow(data: RegistrationData, editionId: string, now: Date) {
  const { stewardsConfirmed, privacyConfirmed, ...fields } = data;
  if (stewardsConfirmed !== true || privacyConfirmed !== true) {
    throw new Error("Bestätigungen fehlen");
  }
  return { ...fields, editionId, stewardsConfirmedAt: now, privacyConfirmedAt: now };
}

/** All registrations of an edition, newest first. */
export async function listRegistrations(editionId: string): Promise<Registration[]> {
  const rows = await db
    .select()
    .from(collectiveRegistrations)
    .where(eq(collectiveRegistrations.editionId, editionId))
    .orderBy(desc(collectiveRegistrations.createdAt));
  return rows as Registration[];
}

/** One registration of an edition, or null. */
export async function getRegistration(editionId: string, id: string): Promise<Registration | null> {
  const [row] = await db
    .select()
    .from(collectiveRegistrations)
    .where(and(eq(collectiveRegistrations.editionId, editionId), eq(collectiveRegistrations.id, id)))
    .limit(1);
  return (row as Registration | undefined) ?? null;
}

/** Name and cost inputs for the thank-you page; only shortly after sending. */
export async function getRecentRegistrationSummary(
  id: string,
  withinMinutes: number
): Promise<{ collectiveName: string; tuev: boolean | null; shirts: CollectiveRegistration["shirts"] } | null> {
  const [row] = await db
    .select({
      collectiveName: collectiveRegistrations.collectiveName,
      tuev: collectiveRegistrations.tuev,
      shirts: collectiveRegistrations.shirts,
    })
    .from(collectiveRegistrations)
    .where(
      and(
        eq(collectiveRegistrations.id, id),
        gte(collectiveRegistrations.createdAt, sql`now() - make_interval(mins => ${Math.trunc(withinMinutes)})`)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function countRegistrations(editionId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(collectiveRegistrations)
    .where(eq(collectiveRegistrations.editionId, editionId));
  return row?.total ?? 0;
}

/** Same collective name (ignoring case) and contact e-mail in the edition. */
export async function registrationExists(
  editionId: string,
  collectiveName: string,
  contactEmail: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: collectiveRegistrations.id })
    .from(collectiveRegistrations)
    .where(
      and(
        eq(collectiveRegistrations.editionId, editionId),
        sql`lower(${collectiveRegistrations.collectiveName}) = lower(${collectiveName})`,
        eq(collectiveRegistrations.contactEmail, contactEmail)
      )
    )
    .limit(1);
  return Boolean(row);
}

export async function setRegistrationWindow(editionId: string, opensOn: string | null, closesOn: string | null) {
  await db
    .update(editions)
    .set({ registrationOpensOn: opensOn, registrationClosesOn: closesOn })
    .where(eq(editions.id, editionId));
}
