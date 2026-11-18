"use client";

import { useSyncExternalStore } from "react";
import { setThemeChoice, subscribeTheme, themeSnapshot } from "@/components/theme-store";

/**
 * "Dunkles Design" switch with sun and moon (spec 034). The state is only read
 * in the browser; the server renders a neutral, disabled switch.
 */
export function ThemeSwitch() {
  const snapshot = useSyncExternalStore(subscribeTheme, themeSnapshot, () => null);
  const known = snapshot !== null;
  const followsDevice = snapshot?.startsWith("device:") ?? false;
  const dark = snapshot?.endsWith(":dark") ?? false;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span id="dunkles-design" className="font-medium">
          Dunkles Design
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-labelledby="dunkles-design"
          disabled={!known}
          onClick={() => setThemeChoice(dark ? "light" : "dark")}
          className="group flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-60"
        >
          <span
            aria-hidden
            className="relative flex h-8 w-16 items-center justify-between rounded-full border border-line-strong bg-surface-2 px-2 text-muted group-aria-checked:border-primary"
          >
            <SunIcon className="size-4" />
            <MoonIcon className="size-4" />
            <span className="absolute top-[3px] left-[3px] flex size-6 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm transition-transform duration-150 ease-out group-aria-checked:translate-x-8 motion-reduce:transition-none">
              {dark ? <MoonIcon className="size-3.5" /> : <SunIcon className="size-3.5" />}
            </span>
          </span>
        </button>
      </div>
      <div className="min-h-11 text-sm text-muted">
        {!known ? null : followsDevice ? (
          <p className="flex min-h-11 items-center">Folgt dem Gerät</p>
        ) : (
          <button
            type="button"
            onClick={() => setThemeChoice(null)}
            className="min-h-11 text-sm font-medium text-primary underline underline-offset-4"
          >
            Wie das Gerät
          </button>
        )}
      </div>
    </div>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
