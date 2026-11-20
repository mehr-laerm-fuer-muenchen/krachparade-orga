import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loginWithGoogle } from "@/actions/auth";
import { ACCESS_DENIED_ERROR } from "@/auth";

export const metadata: Metadata = {
  title: "Anmelden – Krachparade Orga",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Krachparade Orga</h1>

      <Suspense fallback={null}>
        <LoginError searchParams={searchParams} />
      </Suspense>

      <form action={loginWithGoogle}>
        <button
          type="submit"
          className="min-h-11 w-full rounded-lg bg-primary px-4 py-2.5 text-base font-medium text-on-primary hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Mit Google anmelden
        </button>
      </form>

      <p className="text-sm text-muted">
        Die Anmeldung läuft über dein Google-Konto. Wir speichern nur deinen Namen und deine
        E-Mail-Adresse, damit du Zugang zur App bekommst. Dein Passwort sehen wir nie.
      </p>

      <Link href="/datenschutz" className="flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">
        Datenschutzerklärung
      </Link>
    </main>
  );
}

async function LoginError({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { error } = await searchParams;
  if (!error) {
    return null;
  }
  const message =
    error === ACCESS_DENIED_ERROR
      ? "Dieses Google-Konto ist nicht für die Krachparade Orga freigeschaltet. Melde dich bei einem Admin."
      : "Die Anmeldung hat nicht geklappt. Versuch es bitte noch einmal.";
  return (
    <p
      role="alert"
      className="rounded-lg border border-status-warn bg-surface px-4 py-3 text-base text-text"
    >
      {message}
    </p>
  );
}
