import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { getCurrentMember } from "@/components/current-member";
import { MainNav } from "@/components/main-nav";
import { formatDLabel, formatGermanDate, todayInBerlin } from "@/lib/dday";
import { CURRENT_EDITION } from "@/lib/edition";

/** Forest header with logo, navigation (wide screens), D-Day and member. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b-[3px] border-accent bg-header-bg pt-[env(safe-area-inset-top)] text-header-text">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-4 gap-y-1 px-[max(1rem,env(safe-area-inset-left))] py-2 desk:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3 rounded-md">
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
        </Link>

        <MainNav className="order-last hidden w-full desk:block xl:order-none xl:w-auto xl:flex-1" />

        <div className="ml-auto flex items-center gap-4">
          <Suspense fallback={<DDayFallback />}>
            <DDayCounter />
          </Suspense>
          <Suspense fallback={null}>
            <SignedIn />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

function DDayBox({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span className="text-lg font-bold tabular-nums">{label}</span>
      <span className="text-xs whitespace-nowrap text-header-muted">
        Krachparade {formatGermanDate(CURRENT_EDITION.dDay)}
      </span>
    </div>
  );
}

function DDayFallback() {
  return <DDayBox label={" "} />;
}

/** "Today" is the calendar day in Berlin, always determined on the server. */
async function DDayCounter() {
  await connection();
  const today = todayInBerlin(new Date());
  return <DDayBox label={formatDLabel(today, CURRENT_EDITION.dDay)} />;
}

async function SignedIn() {
  const member = await getCurrentMember();
  return (
    <div className="hidden items-center gap-1 border-l border-white/20 pl-4 desk:flex">
      <span className="max-w-40 truncate font-medium">
        <span className="sr-only">Angemeldet als </span>
        {member.name}
      </span>
      <form action={logout}>
        <button
          type="submit"
          className="min-h-11 rounded-md px-2 text-header-muted underline underline-offset-4 hover:text-header-text"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}
