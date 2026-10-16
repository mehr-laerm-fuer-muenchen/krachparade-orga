import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { BackLink } from "@/components/back-link";
import { getCurrentMember } from "@/components/current-member";
import { FeedbackStatusPill } from "@/components/feedback-pills";
import { FeedbackReplyForm } from "@/components/feedback-reply-form";
import { PageTitle } from "@/components/placeholder";
import { getFeedback, type FeedbackDetail } from "@/db/feedback";
import { formatGermanDateTime } from "@/lib/date-time";
import { kindLabel } from "@/lib/feedback/kinds";

export const metadata: Metadata = {
  title: "Meldung – Krachparade Orga",
};

// The report id is only known at request time, so the header and tab bar
// (usePathname in the layout) cannot be prerendered for this route: it may
// block until the server has rendered it.
export const instant = false;

export default function FeedbackDetailPage({ params }: PageProps<"/feedback/[id]">) {
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/feedback">Feedback</BackLink>
      <Suspense fallback={<p className="text-muted">Lade Meldung …</p>}>
        <Report params={params} />
      </Suspense>
    </div>
  );
}

async function Report({ params }: Pick<PageProps<"/feedback/[id]">, "params">) {
  const { id } = await params;
  const feedbackId = z.uuid().safeParse(id);
  if (!feedbackId.success) notFound();

  const [viewer, entry] = await Promise.all([getCurrentMember(), getFeedback(feedbackId.data)]);
  if (!entry) notFound();

  return (
    <>
      <div className="flex flex-col gap-2">
        <PageTitle>{kindLabel(entry.kind)}</PageTitle>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
          <FeedbackStatusPill status={entry.status} />
          <span>
            {formatGermanDateTime(entry.createdAt)} · von {entry.createdByName}
          </span>
        </p>
      </div>

      <p className="rounded-md border border-line bg-surface px-4 py-3 break-words whitespace-pre-wrap">
        {entry.message}
      </p>

      <TechnicalDetails entry={entry} />

      {viewer.isAdmin ? (
        <FeedbackReplyForm id={entry.id} status={entry.status} reply={entry.reply ?? ""} />
      ) : (
        <Reply entry={entry} />
      )}
    </>
  );
}

const SECTION = "flex flex-col gap-2 rounded-md border border-line bg-surface p-4";

function TechnicalDetails({ entry }: { entry: FeedbackDetail }) {
  // Only paths inside the app become links ("//…" would leave it).
  const internal = entry.pagePath.startsWith("/") && !entry.pagePath.startsWith("//");
  const device = [entry.device, entry.viewport].filter(Boolean).join(" · ");
  return (
    <section aria-labelledby="technisch" className={SECTION}>
      <h2 id="technisch" className="text-lg font-semibold">
        Technische Angaben
      </h2>
      <p className="break-words">
        Seite: {entry.pageTitle ? `${entry.pageTitle} ` : null}(
        {internal ? (
          <Link href={entry.pagePath} prefetch={false} className="text-primary underline underline-offset-4">
            {entry.pagePath}
          </Link>
        ) : (
          entry.pagePath
        )}
        )
      </p>
      {entry.context ? <p className="break-words">Element: {entry.context}</p> : null}
      <p className="break-words">Gerät: {device || "unbekannt"}</p>
    </section>
  );
}

/** Read-only status and reply for everyone who is not an admin. */
function Reply({ entry }: { entry: FeedbackDetail }) {
  return (
    <section aria-labelledby="antwort" className={SECTION}>
      <h2 id="antwort" className="text-lg font-semibold">
        Status und Antwort
      </h2>
      <p className="flex items-center gap-2">
        Status: <FeedbackStatusPill status={entry.status} />
      </p>
      {entry.reply ? (
        <>
          <p className="text-sm text-muted">
            Antwort von {entry.updatedByName ?? "Unbekannt"} · {formatGermanDateTime(entry.updatedAt)}
          </p>
          <p className="break-words whitespace-pre-wrap">{entry.reply}</p>
        </>
      ) : (
        <p className="text-muted">Noch keine Antwort.</p>
      )}
    </section>
  );
}
