import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { DeleteRegistration, RegistrationReview } from "@/components/collectives/registration-review";
import { RegistrationStatusPill } from "@/components/collectives/status-pill";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import { getRegistration, type Registration } from "@/db/collectives";
import { getCurrentEdition } from "@/db/editions";
import { DEPOSIT_EUR, formatEuro, registrationCosts } from "@/lib/collectives/costs";
import {
  EVENT_SIZE_LABELS,
  HOME_BASE_LABELS,
  MUSIC_TYPE_LABELS,
  SHIRT_KINDS,
  SHIRT_KIND_LABELS,
  SHIRT_SIZES,
  VEHICLE_LABELS,
} from "@/lib/collectives/options";
import { hasSectionLead } from "@/lib/collectives/summary";
import { formatGermanDateTime } from "@/lib/date-time";

export const metadata: Metadata = {
  title: "Anmeldung – Krachparade Orga",
};

// The id is only known at request time (as on /feedback/[id]).
export const instant = false;

export default function RegistrationDetailPage({ params }: PageProps<"/kollektive/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/kollektive">Kollektive</BackLink>
      <Suspense fallback={<p className="text-muted">Lade Anmeldung …</p>}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

function yesNo(value: boolean | null): string {
  if (value === null) return "–";
  return value ? "Ja" : "Nein";
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <dl className="grid gap-x-4 gap-y-2 desk:grid-cols-[14rem_1fr]">{children}</dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <>
      <dt className="text-sm text-muted desk:text-base">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{empty ? <span className="text-muted">–</span> : children}</dd>
    </>
  );
}

const EMPTY = <span className="text-muted">–</span>;

function Mail({ address }: { address: string | null }) {
  return address ? (
    <a href={`mailto:${address}`} className="text-primary underline underline-offset-4">
      {address}
    </a>
  ) : (
    EMPTY
  );
}

function Phone({ number }: { number: string | null }) {
  return number ? (
    <a href={`tel:${number.replace(/[^\d+]/g, "")}`} className="text-primary underline underline-offset-4">
      {number}
    </a>
  ) : (
    EMPTY
  );
}

function ExternalLink({ href }: { href: string | null }) {
  return href ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="break-all text-primary underline underline-offset-4">
      {href}
    </a>
  ) : (
    EMPTY
  );
}

async function Detail({ params }: Pick<PageProps<"/kollektive/[id]">, "params">) {
  const { id } = await params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) notFound();
  const [viewer, edition] = await Promise.all([getCurrentMember(), getCurrentEdition()]);
  if (!edition) notFound();
  const entry = await getRegistration(edition.id, parsed.data);
  if (!entry) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <PageTitle>{entry.collectiveName}</PageTitle>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          <RegistrationStatusPill status={entry.status} />
          <span>Eingegangen {formatGermanDateTime(entry.createdAt)}</span>
        </p>
        <p className="text-muted" data-testid="bestaetigung">
          Bestätigungs-Mail:{" "}
          {entry.confirmationSentAt ? (
            `verschickt am ${formatGermanDateTime(entry.confirmationSentAt)}`
          ) : (
            <span className="font-medium text-status-late">nicht verschickt</span>
          )}
        </p>
      </div>

      <RegistrationReview id={entry.id} status={entry.status} note={entry.internalNote ?? ""} />
      <Details entry={entry} />
      {viewer.isAdmin ? <DeleteRegistration id={entry.id} name={entry.collectiveName} /> : null}
    </>
  );
}

function Details({ entry }: { entry: Registration }) {
  const costs = registrationCosts(entry);
  return (
    <>
      <Card title="Hauptansprechpartner/in">
        <Row label="Name">
          {entry.contactFirstName} {entry.contactLastName}
        </Row>
        <Row label="E-Mail">
          <Mail address={entry.contactEmail} />
        </Row>
        <Row label="Telefon">
          <Phone number={entry.contactPhone} />
        </Row>
      </Card>

      <Card title="Kollektiv">
        <Row label="Schreibweise">{entry.displayName}</Row>
        <Row label="Forderungen">{entry.demands}</Row>
        <Row label="Instagram">{entry.instagram}</Row>
        <Row label="TikTok">{entry.tiktok}</Row>
        <Row label="Dateien">
          <ExternalLink href={entry.filesLink} />
        </Row>
        <Row label="Schon dabei gewesen">{yesNo(entry.participatedBefore)}</Row>
        <Row label="Musik">{MUSIC_TYPE_LABELS[entry.musicType]}</Row>
        <Row label="Genres">{entry.genres.join(", ")}</Row>
        <Row label="Homebase">{HOME_BASE_LABELS[entry.homeBase]}</Row>
        <Row label="Leute pro Event">{EVENT_SIZE_LABELS[entry.eventSize]}</Row>
      </Card>

      <Card title="Wagen">
        <Row label="Fahrzeug">{VEHICLE_LABELS[entry.vehicle]}</Row>
        <Row label="TÜV über uns">{yesNo(entry.tuev)}</Row>
        <Row label="Awareness / Code of Conduct">{entry.awareness}</Row>
        <Row label="Soundkopplung">{yesNo(entry.soundCoupling)}</Row>
        <Row label="Atmosphäre">{entry.atmosphere}</Row>
        <Row label="Wunsch Reihenfolge">{entry.orderPreference}</Row>
        <Row label="Zusammenschluss mit">{entry.jointWith}</Row>
        <Row label="Dateien zum Wagen">
          <ExternalLink href={entry.vehicleFilesLink} />
        </Row>
      </Card>

      <Card title="Freiwillige Abschnittsleitung">
        {hasSectionLead(entry) || entry.sectionLeadPhone || entry.sectionLeadNote ? (
          <>
            <Row label="Name">
              {[entry.sectionLeadFirstName, entry.sectionLeadLastName].filter(Boolean).join(" ")}
            </Row>
            <Row label="E-Mail">
              <Mail address={entry.sectionLeadEmail} />
            </Row>
            <Row label="Telefon">
              <Phone number={entry.sectionLeadPhone} />
            </Row>
            <Row label="Anmerkung">{entry.sectionLeadNote}</Row>
          </>
        ) : (
          <Row label="Gemeldet">Nein</Row>
        )}
      </Card>

      <Card title="Wagenverantwortliche/r">
        <Row label="Name">
          {entry.vehicleLeadFirstName} {entry.vehicleLeadLastName}
        </Row>
        <Row label="E-Mail">
          <Mail address={entry.vehicleLeadEmail} />
        </Row>
        <Row label="Telefon">
          <Phone number={entry.vehicleLeadPhone} />
        </Row>
        <Row label="Westengröße">{entry.vehicleLeadSize}</Row>
      </Card>

      <Card title="T-Shirts und Kosten">
        {SHIRT_KINDS.map((kind) => (
          <Row key={kind} label={`T-Shirts ${SHIRT_KIND_LABELS[kind]}`}>
            {SHIRT_SIZES.map((size) => `${size}: ${entry.shirts[kind][size]}`).join(" · ")}
          </Row>
        ))}
        <Row label="Pfand">{formatEuro(DEPOSIT_EUR)}</Row>
        <Row label="TÜV">{formatEuro(costs.tuev)}</Row>
        <Row label="T-Shirts">{formatEuro(costs.shirtsStandard + costs.shirtsSoli)}</Row>
        <Row label="Summe">
          <strong>{formatEuro(costs.total)}</strong>
        </Row>
      </Card>
    </>
  );
}
