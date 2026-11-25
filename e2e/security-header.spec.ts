import { expect, test } from "@playwright/test";

// Security headers from next.config.ts, on a public and on a protected path.

for (const path of ["/login", "/"]) {
  test(`Security-Header auf ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["strict-transport-security"]).toContain("max-age=");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}
