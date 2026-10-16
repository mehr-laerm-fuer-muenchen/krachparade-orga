import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { FeedbackKindPill, FeedbackStatusPill } from "@/components/feedback-pills";
import { PageTitle } from "@/components/placeholder";
import { listFeedback } from "@/db/feedback";
import { formatGermanDateTime } from "@/lib/date-time";

export const metadata: Metadata = {
  title: "Feedback – Krachparade Orga",
};

export default function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/einstellungen">Einstellungen</BackLink>
      <PageTitle>Feedback</PageTitle>
      <Suspense fallback={<p className="text-muted">Lade Feedback …</p>}>
        <FeedbackList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** All reports, newest first; "Offen" (Neu + In Arbeit) by default (spec 014). */
async function FeedbackList({ searchParams }: Pick<PageProps<"/feedback">, "searchParams">) {
  const { filter } = await searchParams;
  const all = filter === "alle";
  const entries = await listFeedback(all ? "all" : "open");

  return (
    <>
      <nav aria-label="Filter" className="flex w-fit rounded-md border border-line-strong p-0.5">
        {(["offen", "alle"] as const).map((value) => {
          const current = (value === "alle") === all;
          return (
            <Link
              key={value}
              href={value === "alle" ? "/feedback?filter=alle" : "/feedback"}
              replace
              scroll={false}
              aria-current={current ? "page" : undefined}
              className={`flex min-h-11 items-center rounded px-4 font-medium ${
                current ? "bg-primary text-on-primary" : "text-text hover:bg-surface-2"
              }`}
            >
              {value === "offen" ? "Offen" : "Alle"}
            </Link>
          );
        })}
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">
          {all ? "Noch keine Meldungen." : "Keine offenen Meldungen."}
        </p>
      ) : (
        <ul
          aria-label={all ? "Alle Meldungen" : "Offene Meldungen"}
          className="flex flex-col rounded-md border border-line bg-surface"
        >
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-line last:border-b-0">
              <Link
                href={`/feedback/${entry.id}`}
                className="flex min-h-11 flex-col gap-1.5 px-4 py-3 hover:bg-surface-2"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <FeedbackKindPill kind={entry.kind} />
                  <FeedbackStatusPill status={entry.status} />
                  <span className="text-sm text-muted">
                    {formatGermanDateTime(entry.createdAt)} · von {entry.createdByName}
                  </span>
                </span>
                <span className="line-clamp-2 break-words">
                  {entry.message}
                  {entry.context ? <span className="text-muted"> · {entry.context}</span> : null}
                </span>
                {entry.reply ? <span className="text-sm font-medium text-primary">Antwort vorhanden</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
