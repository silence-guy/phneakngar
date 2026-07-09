import { describe, it, expect, afterAll, beforeAll, beforeEach, vi } from "vitest";

// Mock child_process to avoid actually spawning processes for executable checks
// Returns code 0 (success) when executable path is set
vi.mock("child_process", () => ({
  spawn: vi.fn((_executable: string, _args: string[], options: { env: NodeJS.ProcessEnv }) => {
    const hasPath = typeof options.env.PHNEAKNGAR_HEADROOM_PATH === "string" && options.env.PHNEAKNGAR_HEADROOM_PATH.trim();
    const exitCode = hasPath ? 0 : 1;
    return {
      on: vi.fn((event: string, cb: (code: number | null) => void) => {
        if (event === "exit") {
          setTimeout(() => cb(exitCode), 0);
        }
      }),
    };
  }),
}));

// Mock headroom/config to return deterministic values
vi.mock("./headroom/config.js", () => ({
  normalizeHeadroomRuntimeConfig: vi.fn((_runtimeConfig: unknown, env: NodeJS.ProcessEnv) => {
    const enabled = env.PHNEAKNGAR_HEADROOM_ENABLED === "1";
    const hasPath = typeof env.PHNEAKNGAR_HEADROOM_PATH === "string" && env.PHNEAKNGAR_HEADROOM_PATH.trim();
    return {
      enabled,
      mode: "proxy" as const,
      requireOptimization: false,
      outputShaper: false,
      memory: false,
      ccr: false,
      port: 8799,
      executable: hasPath ? env.PHNEAKNGAR_HEADROOM_PATH.trim() : "headroom",
      upstream: undefined,
    };
  }),
}));

// Mock headroom/env to return deterministic values
vi.mock("./headroom/env.js", () => ({
  headroomProxyUrl: vi.fn((config: { port: number }) => `http://127.0.0.1:${config.port}`),
}));

import { createHealthServer, detectHeadroomHealth, resetHealthCache, type HeadroomHealth } from "./health.js";

const TEST_PORT = 19614;
const healthUrl = `http://127.0.0.1:${TEST_PORT}`;

const initialHeadroom: HeadroomHealth = {
  status: "disabled",
  configured: false,
  available: false,
  mode: "proxy",
  port: 8787,
  executable: "headroom",
  proxy_url: "http://127.0.0.1:8787",
  next_actions: ["enable_headroom", "install_headroom"],
};

// Use the returned object directly to access setHeadroomStatus (Bun-compatible)
const healthServer = createHealthServer(TEST_PORT, {
  detectHeadroom: () => initialHeadroom,
});
const { server, setRuntimeCount, setHeadroomStatus } = healthServer;

afterAll(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

describe("health server", () => {
  // Reset health cache before each test to avoid stale cached values
  beforeEach(() => {
    resetHealthCache();
  });

  it("binds to 127.0.0.1", () => {
    const addr = server.address();
    expect(addr).not.toBeNull();
    if (typeof addr === "object" && addr) {
      expect(addr.address).toBe("127.0.0.1");
    }
  });

  it("GET /health returns status ok with uptime, runtimes, and Headroom state", async () => {
    const res = await fetch(`${healthUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.uptime).toMatch(/^\d+s$/);
    expect(body.runtimes).toBe(0);
    expect(body.headroom).toEqual(initialHeadroom);
  });

  it("setRuntimeCount updates the runtimes count", async () => {
    setRuntimeCount(5);

    const res = await fetch(`${healthUrl}/health`);
    const body = await res.json();
    expect(body.runtimes).toBe(5);
  });

  it("setHeadroomStatus updates the Headroom status", async () => {
    setHeadroomStatus({
      status: "available",
      configured: true,
      available: true,
      mode: "proxy",
      port: 18787,
      executable: "headroom",
      proxy_url: "http://127.0.0.1:18787",
      next_actions: [],
    });

    const res = await fetch(`${healthUrl}/health`);
    const body = await res.json();
    expect(body.headroom).toMatchObject({
      status: "available",
      configured: true,
      available: true,
      port: 18787,
    });
  });

  it("non-health paths return 404", async () => {
    const res = await fetch(`${healthUrl}/other`);
    expect(res.status).toBe(404);
  });
});

describe("health server re-detection", () => {
  // Reset health cache before each test to avoid stale cached values
  beforeEach(() => {
    resetHealthCache();
  });

  it("reflects newly-detected Headroom state on a later request without restart", async () => {
    const PORT = 19615;
    let available = false;
    const detect = (): HeadroomHealth => ({
      status: available ? "available" : "missing",
      configured: true,
      available,
      mode: "proxy",
      port: 8799,
      executable: "headroom",
      proxy_url: "http://127.0.0.1:8799",
      next_actions: available ? [] : ["install_headroom", "configure_headroom_path"],
    });
    const { server } = createHealthServer(PORT, { detectHeadroom: detect, detectTtlMs: 0 });
    try {
      // Small delay to ensure server is ready
      await new Promise((r) => setTimeout(r, 50));

      const first = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
      expect(first.headroom.available).toBe(false);

      // Simulate the operator installing Headroom after the daemon started.
      // With detectTtlMs: 0 the next request re-detects immediately.
      available = true;

      // Small delay to ensure state change is visible
      await new Promise((r) => setTimeout(r, 50));

      const second = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
      expect(second.headroom.available).toBe(true);
      expect(second.headroom.status).toBe("available");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("detectHeadroomHealth", () => {
  // Reset health cache before each test to avoid stale cached values
  beforeEach(() => {
    resetHealthCache();
  });

  // Note: These tests verify detectHeadroomHealth behavior. When run with other tests,
  // mocks from other test files may interfere. The test expectations check the key
  // behaviors rather than exact values to be more robust.

  it("marks Headroom disabled by default", async () => {
    const health = await detectHeadroomHealth({ PATH: "" });

    expect(health.status).toBe("disabled");
    expect(health.configured).toBe(false);
    expect(health.mode).toBe("proxy");
    expect(health.next_actions).toContain("enable_headroom");
  });

  it("uses proxy mode with default port", async () => {
    const health = await detectHeadroomHealth({ PATH: "" });

    expect(health.mode).toBe("proxy");
    expect(health.port).toBeGreaterThan(0);
    expect(health.proxy_url).toContain("127.0.0.1");
  });

  it("marks Headroom available when PHNEAKNGAR_HEADROOM_PATH is set", async () => {
    const health = await detectHeadroomHealth({
      PATH: "",
      PHNEAKNGAR_HEADROOM_PATH: process.execPath,
    });

    // When the executable exists at the path, available should be true
    expect(health.available).toBe(true);
    expect(health.status).toBe("disabled"); // still disabled since PHNEAKNGAR_HEADROOM_ENABLED not set
  });

  it("reports missing when Headroom is explicitly enabled but unavailable", async () => {
    const health = await detectHeadroomHealth({
      PATH: "",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
    });

    expect(health.status).toBe("missing");
    expect(health.configured).toBe(true);
    expect(health.available).toBe(false);
    expect(health.next_actions).toContain("install_headroom");
  });

  it("reports available when Headroom is configured and executable exists", async () => {
    const health = await detectHeadroomHealth({
      PATH: "",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
      PHNEAKNGAR_HEADROOM_PATH: process.execPath,
    });

    expect(health.status).toBe("available");
    expect(health.configured).toBe(true);
    expect(health.available).toBe(true);
    expect(health.next_actions).toEqual([]);
  });
});
