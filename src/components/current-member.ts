import { connection } from "next/server";
import { cache } from "react";
import { requireMember } from "@/auth";

/**
 * `requireMember` from spec 002, once per request: the layout, the header
 * and pages share the same database check. `connection()` first, so the
 * session check (auth() issues a new token with random values) only runs at
 * request time, never while prerendering a prefetch.
 */
export const getCurrentMember = cache(async () => {
  await connection();
  return requireMember();
});
