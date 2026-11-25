import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { publicRequestUrl } from "@/lib/forwarded-url";

// Hand Auth.js the public address instead of the internal localhost one, so
// the OAuth callback URL is right in production and every preview without
// AUTH_URL (see src/lib/forwarded-url.ts).
function withPublicUrl(request: NextRequest): NextRequest {
  const url = publicRequestUrl(request.url, request.headers);
  return url && url !== request.url ? new NextRequest(url, request) : request;
}

export function GET(request: NextRequest) {
  return handlers.GET(withPublicUrl(request));
}

export function POST(request: NextRequest) {
  return handlers.POST(withPublicUrl(request));
}
