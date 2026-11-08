import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { FeedbackButton } from "@/components/feedback-button";
import { getCurrentMember } from "@/components/current-member";
import { MainNav, type NavBadges } from "@/components/main-nav";
import { NewsButton } from "@/components/news-button";
import { formatCountdown, formatGermanDate, todayInBerlin } from "@/lib/dday";
import { getCurrentEdition } from "@/db/editions";
import { countNewFeedback } from "@/db/feedback";

/** Forest header with logo, navigation (wide screens), D-Day and member. */
export function AppHeader({ badges }: { badges?: NavBadges }) {
  return (
    // z-35: above the dimming behind the plan sheet on phones (z-30), so the
    // bug button stays reachable with an element open; below the sheet (z-40).
    <header className="sticky top-0 z-35 border-b-[3px] border-accent bg-header-bg pt-[env(safe-area-inset-top)] text-header-text">
      {/* Phones: one row with the logo only (navigation is in the tab bar). */}
      <div className="mx-auto flex max-w-screen-2xl items-center gap-x-2 gap-y-1 px-[max(1rem,env(safe-area-inset-left))] py-2 desk:flex-wrap desk:gap-x-4 desk:px-6">
        <Link href="/" aria-label="Krachparade Orga" className="flex min-w-0 items-center gap-3 rounded-md">
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
          {/* Phones: no app name, so bell, bug button and countdown fit (spec 015). */}
          <span className="hidden min-w-0 flex-col leading-tight desk:flex">
            <span className="truncate text-base font-semibold">Krachparade Orga</span>
            <span className="truncate text-xs text-header-muted">Mehr Lärm für München</span>
          </span>
        </Link>

        {/* Own row below logo and countdown; inline only where all seven items fit (spec 030). */}
        <MainNav
          badges={badges}
          className="order-last hidden w-full desk:block 2xl:order-none 2xl:w-auto 2xl:flex-1"
        />

        <div className="ml-auto flex shrink-0 items-center desk:gap-4">
          <Suspense fallback={<DDayFallback />}>
            <DDayCounter />
          </Suspense>
          {/* Bell always directly left of the bug button (spec 015). */}
          <NewsButton className={NEWS_ORDER} />
          {/* Phones: left of the D-Day counter; wide screens: left of the name. */}
          <Suspense fallback={<FeedbackButton className={FEEDBACK_ORDER} />}>
            <FeedbackButtonWithCount className={FEEDBACK_ORDER} />
          </Suspense>
          <Suspense fallback={null}>
            <SignedIn />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

const NEWS_ORDER = "-order-2 desk:order-none";
const FEEDBACK_ORDER = "-order-1 desk:order-none";

/**
 * Bug button with the pink number of new reports (spec 014), loaded on the
 * server like the number at "Meine" (spec 009). Only admins see it; for
 * everyone else the count is not queried. If loading fails, the number is
 * simply missing.
 */
async function FeedbackButtonWithCount({ className }: { className: string }) {
  const member = await getCurrentMember();
  let newCount = 0;
  if (member.isAdmin) {
    try {
      newCount = await countNewFeedback();
    } catch {
      newCount = 0;
    }
  }
  return <FeedbackButton className={className} newCount={newCount} />;
}

function DDayBox({
  label,
  ariaLabel,
  date,
  testId,
}: {
  label: string;
  /** Spelled-out countdown for screen readers. */
  ariaLabel?: string;
  date: string;
  testId?: string;
}) {
  return (
    <div className="flex flex-col items-end leading-tight">
      {/* Screen readers get the spelled-out text instead of "noch 204 T". */}
      {ariaLabel && <span className="sr-only">{ariaLabel}</span>}
      <span
        className="text-lg font-bold whitespace-nowrap tabular-nums"
        data-testid={testId}
        aria-hidden={ariaLabel ? true : undefined}
      >
        {label}
      </span>
      <span className="text-xs whitespace-nowrap text-header-muted">{date}</span>
    </div>
  );
}

function DDayFallback() {
  return <DDayBox label={"\u00a0"} date={"\u00a0"} />;
}

/**
 * D-Day of the current edition (spec 003). "Today" is the calendar day in
 * Berlin, always determined on the server.
 */
async function DDayCounter() {
  await connection();
  const edition = await getCurrentEdition();
  if (!edition) {
    return null;
  }
  const { label, ariaLabel } = formatCountdown(todayInBerlin(new Date()), edition.dDay);
  return (
    <DDayBox
      label={label}
      ariaLabel={ariaLabel}
      date={`Krachparade ${formatGermanDate(edition.dDay)}`}
      testId="dday-label"
    />
  );
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
