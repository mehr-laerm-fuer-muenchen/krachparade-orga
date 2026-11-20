import { auth } from "@/auth";
import { listRegistrations } from "@/db/collectives";
import { getCurrentEdition } from "@/db/editions";
import { findMemberById } from "@/db/members";
import { registrationsCsv } from "@/lib/collectives/csv";
import { todayInBerlin } from "@/lib/dday";

/**
 * CSV of all registrations of the current edition (spec 031). Signed-in,
 * active members only; the proxy checks the cookie, this checks the member.
 */
export async function GET() {
  const session = await auth();
  const member = session?.memberId ? await findMemberById(session.memberId) : undefined;
  if (!member?.active) {
    return new Response("Kein Zugriff.", { status: 401 });
  }
  const edition = await getCurrentEdition();
  if (!edition) {
    return new Response("Es gibt keine aktuelle Ausgabe.", { status: 404 });
  }
  const csv = registrationsCsv(await listRegistrations(edition.id));
  const filename = `kollektive-kp27-${todayInBerlin(new Date())}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
