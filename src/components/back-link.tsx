import Link from "next/link";

/** Link back to the parent page, above the page title. */
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="-mb-2 flex min-h-11 w-fit items-center gap-1 font-medium text-primary underline underline-offset-4"
    >
      <span aria-hidden>‹</span>
      {children}
    </Link>
  );
}
