import type { ReactNode } from "react";

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>;
}

/** Note for sections that come with a later spec or release. */
export function ComingSoon({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-line bg-surface px-4 py-3 text-muted">{children}</p>
  );
}
