import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { devLogin } from "@/actions/auth";
import { listDevLoginMembers } from "@/db/members";
import { devLoginEnvFromProcess, isDevLoginEnabled } from "@/lib/dev-login";

export const metadata: Metadata = {
  title: "Dev-Login – Krachparade Orga",
};

/** Signs in a seeded test member without Google (local and preview only). */
export default function DevLoginPage({ searchParams }: PageProps<"/dev/login">) {
  if (!isDevLoginEnabled(devLoginEnvFromProcess())) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Dev-Login</h1>
      <p>Nur lokal und in der Vercel-Vorschau. Melde dich als Test-Mitglied aus dem Seed an.</p>
      <Suspense fallback={<p>Lade Test-Mitglieder …</p>}>
        <DevLoginError searchParams={searchParams} />
        <MemberButtons />
      </Suspense>
    </main>
  );
}

async function DevLoginError({ searchParams }: Pick<PageProps<"/dev/login">, "searchParams">) {
  const { fehler } = await searchParams;
  if (!fehler) {
    return null;
  }
  return (
    <p role="alert" className="text-base text-amber-900 dark:text-amber-200">
      Dev-Login hat nicht geklappt.
    </p>
  );
}

async function MemberButtons() {
  const members = await listDevLoginMembers();
  if (members.length === 0) {
    return <p>Keine Test-Mitglieder gefunden. Erst `pnpm db:seed` ausführen.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => (
        <li key={member.id}>
          <form action={devLogin}>
            <input type="hidden" name="memberId" value={member.id} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-left text-base hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Als {member.name} anmelden{member.isAdmin ? " (Admin)" : ""}
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
