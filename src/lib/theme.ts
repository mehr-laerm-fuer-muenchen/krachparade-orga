// Light or dark design (spec 034). Pure functions plus the inline script that
// sets the design before the first paint. The own choice is stored per device
// in localStorage; without one the app follows the device.

export type Theme = "light" | "dark";

/** localStorage key of the own choice. */
export const THEME_KEY = "kp-theme";

/** Media query of the device setting. */
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The stored value as a choice, or null for "like the device". */
export function parseTheme(value: unknown): Theme | null {
  return value === "light" || value === "dark" ? value : null;
}

/** The design in effect: the own choice wins, otherwise the device. */
export function resolveTheme(choice: Theme | null, deviceDark: boolean): Theme {
  return choice ?? (deviceDark ? "dark" : "light");
}

/**
 * Runs in <head> while the HTML is parsed, before anything is painted. Must
 * stay in sync with parseTheme/resolveTheme (covered by the tests).
 */
export const THEME_INIT_SCRIPT =
  "(function(){var t=null;try{t=localStorage.getItem(" +
  JSON.stringify(THEME_KEY) +
  ")}catch(e){}" +
  'if(t!=="light"&&t!=="dark"){t="light";try{if(window.matchMedia(' +
  JSON.stringify(DARK_QUERY) +
  ').matches)t="dark"}catch(e){}}' +
  'document.documentElement.setAttribute("data-theme",t)})()';
