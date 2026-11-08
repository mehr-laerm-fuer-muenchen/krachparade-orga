"use client";

import { useEffect } from "react";

/**
 * While `active`, the page behind a sheet or panel does not scroll (spec 021,
 * shared since spec 030). iOS Safari ignores overflow: hidden for touch
 * scrolling, so the body is pinned at the current position and the page jumps
 * back there when the lock ends.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      overflow: root.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
    };
    root.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    return () => {
      root.style.overflow = previous.overflow;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      window.scrollTo(0, scrollY);
    };
  }, [active]);
}
