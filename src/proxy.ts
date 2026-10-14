import { NextResponse } from "next/server";
import { devLoginEnvFromProcess, isDevLoginEnabled } from "@/lib/dev-login";

// Everything under /dev/** exists only locally and in Vercel previews
// (see isDevLoginEnabled); in production it answers 404.
export function proxy() {
  return isDevLoginEnabled(devLoginEnvFromProcess())
    ? NextResponse.next()
    : new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/dev", "/dev/:path*"],
};
