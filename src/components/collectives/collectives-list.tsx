"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GENRES,
  HOME_BASE_LABELS,
  REGISTRATION_STATUSES,
  REGISTRATION_STATUS_LABELS,
  VEHICLES,
  VEHICLE_SHORT_LABELS,
  type HomeBase,
  type RegistrationStatus,
  type Vehicle,
} from "@/lib/collectives/options";
import { RegistrationStatusPill } from "./status-pill";

/** Only what the list shows; no contact details reach the browser here. */
export type CollectiveListEntry = {
  id: string;
  collectiveName: string;
  status: RegistrationStatus;
  vehicle: Vehicle;
  tuev: boolean | null;
  soundCoupling: boolean;
  homeBase: HomeBase;
  genres: string[];
  /** "18.11.2026" */
  createdLabel: string;
};

type YesNoFilter = "" | "yes" | "no";

const SELECT =
  "min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base desk:w-auto";

function yesNo(value: boolean | null): string {
  if (value === null) return "–";
  return value ? "Ja" : "Nein";
}

function matchesYesNo(filter: YesNoFilter, value: boolean | null): boolean {
  if (filter === "") return true;
  return filter === "yes" ? value === true : value !== true;
}

/** Search and filters on /kollektive (spec 031), all in the browser. */
export function CollectivesList({ entries }: { entries: CollectiveListEntry[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<RegistrationStatus | "">("");
  const [vehicle, setVehicle] = useState<Vehicle | "">("");
  const [tuev, setTuev] = useState<YesNoFilter>("");
  const [sound, setSound] = useState<YesNoFilter>("");
  const [genre, setGenre] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter(
      (entry) =>
        (needle === "" || entry.collectiveName.toLowerCase().includes(needle)) &&
        (status === "" || entry.status === status) &&
        (vehicle === "" || entry.vehicle === vehicle) &&
        matchesYesNo(tuev, entry.tuev) &&
        matchesYesNo(sound, entry.soundCoupling) &&
        (genre === "" || entry.genres.includes(genre))
    );
  }, [entries, query, status, vehicle, tuev, sound, genre]);

  const filtered = query !== "" || status !== "" || vehicle !== "" || tuev !== "" || sound !== "" || genre !== "";

  return (
    <section aria-labelledby="anmeldungen" className="flex flex-col gap-3">
      <h2 id="anmeldungen" className="text-lg font-semibold">
        Anmeldungen
      </h2>
      <div className="flex flex-col gap-2 desk:flex-row desk:flex-wrap desk:items-end">
        <label className="flex flex-col gap-1 desk:min-w-64">
          <span className="text-sm text-muted">Suche nach Name</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 desk:flex desk:flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as RegistrationStatus | "")} className={SELECT}>
              <option value="">Alle</option>
              {REGISTRATION_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {REGISTRATION_STATUS_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Fahrzeug</span>
            <select value={vehicle} onChange={(event) => setVehicle(event.target.value as Vehicle | "")} className={SELECT}>
              <option value="">Alle</option>
              {VEHICLES.map((value) => (
                <option key={value} value={value}>
                  {VEHICLE_SHORT_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">TÜV</span>
            <select value={tuev} onChange={(event) => setTuev(event.target.value as YesNoFilter)} className={SELECT}>
              <option value="">Alle</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">Soundkopplung</span>
            <select value={sound} onChange={(event) => setSound(event.target.value as YesNoFilter)} className={SELECT}>
              <option value="">Alle</option>
              <option value="yes">Ja</option>
              <option value="no">Nein</option>
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1">
            <span className="text-sm text-muted">Genre</span>
            <select value={genre} onChange={(event) => setGenre(event.target.value)} className={SELECT}>
              <option value="">Alle</option>
              {GENRES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {filtered ? `${visible.length} von ${entries.length} Anmeldungen` : `${entries.length} Anmeldungen`}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          {entries.length === 0 ? "Noch keine Anmeldungen." : "Keine Anmeldung passt zu den Filtern."}
        </p>
      ) : (
        <>
          {/* Phones: cards. */}
          <ul aria-label="Anmeldungen" className="flex flex-col rounded-md border border-line bg-surface desk:hidden">
            {visible.map((entry) => (
              <li key={entry.id} className="border-b border-line last:border-b-0">
                <Link href={`/kollektive/${entry.id}`} className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-surface-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold break-words">{entry.collectiveName}</span>
                    <RegistrationStatusPill status={entry.status} />
                  </span>
                  <span className="text-sm text-muted">
                    {VEHICLE_SHORT_LABELS[entry.vehicle]} · TÜV {yesNo(entry.tuev)} · Soundkopplung{" "}
                    {yesNo(entry.soundCoupling)} · {entry.createdLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Wide screens: table. */}
          <div className="hidden overflow-x-auto rounded-md border border-line bg-surface desk:block">
            <table className="w-full text-left">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Kollektiv</th>
                  <th scope="col" className="px-4 py-2 font-medium">Fahrzeug</th>
                  <th scope="col" className="px-4 py-2 font-medium">TÜV</th>
                  <th scope="col" className="px-4 py-2 font-medium">Soundkopplung</th>
                  <th scope="col" className="px-4 py-2 font-medium">Homebase</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Eingegangen</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((entry) => (
                  <tr key={entry.id} className="border-b border-line last:border-b-0 hover:bg-surface-2">
                    <td className="px-4 py-2">
                      <Link href={`/kollektive/${entry.id}`} className="flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline">
                        {entry.collectiveName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{VEHICLE_SHORT_LABELS[entry.vehicle]}</td>
                    <td className="px-4 py-2">{yesNo(entry.tuev)}</td>
                    <td className="px-4 py-2">{yesNo(entry.soundCoupling)}</td>
                    <td className="px-4 py-2">{HOME_BASE_LABELS[entry.homeBase]}</td>
                    <td className="px-4 py-2">
                      <RegistrationStatusPill status={entry.status} />
                    </td>
                    <td className="px-4 py-2 tabular-nums">{entry.createdLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
