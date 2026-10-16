import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { AkWorkspace } from "@/components/working-groups/workspace";
import { loadAkWorkspace } from "@/db/ak-workspace";
import { todayInBerlin } from "@/lib/dday";

export const metadata: Metadata = {
  title: "AK-Arbeitsbereich – Krachparade Orga",
};

// The working group id is only known at request time, so the header and tab
// bar (usePathname in the layout) cannot be prerendered for this route: it may
// block until the server has rendered it.
export const instant = false;

export default function WorkingGroupPage({ params }: PageProps<"/arbeitskreise/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<p className="text-muted">Lade Arbeitsbereich …</p>}>
        <Workspace params={params} />
      </Suspense>
    </div>
  );
}

/** Workspace of one working group (spec 018); unknown, invalid or foreign ids say so. */
async function Workspace({ params }: Pick<PageProps<"/arbeitskreise/[id]">, "params">) {
  const [{ id }, member] = await Promise.all([params, getCurrentMember()]);
  const today = todayInBerlin(new Date());
  const loaded = await loadAkWorkspace(id, member.id, today);

  if (loaded.status === "not_found") {
    return (
      <>
        <BackLink href="/arbeitskreise">Alle AKs</BackLink>
        <PageTitle>Diesen AK gibt es nicht.</PageTitle>
      </>
    );
  }
  if (loaded.status === "cycle") {
    return (
      <>
        <BackLink href="/arbeitskreise">Alle AKs</BackLink>
        <PageTitle>{loaded.title}</PageTitle>
        <p role="alert" className="font-medium text-status-late">
          Der Plan lässt sich nicht berechnen: Die Verbindungen enthalten einen Kreis. Der Arbeitsbereich erscheint
          wieder, sobald der Kreis im Plan aufgelöst ist.
        </p>
      </>
    );
  }
  return <AkWorkspace data={loaded} viewerId={member.id} today={today} />;
}
