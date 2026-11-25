"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { countRegistrations, registrationExists, registrationRow } from "@/db/collectives";
import { getCurrentEdition } from "@/db/editions";
import { db } from "@/db/index";
import { collectiveRegistrations } from "@/db/schema";
import { confirmationMail, type ConfirmationMail } from "@/lib/collectives/confirmation-mail";
import { checkFormToken } from "@/lib/collectives/form-token";
import { MAX_REGISTRATIONS, MIN_FILL_SECONDS } from "@/lib/collectives/limits";
import { sendMail } from "@/lib/mail/send";
import { ORGA_EMAIL } from "@/lib/collectives/options";
import { registrationFieldErrors, registrationInput } from "@/lib/collectives/registration-schema";
import { turnstileEnvFromProcess, turnstileMode, verifyTurnstile } from "@/lib/collectives/turnstile";
import { registrationState } from "@/lib/collectives/window";
import { todayInBerlin } from "@/lib/dday";

// Spec 031: the only server action reachable WITHOUT a login (exception to
// rule 8 in AGENTS.md). It protects itself with a honeypot, a signed start
// time (minimum fill time), Cloudflare Turnstile, the registration window, a
// duplicate check and a limit per edition; Traefik limits the requests per IP
// (docs/betrieb/anmeldung-spamschutz.md). Form contents are never logged.

export type SubmitRegistrationResult =
  | { ok: true; id: string }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";
const ERROR_TOO_FAST = "Bitte nimm dir etwas mehr Zeit.";
const ERROR_STALE = "Die Seite ist zu lange offen. Bitte neu laden – eure Eingaben bleiben erhalten.";
const ERROR_BOT_CHECK = "Die Prüfung, dass ihr kein Bot seid, hat nicht geklappt. Bitte noch einmal bestätigen.";
const ERROR_CLOSED = "Die Anmeldung ist geschlossen.";
const ERROR_DUPLICATE = `Ihr seid schon angemeldet. Für Änderungen schreibt uns eine Mail an ${ORGA_EMAIL}.`;
const ERROR_FULL = `Die Anmeldung ist voll. Schreibt uns eine Mail an ${ORGA_EMAIL}.`;
const ERROR_INPUT = "Bitte prüft die markierten Felder.";

const meta = z.object({
  /** Honeypot: hidden from people, bots fill it in. */
  website: z.string().max(500).optional(),
  /** Signed start time, issued by the page on the server (form-token.ts). */
  formToken: z.string().max(200),
  /** Cloudflare Turnstile response; missing when Turnstile is off. */
  turnstileToken: z.string().max(2048).optional(),
});

/** Sends the mail and notes the time; a failure leaves the registration as it is. */
async function sendConfirmation(registrationId: string, mail: ConfirmationMail) {
  try {
    if (!(await sendMail(mail))) return;
    await db
      .update(collectiveRegistrations)
      .set({ confirmationSentAt: new Date() })
      .where(eq(collectiveRegistrations.id, registrationId));
  } catch (error) {
    console.error(`[anmeldung] Bestätigung: ${error instanceof Error ? error.name : "Fehler"}`);
  }
}

export async function submitRegistration(input: unknown, metaInput: unknown): Promise<SubmitRegistrationResult> {
  const parsedMeta = meta.safeParse(metaInput);
  if (!parsedMeta.success) return { ok: false, message: GENERIC_ERROR };
  if (parsedMeta.data.website) {
    // Pretend it worked, so bots learn nothing; nothing is stored.
    return { ok: true, id: randomUUID() };
  }
  const started = checkFormToken(parsedMeta.data.formToken, Date.now(), process.env.AUTH_SECRET ?? "", MIN_FILL_SECONDS);
  if (started === "too_fast") return { ok: false, message: ERROR_TOO_FAST };
  if (started !== "ok") return { ok: false, message: ERROR_STALE };

  const turnstile = turnstileMode(turnstileEnvFromProcess());
  if (turnstile.mode === "misconfigured") {
    console.error("[anmeldung] Turnstile nicht eingerichtet (TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY)");
    return { ok: false, message: GENERIC_ERROR };
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

  // Last check before the database: one request to Cloudflare per attempt.
  if (turnstile.mode === "on" && !(await verifyTurnstile(parsedMeta.data.turnstileToken, turnstile.secretKey))) {
    return { ok: false, message: ERROR_BOT_CHECK };
  }

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
    // Spec 032: exactly one confirmation mail per stored registration, sent
    // after the response so the form does not wait for the mail server.
    const mail = confirmationMail(data, edition.dDay);
    after(() => sendConfirmation(row.id, mail));
    return { ok: true, id: row.id };
  } catch (error) {
    console.error(`[anmeldung] ${error instanceof Error ? error.name : "Fehler"}`);
    return { ok: false, message: GENERIC_ERROR };
  }
}
