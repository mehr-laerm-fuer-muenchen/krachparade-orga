import { permanentRedirect } from "next/navigation";

/** The former placeholder /referate lives on as /arbeitskreise (spec 005). */
export function GET() {
  permanentRedirect("/arbeitskreise");
}
