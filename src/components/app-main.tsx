"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Content area of the signed-in pages. Only the plan on the start page may
 * grow to 1400 px on wide screens (room for the time axis next to the detail
 * panel); every other page keeps its width.
 */
export function AppMain({ children }: { children: ReactNode }) {
  const wide = usePathname() === "/";
  return (
    <main
      className={`mx-auto w-full flex-1 px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] desk:px-6 desk:pb-12 ${
        wide ? "max-w-5xl desk:max-w-[1400px]" : "max-w-5xl"
      }`}
    >
      {children}
    </main>
  );
}
