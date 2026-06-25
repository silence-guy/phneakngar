import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareHeadroomForTask } from "./index.js";
import { ensureHeadroomProxy } from "./supervisor.js";
import type { Task } from "../types.js";

vi.mock("./supervisor.js", () => ({
  ensureHeadroomProxy: vi.fn(),
}));

const mockEnsureHeadroomProxy = vi.mocked(ensureHeadroomProxy);

function makeTask(runtimeConfig?: Record<string, unknown>): Task {
  return {
    id: "t1",
    agentId: "a1",
    runtimeId: "rt1",
    conversationId: "c1",
    workspaceId: "ws1",
    prompt: "do the thing",
    status: "dispatched",
    priority: 0,
    type: "user_dm_message",
    contextKey: "c1",
    createdAt: "2026-01-01T00:00:00Z",
    traceId: null,
    parentTaskId: null,
    channel: null,
    agent: runtimeConfig ? { runtimeConfig } as Task["agent"] : undefined,
  };
}

describe("prepareHeadroomForTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a no-op result without probing when Headroom is disabled", async () => {
    const result = await prepareHeadroomForTask(makeTask({ model: "sonnet" }), "claude");

    expect(result).toEqual({
      status: "disabled",
      env: {},
      requireOptimization: false,
    });
    expect(mockEnsureHeadroomProxy).not.toHaveBeenCalled();
  });

  it.each([
    ["claude", "ANTHROPIC_BASE_URL", "http://127.0.0.1:18787"],
    ["codex", "OPENAI_BASE_URL", "http://127.0.0.1:18787/v1"],
    ["opencode", "OPENAI_BASE_URL", "http://127.0.0.1:18787/v1"],
  ])("builds the ready proxy env overlay for %s", async (provider, envKey, expectedUrl) => {
    mockEnsureHeadroomProxy.mockResolvedValue({ status: "ready", started: false });

    const result = await prepareHeadroomForTask(
      makeTask({
        headroom: {
          enabled: true,
          outputShaper: true,
          port: 18787,
        },
      }),
      provider,
    );

    expect(result.status).toBe("ready");
    expect(result.requireOptimization).toBe(false);
    expect(result.diagnostic).toBe("Headroom proxy reused on 127.0.0.1:18787");
    expect(result.env).toMatchObject({
      ALOOK_HEADROOM_ENABLED: "1",
      HEADROOM_HOST: "127.0.0.1",
      HEADROOM_PORT: "18787",
      HEADROOM_TELEMETRY: "off",
      HEADROOM_OUTPUT_SHAPER: "1",
      [envKey]: expectedUrl,
    });
    expect(result.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(result.env).not.toHaveProperty("OPENAI_API_KEY");
  });

  it("adds the OpenCode proxy hint without requiring global config mutation", async () => {
    mockEnsureHeadroomProxy.mockResolvedValue({ status: "ready", started: true });

    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, port: 18787 } }),
      "opencode",
    );

    expect(result.env).toMatchObject({
      OPENAI_BASE_URL: "http://127.0.0.1:18787/v1",
      HEADROOM_PROXY_URL: "http://127.0.0.1:18787",
    });
    expect(result.diagnostic).toBe("Headroom proxy started on 127.0.0.1:18787");
  });

  it("fails before proxy startup for unsupported providers", async () => {
    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, requireOptimization: true } }),
      "unknown-runtime",
    );

    expect(result).toEqual({
      status: "failed",
      env: {},
      requireOptimization: true,
      diagnostic: "Headroom is not configured for provider: unknown-runtime",
    });
    expect(mockEnsureHeadroomProxy).not.toHaveBeenCalled();
  });

  it("preserves the required-optimization flag when the proxy is unavailable", async () => {
    mockEnsureHeadroomProxy.mockResolvedValue({
      status: "failed",
      reason: "Headroom executable not found: headroom",
    });

    const result = await prepareHeadroomForTask(
      makeTask({ headroom: { enabled: true, requireOptimization: true } }),
      "codex",
    );

    expect(result).toEqual({
      status: "failed",
      env: {},
      requireOptimization: true,
      diagnostic: "Headroom executable not found: headroom",
    });
  });
});
