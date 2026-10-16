"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MAIN_NAV, isActiveTab } from "@/lib/nav";

/**
 * Small numbers per nav target (href → node rendered on the server), e.g. the
 * overdue count at "/meine" (spec 009). Drawn next to the link, so the link's
 * name stays the same.
 */
export type NavBadges = Partial<Record<string, ReactNode>>;

/** Navigation in the header, only on wide screens. */
export function MainNav({ className = "", badges }: { className?: string; badges?: NavBadges }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        {MAIN_NAV.map((item) => {
          const active = isActiveTab(pathname, item);
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-1.5 rounded-md px-3 font-medium ${
                  active
                    ? "bg-white/12 text-header-text"
                    : "text-header-muted hover:bg-white/8 hover:text-header-text"
                }`}
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-sm border border-header-muted/50 px-1 text-[11px] leading-4 font-semibold text-header-muted">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
              {badges?.[item.href] ? <span className="absolute -top-1 -right-1">{badges[item.href]}</span> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
