import type { Metadata } from "next";
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
          className="min-h-11 w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-base font-medium text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-900"
        >
          Mit Google anmelden
        </button>
      </form>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Die Anmeldung läuft über dein Google-Konto. Wir speichern nur deinen Namen und deine
        E-Mail-Adresse, damit du Zugang zur App bekommst. Dein Passwort sehen wir nie.
      </p>
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
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-base text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
    >
      {message}
    </p>
  );
}
