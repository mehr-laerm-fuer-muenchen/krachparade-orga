"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { findMemberById } from "@/db/members";
import { loadPlanChanges } from "@/db/plan";
import { planElements } from "@/db/schema";

// Spec 008: the change history in the detail panel. Read only; checks the
// signed-in member (active, from the database) and that the element belongs
// to the current edition, like the editing actions in ./plan.ts.

/** Entries are "Name · TT.MM. HH:MM · Text", newest first. */
export type PlanHistoryResult =
  | { ok: true; entries: { id: string; text: string }[]; total: number }
  | { ok: false; message: string };

/** Entries shown before "Alle anzeigen". */
const FIRST_ENTRIES = 10;
/** Upper limit for "Alle anzeigen". */
const ALL_ENTRIES = 1000;

const berlinTime = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "14.10. 09:05" in Europe/Berlin. */
function formatTime(date: Date): string {
  const parts = Object.fromEntries(berlinTime.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}.${parts.month}. ${parts.hour}:${parts.minute}`;
}

export async function loadPlanHistory(elementId: string, all: boolean): Promise<PlanHistoryResult> {
  const session = await auth();
  const actor = session?.memberId ? await findMemberById(session.memberId) : undefined;
  if (!actor?.active) return { ok: false, message: "Kein Zugriff." };
  const edition = await getCurrentEdition();
  const id = z.uuid().safeParse(elementId);
  if (!edition || !id.success) return { ok: false, message: "Dieses Plan-Element gibt es nicht." };
  const [element] = await db
    .select({ id: planElements.id })
    .from(planElements)
    .where(and(eq(planElements.id, id.data), eq(planElements.editionId, edition.id)))
    .limit(1);
  if (!element) return { ok: false, message: "Dieses Plan-Element gibt es nicht." };

  const { changes, total } = await loadPlanChanges(element.id, all === true ? ALL_ENTRIES : FIRST_ENTRIES);
  return {
    ok: true,
    entries: changes.map((change) => ({
      id: change.id,
      text: `${change.memberName ?? "Unbekannt"} · ${formatTime(change.createdAt)} · ${change.summary}`,
    })),
    total,
  };
}
