import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { devLoginEnvFromProcess, isDevLoginEnabled } from "@/lib/dev-login";

// "/anmeldung": public registration form of the collectives (spec 031).
const PUBLIC_PATHS = ["/login", "/api/auth", "/anmeldung"];

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

// Quick cookie check before every page (spec 002). Pages check the member
// against the database again (requireMember in src/auth.ts).
// The session is only read here: auth() without arguments sets no cookie.
// The auth((request) => …) wrapper would renew the session cookie on every
// response, so a prefetch still in flight during logout set it back.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Everything under /dev/** exists only locally and in Vercel previews
  // (see isDevLoginEnabled); in production it answers 404.
  if (isUnder(pathname, "/dev")) {
    return isDevLoginEnabled(devLoginEnvFromProcess())
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }

  if (PUBLIC_PATHS.some((base) => isUnder(pathname, base))) {
    return NextResponse.next();
  }

  const session = await auth();
  if (!session?.memberId) {
    return NextResponse.redirect(new URL("/login", request.nextUrl.origin));
  }
  return NextResponse.next();
}

export const config = {
  // Static files (Next.js assets, icons and images from public/) stay
  // reachable without a session. Only known file types, so a later route
  // like /export.csv is still protected.
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?|webmanifest)$).*)",
  ],
};
