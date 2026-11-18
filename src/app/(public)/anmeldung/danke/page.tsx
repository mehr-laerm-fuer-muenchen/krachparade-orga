import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { PageTitle } from "@/components/placeholder";
import { getRecentRegistrationSummary } from "@/db/collectives";
import { DEPOSIT_EUR, formatEuro, registrationCosts } from "@/lib/collectives/costs";
import { THANKS_VISIBLE_MINUTES } from "@/lib/collectives/limits";
import { ORGA_EMAIL } from "@/lib/collectives/options";

export const metadata: Metadata = {
  title: "Danke – Anmeldung Krachparade 2027",
};

/**
 * After sending (spec 031): name and costs only, never contact details, and
 * only shortly after sending.
 */
export default function ThanksPage({ searchParams }: PageProps<"/anmeldung/danke">) {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Danke, eure Anmeldung ist da!</PageTitle>
      <Suspense fallback={null}>
        <Summary searchParams={searchParams} />
      </Suspense>
      <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
        <p>
          Die Anmeldung ist <strong>verbindlich</strong>, sobald wir sie bestätigt haben. Überweist erst nach unserer
          Bestätigung.
        </p>
        <p>Macht euch am besten einen Screenshot dieser Seite.</p>
        <p className="text-muted">Fragen oder Änderungen? Schreibt uns an {ORGA_EMAIL}.</p>
      </div>
    </div>
  );
}

async function Summary({ searchParams }: Pick<PageProps<"/anmeldung/danke">, "searchParams">) {
  await connection();
  const { id } = await searchParams;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return null;
  const registration = await getRecentRegistrationSummary(parsed.data, THANKS_VISIBLE_MINUTES);
  if (!registration) return null;
  const costs = registrationCosts(registration);
  return (
    <section aria-labelledby="zusammenfassung" className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
      <h2 id="zusammenfassung" className="text-lg font-semibold">
        {registration.collectiveName}
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt>Pfand für das Wagenpaket</dt>
        <dd className="text-right tabular-nums">{formatEuro(DEPOSIT_EUR)}</dd>
        <dt>TÜV</dt>
        <dd className="text-right tabular-nums">{formatEuro(costs.tuev)}</dd>
        <dt>T-Shirts Standard</dt>
        <dd className="text-right tabular-nums">{formatEuro(costs.shirtsStandard)}</dd>
        <dt>T-Shirts Soli</dt>
        <dd className="text-right tabular-nums">{formatEuro(costs.shirtsSoli)}</dd>
        <dt className="border-t border-line pt-1 font-semibold">Summe</dt>
        <dd className="border-t border-line pt-1 text-right font-semibold tabular-nums" data-testid="danke-summe">
          {formatEuro(costs.total)}
        </dd>
      </dl>
    </section>
  );
}
