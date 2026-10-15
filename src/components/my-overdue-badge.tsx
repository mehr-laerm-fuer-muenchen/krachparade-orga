import { getCurrentMember } from "@/components/current-member";
import { countMyOverdue } from "@/db/my-tasks";
import { todayInBerlin } from "@/lib/dday";

/**
 * Pink number at "Meine" (spec 009): entries under "Überfällig & Verzug" of
 * the signed-in member, only if > 0. If loading fails (e.g. a cycle in the
 * plan) the number is simply missing and the page loads anyway.
 */
export async function MyOverdueBadge({ className = "" }: { className?: string }) {
  const member = await getCurrentMember();
  let count: number;
  try {
    count = await countMyOverdue(member.id, todayInBerlin(new Date()));
  } catch {
    return null;
  }
  if (count === 0) return null;
  return (
    <span
      aria-label={`${count} überfällig`}
      className={`pointer-events-none flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-header-bg tabular-nums ${className}`}
    >
      {count}
    </span>
  );
}
