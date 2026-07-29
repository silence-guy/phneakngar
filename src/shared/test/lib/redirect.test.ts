import { describe, it, expect } from "vitest";
import { isSafeRedirectPath, safeRedirectPath } from "../../src/lib/redirect";

/**
 * Shared by middleware.ts and the sign-in client. They previously had separate
 * implementations that diverged: the client checked only a leading "//" and missed "/\",
 * which the WHATWG URL parser treats as "/", so `/\evil.example` was an open redirect at the
 * moment the user had just authenticated.
 */
describe("isSafeRedirectPath", () => {
  it("accepts ordinary relative paths", () => {
    expect(isSafeRedirectPath("/workspaces")).toBe(true);
    expect(isSafeRedirectPath("/w/acme?tab=agents")).toBe(true);
    expect(isSafeRedirectPath("/invite/abc#frag")).toBe(true);
    expect(isSafeRedirectPath("/")).toBe(true);
  });

  it("rejects the backslash trick (the divergence bug)", () => {
    expect(isSafeRedirectPath("/\\attacker.example")).toBe(false);
    expect(isSafeRedirectPath("/\\\\attacker.example")).toBe(false);
  });

  it("rejects scheme-relative URLs", () => {
    expect(isSafeRedirectPath("//attacker.example")).toBe(false);
  });

  it("rejects absolute URLs and non-path values", () => {
    expect(isSafeRedirectPath("https://attacker.example")).toBe(false);
    expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectPath("workspaces")).toBe(false);
    expect(isSafeRedirectPath("")).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });

  it("confirms both hostile forms resolve to an external origin", () => {
    // Why they must be rejected: the URL parser normalizes "\" to "/".
    expect(new URL("/\\attacker.example", "https://app.example").host).toBe(
      "attacker.example",
    );
    expect(new URL("//attacker.example", "https://app.example").host).toBe(
      "attacker.example",
    );
    // A safe path stays on the app origin.
    expect(new URL("/workspaces", "https://app.example").host).toBe("app.example");
  });
});

describe("safeRedirectPath", () => {
  it("returns the path when safe", () => {
    expect(safeRedirectPath("/w/acme", "/fallback")).toBe("/w/acme");
  });

  it("falls back for every hostile form", () => {
    expect(safeRedirectPath("/\\attacker.example", "/fallback")).toBe("/fallback");
    expect(safeRedirectPath("//attacker.example", "/fallback")).toBe("/fallback");
    expect(safeRedirectPath("https://attacker.example", "/fallback")).toBe("/fallback");
    expect(safeRedirectPath(null, "/fallback")).toBe("/fallback");
  });
});
