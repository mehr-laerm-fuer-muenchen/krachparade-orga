import Link from "next/link";
import { SHIRT_PRICE_EUR, formatEuro } from "@/lib/collectives/costs";
import { SHIRT_KINDS, SHIRT_KIND_LABELS, SHIRT_SIZES } from "@/lib/collectives/options";
import { shirtSizesLabel, type ShirtOverview as Overview } from "@/lib/collectives/shirts";
import { RegistrationStatusPill } from "./status-pill";

// Spec 033: all T-shirt orders on /kollektive – totals, money, per collective.

const CELL = "px-2 py-2 text-right tabular-nums desk:px-4";
const HEAD = "px-2 py-2 font-medium desk:px-4";

function MoneyTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-line bg-surface px-4 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function ShirtOverview({ overview }: { overview: Overview }) {
  const { expected, confirmed, byCollective } = overview;

  return (
    <section aria-labelledby="tshirts" className="flex flex-col gap-3">
      <h2 id="tshirts" className="text-lg font-semibold">
        T-Shirts
      </h2>

      {/* Part 1: totals by kind and size (without rejected registrations). */}
      <div className="flex flex-col gap-1">
        <div className="rounded-md border border-line bg-surface">
          <table className="w-full text-left text-sm desk:text-base" aria-label="T-Shirts gesamt (erwartet)">
            <thead className="border-b border-line text-muted">
              <tr>
                <th scope="col" className={HEAD}>
                  Art
                </th>
                {SHIRT_SIZES.map((size) => (
                  <th key={size} scope="col" className={`${HEAD} text-right`}>
                    {size}
                  </th>
                ))}
                <th scope="col" className={`${HEAD} text-right`}>
                  Summe
                </th>
              </tr>
            </thead>
            <tbody>
              {SHIRT_KINDS.map((kind) => (
                <tr key={kind} className="border-b border-line">
                  <th scope="row" className={`${HEAD} text-left`}>
                    {SHIRT_KIND_LABELS[kind]}
                  </th>
                  {SHIRT_SIZES.map((size) => (
                    <td key={size} className={CELL}>
                      {expected.pieces[kind][size]}
                    </td>
                  ))}
                  <td className={`${CELL} font-semibold`}>{expected.count[kind]}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className={`${HEAD} text-left font-semibold`}>
                  Gesamt
                </th>
                {SHIRT_SIZES.map((size) => (
                  <td key={size} className={CELL}>
                    {SHIRT_KINDS.reduce((sum, kind) => sum + expected.pieces[kind][size], 0)}
                  </td>
                ))}
                <td className={CELL} data-testid="shirts-gesamt">
                  {expected.total}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-muted">
          Erwartet, ohne Absagen · davon zugesagt: {confirmed.total} Shirts
        </p>
      </div>

      {/* Part 2: money. */}
      <div className="flex flex-col gap-1">
        <div className="grid gap-3 desk:grid-cols-3">
          <MoneyTile label="Umsatz Shirts (erwartet)" value={formatEuro(expected.revenueTotal)} />
          <MoneyTile label="Umsatz Shirts (zugesagt)" value={formatEuro(confirmed.revenueTotal)} />
          <MoneyTile label="davon Soli-Anteil (erwartet)" value={formatEuro(expected.soliShare)} />
        </div>
        <p className="text-sm text-muted">
          {SHIRT_KIND_LABELS.standard} {formatEuro(SHIRT_PRICE_EUR.standard)}, {SHIRT_KIND_LABELS.soli}{" "}
          {formatEuro(SHIRT_PRICE_EUR.soli)} pro Shirt
        </p>
      </div>

      {/* Part 3: who ordered what. */}
      <h3 className="font-semibold">Wer hat was bestellt</h3>
      {byCollective.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">Noch keine T-Shirts bestellt.</p>
      ) : (
        <>
          {/* Phones: cards. */}
          <ul aria-label="T-Shirts je Kollektiv" className="flex flex-col rounded-md border border-line bg-surface desk:hidden">
            {byCollective.map((entry) => (
              <li key={entry.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/kollektive/${entry.id}`}
                  className="flex min-h-11 flex-col gap-1 px-4 py-3 hover:bg-surface-2"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold break-words">{entry.collectiveName}</span>
                    <RegistrationStatusPill status={entry.status} />
                  </span>
                  {SHIRT_KINDS.map((kind) => (
                    <span key={kind} className="text-sm">
                      <span className="text-muted">{SHIRT_KIND_LABELS[kind]}: </span>
                      {shirtSizesLabel(entry.pieces, kind)}
                    </span>
                  ))}
                  <span className="text-sm font-semibold tabular-nums">
                    {entry.total} Shirts · {formatEuro(entry.amount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {/* Wide screens: table. */}
          <div className="hidden overflow-x-auto rounded-md border border-line bg-surface desk:block">
            <table className="w-full text-left" aria-label="T-Shirts je Kollektiv">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Kollektiv</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">{SHIRT_KIND_LABELS.standard}</th>
                  <th scope="col" className="px-4 py-2 font-medium">{SHIRT_KIND_LABELS.soli}</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Summe</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {byCollective.map((entry) => (
                  <tr key={entry.id} className="border-b border-line hover:bg-surface-2">
                    <td className="px-4 py-2">
                      <Link
                        href={`/kollektive/${entry.id}`}
                        className="flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
                      >
                        {entry.collectiveName}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <RegistrationStatusPill status={entry.status} />
                    </td>
                    {SHIRT_KINDS.map((kind) => (
                      <td key={kind} className="px-4 py-2">
                        {shirtSizesLabel(entry.pieces, kind)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right tabular-nums">{entry.total}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatEuro(entry.amount)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <th scope="row" colSpan={4} className="px-4 py-2 text-left">
                    Gesamt
                  </th>
                  <td className="px-4 py-2 text-right tabular-nums">{expected.total}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEuro(expected.revenueTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
