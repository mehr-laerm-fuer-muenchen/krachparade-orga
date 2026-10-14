"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MAIN_NAV, isActivePath } from "@/lib/nav";

/** Navigation in the header, only on wide screens. */
export function MainNav({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        {MAIN_NAV.map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
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
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
