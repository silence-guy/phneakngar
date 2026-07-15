import { describe, it, expect } from "vitest";
import { normalizeMemberRole } from "./workspace-context";

describe("normalizeMemberRole", () => {
  it("returns owner only for exact owner role", () => {
    expect(normalizeMemberRole("owner")).toBe("owner");
  });

  it("maps missing or other roles to member", () => {
    expect(normalizeMemberRole("member")).toBe("member");
    expect(normalizeMemberRole(undefined)).toBe("member");
    expect(normalizeMemberRole(null)).toBe("member");
    expect(normalizeMemberRole("admin")).toBe("member");
  });
});
