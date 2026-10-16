import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { FinalNotice } from "@/components/working-groups/board";
import { AkOverviewCardView } from "@/components/working-groups/overview";
import { loadAkOverview } from "@/db/ak-workspace";
import { todayInBerlin } from "@/lib/dday";

export const metadata: Metadata = {
  title: "AKs – Krachparade Orga",
};

const NOTICE = "rounded-md border border-line bg-surface px-4 py-3 text-muted";
const MANAGE_LINK = "flex min-h-11 items-center font-medium text-primary underline underline-offset-4";

/** Overview of all working groups (spec 018); managing them moved to /arbeitskreise/verwalten. */
export default function WorkingGroupsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-col gap-1">
          <PageTitle>AKs</PageTitle>
          <p className="text-muted">Lage je Arbeitskreis. Antippen öffnet den Arbeitsbereich.</p>
        </div>
        <Link href="/arbeitskreise/verwalten" className={`${MANAGE_LINK} text-sm`}>
          AKs verwalten
        </Link>
      </div>
      <Suspense fallback={<p className="text-muted">Lade AKs …</p>}>
        <Overview />
      </Suspense>
    </div>
  );
}

async function Overview() {
  const member = await getCurrentMember();
  const overview = await loadAkOverview(member.id, todayInBerlin(new Date()));
  if (overview.status === "no_edition") return <p className={NOTICE}>Noch keine aktuelle Ausgabe angelegt.</p>;
  if (overview.status === "cycle") {
    return (
      <p role="alert" className="font-medium text-status-late">
        Der Plan lässt sich nicht berechnen: Die Verbindungen enthalten einen Kreis. Die Lage der AKs erscheint wieder,
        sobald der Kreis im Plan aufgelöst ist.
      </p>
    );
  }

  return (
    <>
      <FinalNotice final={overview.final} isAdmin={member.isAdmin} showToggle={false} />
      {overview.cards.length === 0 ? (
        <p className={NOTICE}>
          Noch keine AKs.{" "}
          <Link href="/arbeitskreise/verwalten" className="font-medium text-primary underline underline-offset-2">
            AKs verwalten
          </Link>
        </p>
      ) : (
        <div className="grid items-start gap-4 desk:grid-cols-2">
          {overview.cards.map((card) => (
            <AkOverviewCardView key={card.id} card={card} viewerId={member.id} dDay={overview.dDay} />
          ))}
        </div>
      )}
    </>
  );
}
