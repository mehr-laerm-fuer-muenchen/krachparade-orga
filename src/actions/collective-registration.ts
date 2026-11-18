"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { countRegistrations, registrationExists, registrationRow } from "@/db/collectives";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { collectiveRegistrations } from "@/db/schema";
import { MAX_REGISTRATIONS, MIN_FILL_SECONDS } from "@/lib/collectives/limits";
import { ORGA_EMAIL } from "@/lib/collectives/options";
import { registrationFieldErrors, registrationInput } from "@/lib/collectives/registration-schema";
import { registrationState } from "@/lib/collectives/window";
import { todayInBerlin } from "@/lib/dday";

// Spec 031: the only server action reachable WITHOUT a login (exception to
// rule 8 in AGENTS.md). It protects itself with a honeypot, a minimum fill
// time, the registration window, a duplicate check and a limit per edition.
// Form contents are never logged.

export type SubmitRegistrationResult =
  | { ok: true; id: string }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";
const ERROR_TOO_FAST = "Bitte nimm dir etwas mehr Zeit.";
const ERROR_CLOSED = "Die Anmeldung ist geschlossen.";
const ERROR_DUPLICATE = `Ihr seid schon angemeldet. Für Änderungen schreibt uns eine Mail an ${ORGA_EMAIL}.`;
const ERROR_FULL = `Die Anmeldung ist voll. Schreibt uns eine Mail an ${ORGA_EMAIL}.`;
const ERROR_INPUT = "Bitte prüft die markierten Felder.";

const meta = z.object({
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(500).optional(),
  /** Date.now() in the browser after the form has loaded. */
  startedAt: z.number().int().nonnegative(),
});

export async function submitRegistration(input: unknown, metaInput: unknown): Promise<SubmitRegistrationResult> {
  const parsedMeta = meta.safeParse(metaInput);
  if (!parsedMeta.success) return { ok: false, message: GENERIC_ERROR };
  if (parsedMeta.data.website) {
    // Pretend it worked, so bots learn nothing; nothing is stored.
    return { ok: true, id: randomUUID() };
  }
  if (Date.now() - parsedMeta.data.startedAt < MIN_FILL_SECONDS * 1000) {
    return { ok: false, message: ERROR_TOO_FAST };
  }

  const edition = await getCurrentEdition();
  const today = todayInBerlin(new Date());
  if (
    !edition ||
    registrationState({ opensOn: edition.registrationOpensOn, closesOn: edition.registrationClosesOn }, today) !==
      "open"
  ) {
    return { ok: false, message: ERROR_CLOSED };
  }

  const parsed = registrationInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: ERROR_INPUT, fieldErrors: registrationFieldErrors(parsed.error) };
  }
  const data = parsed.data;

  try {
    if (await registrationExists(edition.id, data.collectiveName, data.contactEmail)) {
      return { ok: false, message: ERROR_DUPLICATE };
    }
    if ((await countRegistrations(edition.id)) >= MAX_REGISTRATIONS) {
      return { ok: false, message: ERROR_FULL };
    }
    const [row] = await db
      .insert(collectiveRegistrations)
      .values(registrationRow(data, edition.id, new Date()))
      .onConflictDoNothing()
      .returning({ id: collectiveRegistrations.id });
    if (!row) return { ok: false, message: ERROR_DUPLICATE };
    revalidatePath("/kollektive");
    return { ok: true, id: row.id };
  } catch (error) {
    console.error(`[anmeldung] ${error instanceof Error ? error.name : "Fehler"}`);
    return { ok: false, message: GENERIC_ERROR };
  }
}
