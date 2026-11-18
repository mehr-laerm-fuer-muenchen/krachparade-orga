// Browser side of the light/dark choice (spec 034). Only call these in the
// browser (event handlers, effects, useSyncExternalStore).
import { DARK_QUERY, THEME_KEY, parseTheme, resolveTheme, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function readChoice(): Theme | null {
  try {
    return parseTheme(window.localStorage.getItem(THEME_KEY));
  } catch {
    return null;
  }
}

function deviceDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Sets data-theme on <html> from the stored choice and the device. */
export function applyTheme(): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(readChoice(), deviceDark()));
}

/** Stores the own choice (null = like the device) and applies it. */
export function setThemeChoice(choice: Theme | null): void {
  try {
    if (choice) window.localStorage.setItem(THEME_KEY, choice);
    else window.localStorage.removeItem(THEME_KEY);
  } catch {
    // Private mode: still switch for this page view.
  }
  applyTheme();
  for (const listener of listeners) listener();
}

/** Calls back on own changes, device changes and changes in other tabs. */
export function subscribeTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_KEY) onChange();
  };
  listeners.add(onChange);
  query.addEventListener("change", onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    query.removeEventListener("change", onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable snapshot for useSyncExternalStore: "<choice|device>:<light|dark>". */
export function themeSnapshot(): string {
  const choice = readChoice();
  return `${choice ?? "device"}:${resolveTheme(choice, deviceDark())}`;
}
