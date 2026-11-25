import { describe, expect, it } from "vitest";
import { localNeonEndpoint } from "./local-db";

describe("localNeonEndpoint", () => {
  it("is off without the variable", () => {
    expect(localNeonEndpoint({})).toBeNull();
    expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: " " })).toBeNull();
  });

  it("accepts http on this machine only", () => {
    expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: "http://localhost:4444/sql" })).toBe(
      "http://localhost:4444/sql"
    );
    expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: "http://127.0.0.1:4444/sql" })).toBe(
      "http://127.0.0.1:4444/sql"
    );
    expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: "http://example.org:4444/sql" })).toBeNull();
    expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: "https://localhost:4444/sql" })).toBeNull();
    expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: "kein link" })).toBeNull();
  });

  it("is never used on a server (APP_ENV set)", () => {
    for (const APP_ENV of ["production", "preview", "development"]) {
      expect(localNeonEndpoint({ LOCAL_NEON_HTTP_ENDPOINT: "http://localhost:4444/sql", APP_ENV })).toBeNull();
    }
  });
});
