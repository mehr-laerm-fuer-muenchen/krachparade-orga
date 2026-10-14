import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/actions/auth";
import { getCurrentMember } from "@/components/current-member";
import { PageTitle } from "@/components/placeholder";
import {
  CreateDepartmentForm,
  DDayForm,
  DepartmentRow,
  InviteForm,
  MemberActionButton,
} from "@/components/settings/forms";
import { listDepartments } from "@/db/departments";
import { getCurrentEdition } from "@/db/editions";
import { listMembers } from "@/db/members";
import type { Department, Edition, Member } from "@/db/schema";
import { isAdminEmail, parseAdminEmails } from "@/lib/access";

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
      <Suspense fallback={<p className="text-muted">Lade Einstellungen …</p>}>
        <SettingsSections />
      </Suspense>
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

const SECTION = "flex flex-col gap-4 rounded-md border border-line bg-surface p-4";

/**
 * Edition, people and departments (spec 003). Admin controls are only shown
 * to admins; the server actions check the rights again on every call.
 */
async function SettingsSections() {
  const viewer = await getCurrentMember();
  const [edition, people] = await Promise.all([getCurrentEdition(), listMembers()]);
  const departments = edition ? await listDepartments(edition.id) : [];
  return (
    <>
      <EditionSection edition={edition} canEdit={viewer.isAdmin} />
      <PeopleSection people={people} viewerId={viewer.id} isAdmin={viewer.isAdmin} />
      <DepartmentsSection departments={departments} people={people} isAdmin={viewer.isAdmin} />
    </>
  );
}

function EditionSection({ edition, canEdit }: { edition: Edition | undefined; canEdit: boolean }) {
  return (
    <section aria-labelledby="ausgabe" className={SECTION}>
      <h2 id="ausgabe" className="text-lg font-semibold">
        Ausgabe
      </h2>
      {edition ? (
        <>
          <p>
            <span className="text-muted">Name: </span>
            <span className="font-medium">{edition.name}</span>
          </p>
          <DDayForm dDay={edition.dDay} canEdit={canEdit} />
          <p className="text-muted">Ab R1 rechnen sich alle Meilensteine rückwärts vom D-Day neu.</p>
        </>
      ) : (
        <p className="text-muted">Noch keine aktuelle Ausgabe angelegt.</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          disabled
          className="min-h-11 rounded-md border border-line-strong px-4 font-medium text-muted opacity-60"
        >
          Vorlage für KP28 erzeugen
        </button>
        <span className="text-xs text-muted">ab R4</span>
      </div>
    </section>
  );
}

function PeopleSection({
  people,
  viewerId,
  isAdmin,
}: {
  people: readonly Member[];
  viewerId: string;
  isAdmin: boolean;
}) {
  // Only the result per person leaves the server, never the list itself.
  const adminEmails = isAdmin ? parseAdminEmails(process.env.ADMIN_EMAILS) : [];
  return (
    <section aria-labelledby="personen" className={SECTION}>
      <h2 id="personen" className="text-lg font-semibold">
        Personen
      </h2>
      <p className="text-muted">Login mit Google-Konto. Nur eingeladene Adressen kommen rein.</p>
      <ul aria-label="Personen" className="flex flex-col rounded-md border border-line">
        {people.map((person) => {
          const self = person.id === viewerId;
          const lockedByServer = isAdmin && isAdminEmail(person.email, adminEmails);
          return (
            <li
              key={person.id}
              aria-label={person.name}
              className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 desk:flex-row desk:items-start desk:justify-between"
            >
              <div className={`flex min-w-0 flex-col ${person.active ? "" : "text-muted opacity-70"}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{person.name}</span>
                  <span className="rounded-sm border border-line-strong px-1.5 text-xs font-semibold text-muted">
                    {person.isAdmin ? "Admin" : "Kern-Orga"}
                  </span>
                  {person.active ? null : <span className="text-xs">deaktiviert</span>}
                </span>
                {isAdmin ? <span className="truncate text-xs text-muted">{person.email}</span> : null}
              </div>
              {isAdmin ? (
                <div className="flex flex-wrap gap-2">
                  <MemberActionButton
                    kind="active"
                    memberId={person.id}
                    value={!person.active}
                    label={person.active ? "Deaktivieren" : "Wieder aktivieren"}
                    lockedReason={
                      !person.active
                        ? undefined
                        : lockedByServer
                          ? "Admin über Server-Einstellung festgelegt"
                          : self
                            ? "Das bist du."
                            : undefined
                    }
                  />
                  <MemberActionButton
                    kind="admin"
                    memberId={person.id}
                    value={!person.isAdmin}
                    label={person.isAdmin ? "Admin nehmen" : "Admin geben"}
                    lockedReason={
                      !person.isAdmin
                        ? undefined
                        : lockedByServer
                          ? "Admin über Server-Einstellung festgelegt"
                          : self
                            ? "Das bist du."
                            : undefined
                    }
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {isAdmin ? <InviteForm /> : null}
    </section>
  );
}

function DepartmentsSection({
  departments,
  people,
  isAdmin,
}: {
  departments: readonly Department[];
  people: readonly Member[];
  isAdmin: boolean;
}) {
  const names = new Map(people.map((person) => [person.id, person.name]));
  // Active people can be chosen; a deactivated current lead stays visible.
  const leads = people
    .filter((person) => person.active || departments.some((d) => d.leadId === person.id))
    .map((person) => ({ id: person.id, name: person.name, active: person.active }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  return (
    <section aria-labelledby="referate" className={SECTION}>
      <h2 id="referate" className="text-lg font-semibold">
        Referate
      </h2>
      {departments.length === 0 ? <p className="text-muted">Noch keine Referate angelegt.</p> : null}
      {isAdmin ? (
        <ul aria-label="Referate" className="flex flex-col rounded-md border border-line">
          {departments.map((department, index) => (
            <DepartmentRow
              key={department.id}
              id={department.id}
              name={department.name}
              leadId={department.leadId}
              leads={leads}
              isFirst={index === 0}
              isLast={index === departments.length - 1}
            />
          ))}
        </ul>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                Referat
              </th>
              <th scope="col" className="py-2 font-medium">
                Leitung
              </th>
            </tr>
          </thead>
          <tbody>
            {departments.map((department) => (
              <tr key={department.id} className="border-b border-line last:border-b-0">
                <td className="py-2 pr-3">{department.name}</td>
                <td className="py-2">
                  {department.leadId ? (names.get(department.leadId) ?? "–") : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isAdmin ? <CreateDepartmentForm /> : null}
    </section>
  );
}
