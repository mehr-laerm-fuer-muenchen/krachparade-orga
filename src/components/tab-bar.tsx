"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { TAB_NAV, isActiveTab } from "@/lib/nav";

// Simple line icons (24 × 24), drawn in the current text colour.
const ICONS: Record<string, ReactNode> = {
  "/": <path d="M4 18h16M6 18V9m6 9V5m6 13v-6" />,
  "/referate": (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6M15 14.5c.6-.3 1.3-.5 2-.5 2.2 0 4 1.8 4 4" />
    </>
  ),
  "/protokolle": (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M10 11h5M10 15h5" />
    </>
  ),
  "/meine": (
    <>
      <path d="M4 6h3M4 12h3M4 18h3" />
      <path d="M10 6h10M10 12h10M10 18h10" />
    </>
  ),
  "/einstellungen": (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
};

/** Bottom tab bar, only on narrow screens (up to 900 px). */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] desk:hidden"
    >
      <ul className="mx-auto flex max-w-xl">
        {TAB_NAV.map((tab) => {
          const active = isActiveTab(pathname, tab);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs ${
                  active ? "font-semibold text-primary" : "text-muted hover:text-text"
                }`}
              >
                {active ? (
                  <span aria-hidden className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" />
                ) : null}
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {ICONS[tab.href]}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
