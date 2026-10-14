import { cache } from "react";
import { requireMember } from "@/auth";

/**
 * `requireMember` from spec 002, once per request: the layout, the header
 * and pages share the same database check.
 */
export const getCurrentMember = cache(requireMember);
