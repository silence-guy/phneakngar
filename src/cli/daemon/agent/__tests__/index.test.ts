import { describe, it, expect, vi } from "vitest";
import { ClaudeBackend } from "../claude.js";
import { CodexBackend } from "../codex.js";
import { OpenCodeBackend } from "../opencode.js";

// Import createBackend after class definitions are available
const { createBackend } = await import("../index.js");

describe("createBackend", () => {
  it('returns ClaudeBackend for "claude"', () => {
    const backend = createBackend("claude", "/usr/bin/claude");
    expect(backend).toBeInstanceOf(ClaudeBackend);
    expect(backend.name).toBe("claude");
  });

  it('returns CodexBackend for "codex"', () => {
    const backend = createBackend("codex", "/usr/bin/codex");
    expect(backend).toBeInstanceOf(CodexBackend);
    expect(backend.name).toBe("codex");
  });

  it('returns OpenCodeBackend for "opencode"', () => {
    const backend = createBackend("opencode", "/usr/bin/opencode");
    expect(backend).toBeInstanceOf(OpenCodeBackend);
    expect(backend.name).toBe("opencode");
  });

  it("throws for unknown provider", () => {
    expect(() => createBackend("unknown", "/usr/bin/unknown")).toThrow(
      "Unknown provider: unknown",
    );
  });
});
