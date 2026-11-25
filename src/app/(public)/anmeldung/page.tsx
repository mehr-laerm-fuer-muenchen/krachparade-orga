import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RegistrationForm } from "@/components/collectives/registration-form";
import { PageTitle } from "@/components/placeholder";
import { getCurrentEdition } from "@/db/editions";
import { DEPOSIT_EUR, TUEV_EUR } from "@/lib/collectives/costs";
import { newFormToken } from "@/lib/collectives/form-token";
import { ORGA_EMAIL } from "@/lib/collectives/options";
import { retentionEnd } from "@/lib/collectives/retention";
import { turnstileEnvFromProcess, turnstileMode } from "@/lib/collectives/turnstile";
import { registrationState } from "@/lib/collectives/window";
import { formatGermanDate, todayInBerlin } from "@/lib/dday";

export const metadata: Metadata = {
  title: "Anmeldung Krachparade 2027",
};

/** Public registration form of the collectives, no login (spec 031). */
export default function RegistrationPage() {
  return (
    <Suspense fallback={<p className="text-muted">Lade Anmeldung …</p>}>
      <Registration />
    </Suspense>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>{title}</PageTitle>
      <p className="rounded-md border border-line bg-surface px-4 py-3">{children}</p>
    </div>
  );
}

async function Registration() {
  await connection();
  const edition = await getCurrentEdition();
  const today = todayInBerlin(new Date());
  const state = edition
    ? registrationState({ opensOn: edition.registrationOpensOn, closesOn: edition.registrationClosesOn }, today)
    : "not_configured";

  if (!edition || state !== "open") {
    return (
      <Notice title="Anmeldung Krachparade">
        {state === "upcoming" && edition?.registrationOpensOn
          ? `Die Anmeldung öffnet am ${formatGermanDate(edition.registrationOpensOn)}.`
          : `Die Anmeldung ist geschlossen. Fragen? Schreibt uns an ${ORGA_EMAIL}.`}
      </Notice>
    );
  }

  const turnstile = turnstileMode(turnstileEnvFromProcess());
  if (turnstile.mode === "misconfigured") {
    // Production without Turnstile keys: the action would refuse every
    // registration, so say so right away.
    return (
      <Notice title="Anmeldung Krachparade">
        {`Die Anmeldung ist gerade technisch nicht erreichbar. Bitte versucht es später noch einmal oder schreibt uns an ${ORGA_EMAIL}.`}
      </Notice>
    );
  }
  // Signed start time (spec 031 minimum fill time), checked by the action.
  const formToken = newFormToken();

  const dDay = formatGermanDate(edition.dDay);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <PageTitle>Finale Anmeldung Krachparade {dDay}</PageTitle>
        {edition.registrationClosesOn ? (
          <p className="text-sm text-muted">Anmeldung offen bis {formatGermanDate(edition.registrationClosesOn)}.</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 desk:p-6">
        <p>Hallo Lärmgemeinschaft,</p>
        <p>
          mit diesem Formular meldet ihr euch <strong>verbindlich</strong> zur Krachparade am {dDay} an, sobald wir
          eure Anmeldung bestätigt haben. Darin nennt ihr bis zu drei Personen:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Hauptansprechpartner/in</strong>: unsere Ansprechperson für euer Kollektiv. Muss keine Funktion am
            Tag der Parade haben.
          </li>
          <li>
            <strong>Wagenverantwortliche/r</strong>: am Tag der Parade unsere Ansprechperson am Wagen, spricht mit
            Fahrer/in, DJs und Technik.
          </li>
          <li>
            <strong>Abschnittsleitung</strong> (freiwillig, bei Fahrzeugen mit Motor): betreut am Tag der Demo bis zu
            drei Wagen und spricht mit der Demoleitung. Sie wird nicht am eigenen Wagen eingesetzt.
          </li>
        </ul>
        <p>
          Außerdem stellt jedes Kollektiv je nach Größe des Wagens genug <strong>Wagenordner</strong> und{" "}
          <strong>Demoordner</strong>.
        </p>
        <p>
          Die Teilnahme ist grundsätzlich <strong>kostenlos</strong>. Wir sammeln ein Pfand von {DEPOSIT_EUR} € für
          das Wagenpaket (Ordnerbinden, Warnwesten etc.) ein und zahlen es zurück, sobald das Wagenpaket wieder bei uns
          ist. Dazu kommen ggf. der TÜV ({TUEV_EUR} €) und T-Shirts. Am Ende des Formulars seht ihr die Summe.
          Überweist erst, <strong>nachdem</strong> wir eure Anmeldung bestätigt haben.
        </p>
      </div>
      <RegistrationForm
        retentionEndLabel={formatGermanDate(retentionEnd(edition.dDay))}
        formToken={formToken}
        turnstileSiteKey={turnstile.mode === "on" ? turnstile.siteKey : null}
      />
    </div>
  );
}
