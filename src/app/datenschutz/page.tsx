import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageTitle } from "@/components/placeholder";
import { ORGA_EMAIL } from "@/lib/collectives/options";

export const metadata: Metadata = {
  title: "Datenschutzerklärung – Krachparade Orga",
};

const IMPRINT_URL = "https://krachparade.de";
const GOOGLE_PRIVACY_URL = "https://policies.google.com/privacy";
const BAYLDA_URL = "https://www.lda.bayern.de";
const LAST_UPDATED = "20.11.2026";

const linkClass = "font-medium text-primary underline underline-offset-2";

/**
 * Privacy policy (spec 035). Public, because Google links it from the OAuth
 * consent screen and the collectives see it before registering.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] desk:px-6">
      <PageTitle>Datenschutzerklärung</PageTitle>
      <p>
        Diese Erklärung gilt für die App „Krachparade Orga“ unter krachparade-orga.de: die Planungs-App der Orga und
        die Anmeldung der Kollektive zur Krachparade.
      </p>

      <Section title="Wer ist verantwortlich?">
        <address className="not-italic">
          Initiative MEHR LÄRM FÜR MÜNCHEN
          <br />
          c/o F. Raabe
          <br />
          Balanstr. 69
          <br />
          81541 München
          <br />
          E-Mail: <a className={linkClass} href={`mailto:${ORGA_EMAIL}`}>{ORGA_EMAIL}</a>
        </address>
        <p>
          Das Impressum steht auf{" "}
          <a className={linkClass} href={IMPRINT_URL}>
            krachparade.de
          </a>
          .
        </p>
      </Section>

      <Section title="Anmeldung mit Google (Orga)">
        <p>
          Die Orga meldet sich mit ihrem Google-Konto an. Dabei bekommen wir von Google nur deinen Namen und deine
          E-Mail-Adresse. Wir speichern beides zusammen mit dem Zeitpunkt deiner letzten Anmeldung, damit nur
          freigeschaltete Mitglieder hineinkommen. Dein Passwort sehen wir nie.
        </p>
        <p>
          Google erfährt dabei, dass du dich bei der Krachparade Orga anmeldest. Was Google mit Daten macht, steht in der{" "}
          <a className={linkClass} href={GOOGLE_PRIVACY_URL}>
            Datenschutzerklärung von Google
          </a>
          .
        </p>
        <p>
          Rechtsgrundlage ist unser berechtigtes Interesse an einer sicheren Planung (Art. 6 Abs. 1 lit. f DSGVO). Wir
          speichern die Daten, solange du in der Orga mitmachst. Danach löschen wir dich auf Wunsch.
        </p>
      </Section>

      <Section title="Inhalte in der App">
        <p>
          Was die Orga in der App einträgt, speichern wir: Planung, Aufgaben, Protokolle, Notizen und Feedback, jeweils
          mit dem Namen der Person, die etwas eingetragen hat oder zuständig ist. Das sehen nur angemeldete Mitglieder
          der Orga. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </Section>

      <Section title="Anmeldung der Kollektive">
        <p>
          Mit dem{" "}
          <Link className={linkClass} href="/anmeldung">
            Anmeldeformular
          </Link>{" "}
          melden sich Kollektive zur Krachparade an. Wir speichern die Angaben aus dem Formular, auch Namen,
          E-Mail-Adressen und Handynummern der Ansprechpersonen, und schicken eine Bestätigung per E-Mail an die
          angegebene Adresse.
        </p>
        <p>
          Rechtsgrundlage ist eure Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die ihr im Formular gebt. Ihr könnt sie
          jederzeit per Mail an {ORGA_EMAIL} widerrufen. Alle Anmeldungen löschen wir drei Monate nach der Krachparade.
        </p>
      </Section>

      <Section title="Cookies und Speicher im Browser">
        <p>
          Nach der Anmeldung setzt die App ein Cookie, damit du angemeldet bleibst. Ohne dieses Cookie funktioniert der
          Login nicht.
        </p>
        <p>
          Manches merkt sich die App nur auf deinem Gerät (im Speicher des Browsers), zum Beispiel hell oder dunkel und
          den Entwurf des Anmeldeformulars, bis ihr absendet. Das erreicht uns nicht.
        </p>
        <p>Es gibt keine Analyse, keine Werbung und keine Schriften, Karten oder Videos von anderen Anbietern.</p>
      </Section>

      <Section title="Wo die Daten liegen">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            <strong>Server:</strong> netcup GmbH, Karlsruhe, Rechenzentrum in Deutschland. Der Server speichert
            technisch nötige Zugriffsprotokolle (unter anderem die IP-Adresse) für kurze Zeit.
          </li>
          <li>
            <strong>Datenbank:</strong> Neon, Rechenzentrum in Frankfurt am Main.
          </li>
          <li>
            <strong>Login:</strong> Google, siehe oben.
          </li>
          <li>
            <strong>E-Mail:</strong> Bestätigungs-Mails verschicken wir über einen E-Mail-Dienst.
          </li>
        </ul>
        <p>Darüber hinaus geben wir keine Daten weiter und verkaufen nichts.</p>
      </Section>

      <Section title="Deine Rechte">
        <p>
          Du kannst Auskunft über deine Daten verlangen und sie berichtigen, löschen oder einschränken lassen. Du kannst
          widersprechen, deine Daten mitnehmen und eine Einwilligung widerrufen. Schreib uns dafür an{" "}
          <a className={linkClass} href={`mailto:${ORGA_EMAIL}`}>
            {ORGA_EMAIL}
          </a>
          .
        </p>
        <p>
          Du kannst dich auch bei einer Datenschutz-Aufsichtsbehörde beschweren, in Bayern beim{" "}
          <a className={linkClass} href={BAYLDA_URL}>
            Bayerischen Landesamt für Datenschutzaufsicht
          </a>
          .
        </p>
      </Section>

      <p className="text-sm text-muted">Stand: {LAST_UPDATED}</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
