/**
 * Behind Coolify's proxy (Traefik), Next.js route handlers see the request as
 * `https://localhost:3000/...`. Auth.js builds the OAuth callback URL from it,
 * so Google would get a wrong redirect URI. This rebuilds the public URL from
 * `X-Forwarded-Host` (set by Traefik) or `Host`, so production and every PR
 * preview use their own address without `AUTH_URL`.
 *
 * Returns null when nothing usable is present; the caller keeps the request.
 */
export function publicRequestUrl(requestUrl: string, headers: Headers): string | null {
  const host = firstValue(headers.get("x-forwarded-host")) ?? firstValue(headers.get("host"));
  if (!host || !/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
    return null;
  }
  const proto = (firstValue(headers.get("x-forwarded-proto")) ?? new URL(requestUrl).protocol).replace(/:$/, "");
  if (proto !== "https" && proto !== "http") {
    return null;
  }
  const original = new URL(requestUrl);
  return new URL(`${original.pathname}${original.search}`, `${proto}://${host}`).toString();
}

function firstValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first ? first : null;
}
