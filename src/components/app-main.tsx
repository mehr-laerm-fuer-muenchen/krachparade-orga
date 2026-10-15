import type { ReactNode } from "react";

/**
 * Content area of the signed-in pages, 1024 px wide. A page that marks itself
 * with `data-wide-page` (only the plan on the start page: room for the time
 * axis next to the detail panel) may grow to 1400 px on wide screens. Decided
 * by CSS from the server HTML, so the width never changes after loading.
 */
export function AppMain({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] desk:px-6 desk:pb-12 desk:has-data-wide-page:max-w-[1400px]">
      {children}
    </main>
  );
}
