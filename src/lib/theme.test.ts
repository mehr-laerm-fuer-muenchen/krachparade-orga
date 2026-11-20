import { describe, expect, it } from "vitest";
import { DARK_QUERY, THEME_INIT_SCRIPT, THEME_KEY, parseTheme, resolveTheme } from "./theme";

describe("parseTheme", () => {
  it("accepts light and dark", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("treats everything else as no choice", () => {
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme("")).toBeNull();
    expect(parseTheme("Dark")).toBeNull();
    expect(parseTheme("system")).toBeNull();
    expect(parseTheme(1)).toBeNull();
  });
});

describe("resolveTheme", () => {
  it("follows the device without a choice", () => {
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
  });

  it("lets the own choice win", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

/** Runs the inline script against a fake browser and returns data-theme. */
function runInitScript(stored: string | null | Error, deviceDark: boolean): string | undefined {
  const attrs: Record<string, string> = {};
  const localStorage = {
    getItem(key: string) {
      expect(key).toBe(THEME_KEY);
      if (stored instanceof Error) throw stored;
      return stored;
    },
  };
  const window = {
    matchMedia(query: string) {
      expect(query).toBe(DARK_QUERY);
      return { matches: deviceDark };
    },
  };
  const document = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
      },
    },
  };
  new Function("localStorage", "window", "document", THEME_INIT_SCRIPT)(localStorage, window, document);
  return attrs["data-theme"];
}

describe("THEME_INIT_SCRIPT", () => {
  it("matches resolveTheme for every stored value and device setting", () => {
    for (const stored of ["light", "dark", null, "nonsense"]) {
      for (const deviceDark of [false, true]) {
        expect(runInitScript(stored, deviceDark)).toBe(resolveTheme(parseTheme(stored), deviceDark));
      }
    }
  });

  it("follows the device when localStorage is blocked", () => {
    expect(runInitScript(new Error("blocked"), true)).toBe("dark");
    expect(runInitScript(new Error("blocked"), false)).toBe("light");
  });
});
