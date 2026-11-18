import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { CollectivesList, type CollectiveListEntry } from "@/components/collectives/collectives-list";
import {
  CopyRegistrationLink,
  DeleteAllRegistrations,
  RegistrationWindowForm,
} from "@/components/collectives/collectives-tools";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { listRegistrations } from "@/db/collectives";
import { getCurrentEdition } from "@/db/editions";
import { formatEuro } from "@/lib/collectives/costs";
import { ShirtOverview } from "@/components/collectives/shirt-overview";
import {
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  VEHICLES,
  VEHICLE_SHORT_LABELS,
  VEST_SIZES,
} from "@/lib/collectives/options";
import { isConfirmationMissing } from "@/lib/collectives/mail-status";
import { isPastRetention, retentionEnd } from "@/lib/collectives/retention";
import { shirtOverview } from "@/lib/collectives/shirts";
import { summarizeRegistrations } from "@/lib/collectives/summary";
import { registrationState } from "@/lib/collectives/window";
import { formatGermanDate, todayInBerlin } from "@/lib/dday";

export const metadata: Metadata = {
  title: "Kollektive – Krachparade Orga",
};

/** Registrations of the collectives (spec 031), signed-in members only. */
export default function CollectivesPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Kollektive</PageTitle>
      <Suspense fallback={<p className="text-muted">Lade Anmeldungen …</p>}>
        <Overview />
      </Suspense>
    </div>
  );
}

const berlinDay = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function Tile({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {children ? <span className="text-sm text-muted">{children}</span> : null}
    </div>
  );
}

async function Overview() {
  const [viewer, edition] = await Promise.all([getCurrentMember(), getCurrentEdition()]);
  if (!edition) {
    return <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Es gibt keine aktuelle Ausgabe.</p>;
  }
  const now = new Date();
  const today = todayInBerlin(now);
  const registrations = await listRegistrations(edition.id);
  const summary = summarizeRegistrations(registrations);
  const state = registrationState(
    { opensOn: edition.registrationOpensOn, closesOn: edition.registrationClosesOn },
    today
  );
  const retentionLabel = formatGermanDate(retentionEnd(edition.dDay));
  const pastRetention = isPastRetention(edition.dDay, today);

  const entries: CollectiveListEntry[] = registrations.map((entry) => ({
    id: entry.id,
    collectiveName: entry.collectiveName,
    status: entry.status,
    vehicle: entry.vehicle,
    tuev: entry.tuev,
    soundCoupling: entry.soundCoupling,
    homeBase: entry.homeBase,
    genres: entry.genres,
    createdLabel: berlinDay.format(entry.createdAt),
    mailMissing: isConfirmationMissing(entry.confirmationSentAt, entry.createdAt, now),
  }));

  const windowText =
    state === "open"
      ? `Anmeldung offen bis ${formatGermanDate(edition.registrationClosesOn!)}`
      : state === "upcoming"
        ? `Anmeldung öffnet am ${formatGermanDate(edition.registrationOpensOn!)}`
        : state === "closed"
          ? `Anmeldung geschlossen seit ${formatGermanDate(edition.registrationClosesOn!)}`
          : "Anmeldung geschlossen (kein Zeitfenster)";

  return (
    <>
      {pastRetention && summary.total > 0 ? (
        <p role="alert" className="rounded-md border border-hint-border bg-hint-bg px-4 py-3 font-medium">
          Löschfrist erreicht: Die Anmeldungen müssen gelöscht werden.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 desk:flex-row desk:flex-wrap desk:items-center desk:justify-between">
        <p className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${state === "open" ? "bg-status-done" : "bg-line-strong"}`}
          />
          <span data-testid="zeitfenster">{windowText}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyRegistrationLink />
          <a
            href="/kollektive/export"
            download
            className="flex min-h-11 items-center rounded-md border border-line-strong bg-surface px-4 font-medium hover:bg-surface-2"
          >
            CSV exportieren
          </a>
        </div>
      </div>

      <section aria-label="Kennzahlen" className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
          <Tile label="Anmeldungen" value={summary.total}>
            {REGISTRATION_STATUSES.map((status) => `${summary.byStatus[status]} ${REGISTRATION_STATUS_LABELS[status].toLowerCase()}`).join(" · ")}
          </Tile>
          <Tile label="TÜV" value={summary.tuev}>
            ohne Absagen
          </Tile>
          <Tile label="Soundkopplung" value={summary.soundCoupling}>
            ohne Absagen
          </Tile>
          <Tile label="Abschnittsleitungen" value={summary.sectionLeads}>
            freiwillig gemeldet
          </Tile>
        </div>
        <div className="grid gap-3 desk:grid-cols-2">
          <Tile label="Fahrzeuge (ohne Absagen)" value={summary.counted}>
            {VEHICLES.map((vehicle) => `${summary.byVehicle[vehicle]} ${VEHICLE_SHORT_LABELS[vehicle]}`).join(" · ")}
          </Tile>
          <Tile label="Erwartete Zahlungen (ohne Absagen)" value={formatEuro(summary.expectedPayments)}>
            Pfand, TÜV und T-Shirts
          </Tile>
        </div>
        <details className="rounded-md border border-line bg-surface px-4 py-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">Westen</summary>
          <div className="flex flex-col gap-3 pb-2">
            <p>
              <span className="text-muted">Westen Wagenverantwortliche: </span>
              {VEST_SIZES.map((size) => `${size}: ${summary.vests[size]}`).join(" · ")}
            </p>
          </div>
        </details>
      </section>

      <CollectivesList entries={entries} />

      <ShirtOverview overview={shirtOverview(registrations)} />

      {viewer.isAdmin ? (
        <section
          aria-labelledby="admin"
          className="flex flex-col gap-5 rounded-md border border-line bg-surface p-4"
        >
          <h2 id="admin" className="text-lg font-semibold">
            Für Admins
          </h2>
          <RegistrationWindowForm
            opensOn={edition.registrationOpensOn ?? ""}
            closesOn={edition.registrationClosesOn ?? ""}
          />
          <DeleteAllRegistrations count={summary.total} allowed={pastRetention} allowedFromLabel={retentionLabel} />
        </section>
      ) : null}
    </>
  );
}
