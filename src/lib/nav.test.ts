import { describe, expect, it } from "vitest";
import { MAIN_NAV, TAB_NAV, isActivePath, isActiveTab } from "./nav";

describe("isActivePath", () => {
  it("marks the start page only on /", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/arbeitskreise", "/")).toBe(false);
  });

  it("marks a section on its own page and on sub pages", () => {
    expect(isActivePath("/protokolle", "/protokolle")).toBe(true);
    expect(isActivePath("/protokolle/2027-01-12", "/protokolle")).toBe(true);
    expect(isActivePath("/protokolle-alt", "/protokolle")).toBe(false);
  });
});

describe("isActiveTab", () => {
  const more = TAB_NAV.find((tab) => tab.label === "Mehr")!;

  it("marks Mehr on settings and on Kollektive", () => {
    expect(isActiveTab("/einstellungen", more)).toBe(true);
    expect(isActiveTab("/kollektive", more)).toBe(true);
    expect(isActiveTab("/kollektive/x", more)).toBe(true);
    expect(isActiveTab("/meine", more)).toBe(false);
  });

  it("marks Mehr and Einstellungen on the feedback pages", () => {
    const settings = MAIN_NAV.find((item) => item.label === "Einstellungen")!;
    expect(isActiveTab("/feedback", more)).toBe(true);
    expect(isActiveTab("/feedback/abc", more)).toBe(true);
    expect(isActiveTab("/feedback", settings)).toBe(true);
    expect(isActiveTab("/feedback/abc", settings)).toBe(true);
  });
});

describe("navigation", () => {
  it("has the six sections in the agreed order", () => {
    expect(MAIN_NAV.map((item) => item.href)).toEqual([
      "/",
      "/arbeitskreise",
      "/protokolle",
      "/meine",
      "/kollektive",
      "/einstellungen",
    ]);
  });

  it("has five tabs ending with Mehr", () => {
    expect(TAB_NAV.map((tab) => tab.label)).toEqual([
      "Plan",
      "AKs",
      "Protokolle",
      "Meine",
      "Mehr",
    ]);
  });
});
