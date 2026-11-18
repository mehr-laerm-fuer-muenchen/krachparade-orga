"use client";

/**
 * A script that runs while the server HTML is parsed (spec 034). On the client
 * it is rendered as text/plain, so React does not warn about rendering a
 * <script>; suppressHydrationWarning covers the type mismatch. Pattern from
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
