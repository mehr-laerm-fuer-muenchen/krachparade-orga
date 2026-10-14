import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { requireMember } from "@/auth";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold">Krachparade Orga – im Aufbau</h1>
      <Suspense fallback={<p className="min-h-11">&nbsp;</p>}>
        <SignedInAs />
      </Suspense>
    </main>
  );
}

async function SignedInAs() {
  const member = await requireMember();
  return (
    <div className="flex flex-wrap items-center gap-x-4">
      <p>
        Angemeldet als <span className="font-medium">{member.name}</span>
      </p>
      {/* Logout lives here until spec 003 adds the navigation. */}
      <form action={logout}>
        <button
          type="submit"
          className="min-h-11 text-base text-emerald-900 underline underline-offset-4 hover:text-emerald-700 dark:text-emerald-300"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}
