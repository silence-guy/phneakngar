import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { gatherContextEnvVars } from "./context-env.js";

describe("gatherContextEnvVars", () => {
  const envKeys = ["PHNEAKNGAR_CONVERSATION_ID", "PHNEAKNGAR_TRACE_ID", "PHNEAKNGAR_TASK_ID"];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of envKeys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
  });

  it("returns all env vars when set", () => {
    process.env.PHNEAKNGAR_CONVERSATION_ID = "conv_123";
    process.env.PHNEAKNGAR_TRACE_ID = "trace_456";
    process.env.PHNEAKNGAR_TASK_ID = "task_789";

    const result = gatherContextEnvVars();
    expect(result).toEqual({
      conversationId: "conv_123",
      traceId: "trace_456",
      sourceTaskId: "task_789",
    });
  });

  it("returns undefined for unset vars", () => {
    const result = gatherContextEnvVars();
    expect(result.conversationId).toBeUndefined();
    expect(result.traceId).toBeUndefined();
    expect(result.sourceTaskId).toBeUndefined();
  });

  it("handles partial env vars", () => {
    process.env.PHNEAKNGAR_CONVERSATION_ID = "conv_123";

    const result = gatherContextEnvVars();
    expect(result.conversationId).toBe("conv_123");
    expect(result.traceId).toBeUndefined();
    expect(result.sourceTaskId).toBeUndefined();
  });
});
