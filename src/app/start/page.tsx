import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Krachparade Orga – Planungs-App der Krachparade",
};

const LINK = "flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4";

/**
 * Public start page (spec 036). The proxy shows it at "/" to visitors
 * without a session, so Google's branding review can see what the app is for.
 * Signed-in members get the plan at "/" instead.
 */
export default function StartPage() {
  return (
    <>
      <header className="border-b-[3px] border-accent bg-header-bg pt-[env(safe-area-inset-top)] text-header-text">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-[max(1rem,env(safe-area-inset-left))] py-2 desk:px-6">
          <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
            <Image
              src="/mlfm-logo.png"
              alt="Mehr Lärm für München"
              width={44}
              height={44}
              priority
              className="size-11 object-cover"
            />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-base font-semibold">Krachparade Orga</span>
            <span className="truncate text-xs text-header-muted">Mehr Lärm für München</span>
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] desk:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Krachparade Orga</h1>
          <p>
            Die interne Planungs-App der Kern-Orga der Krachparade in München. Betrieben wird
            sie von der Initiative Mehr Lärm für München.
          </p>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Wofür die App da ist</h2>
          <p>Mit der App plant die Orga die Krachparade 2027:</p>
          <ul className="list-disc pl-5">
            <li>Zeitplan und Aufgaben bis zum Tag der Parade</li>
            <li>Arbeitskreise und wer woran arbeitet</li>
            <li>Protokolle der Orga-Treffen</li>
            <li>Anmeldung und Übersicht der teilnehmenden Kollektive</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Wer sie nutzen kann</h2>
          <p>
            Nur freigeschaltete Mitglieder der Orga. Ein öffentliches Konto gibt es nicht.
            Kollektive, die bei der Krachparade mitfahren wollen, melden sich über ein eigenes
            Formular an.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Anmeldung mit Google</h2>
          <p>
            Google dient nur zum Anmelden. Die App erhält dabei deinen Namen und deine
            E-Mail-Adresse, nutzt keine weiteren Google-Dienste und gibt keine Daten an Dritte
            weiter.
          </p>
        </section>

        <Link
          href="/login"
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent desk:w-auto desk:self-start"
        >
          Anmelden
        </Link>

        <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-6">
          <Link href="/datenschutz" className={LINK}>
            Datenschutzerklärung
          </Link>
          <a href="https://krachparade.de" target="_blank" rel="noreferrer" className={LINK}>
            Impressum
          </a>
        </nav>
      </main>
    </>
  );
}
