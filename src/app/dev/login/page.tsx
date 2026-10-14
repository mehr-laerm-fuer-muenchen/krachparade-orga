import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { devLoginEnvFromProcess, isDevLoginEnabled } from "@/lib/dev-login";

export const metadata: Metadata = {
  title: "Dev-Login – Krachparade Orga",
};

/** Placeholder until spec 002 connects the dev login to the member table. */
export default function DevLoginPage() {
  if (!isDevLoginEnabled(devLoginEnvFromProcess())) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-12">
      <h1 className="text-2xl font-semibold">Dev-Login</h1>
      <p>
        Nur lokal und in der Vercel-Vorschau. Die Anmeldung als Mitglied folgt
        mit Spec 002.
      </p>
    </main>
  );
}
