import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { getCurrentMember } from "@/components/current-member";
import { ComingSoon, PageTitle } from "@/components/placeholder";

export const metadata: Metadata = {
  title: "Einstellungen – Krachparade Orga",
};

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* "Mehr" on narrow screens: what the header holds on wide screens. */}
      <section aria-label="Mehr" className="flex flex-col gap-3 desk:hidden">
        <Link
          href="/kollektive"
          className="flex min-h-11 items-center justify-between rounded-md border border-line bg-surface px-4 text-base font-medium"
        >
          <span className="flex items-center gap-2">
            Kollektive
            <span className="rounded-sm border border-line-strong px-1 text-[11px] leading-4 font-semibold text-muted">
              R3
            </span>
          </span>
          <span aria-hidden className="text-muted">
            ›
          </span>
        </Link>
        <Suspense fallback={<div className="min-h-11" />}>
          <SignedInAs />
        </Suspense>
      </section>

      <PageTitle>Einstellungen</PageTitle>
      <ComingSoon>Ausgabe, Personen und Referate folgen in Kürze.</ComingSoon>
    </div>
  );
}

async function SignedInAs() {
  const member = await getCurrentMember();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 rounded-md border border-line bg-surface px-4">
      <p className="py-2">
        Angemeldet als <span className="font-medium">{member.name}</span>
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="min-h-11 text-base font-medium text-primary underline underline-offset-4"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}
