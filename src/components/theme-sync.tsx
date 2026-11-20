"use client";

import { useLayoutEffect } from "react";
import { applyTheme, subscribeTheme } from "./theme-store";

/**
 * Keeps data-theme on <html> right after the inline script (spec 034): follows
 * the device live when there is no own choice, picks up changes from other
 * tabs, and re-applies after React's dev remount clears the attribute.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme();
    return subscribeTheme(applyTheme);
  }, []);
  return null;
}
