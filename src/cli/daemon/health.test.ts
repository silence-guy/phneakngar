import { describe, it, expect, afterAll } from "vitest";
import { createHealthServer, detectHeadroomHealth, type HeadroomHealth } from "./health.js";

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

const { server, setRuntimeCount, setHeadroomStatus } = createHealthServer(TEST_PORT, {
  detectHeadroom: () => initialHeadroom,
});

afterAll(
  () => new Promise<void>((resolve) => server.close(() => resolve())),
);

describe("health server", () => {
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
  it("reflects newly-detected Headroom state on a later request without restart", async () => {
    const PORT = 19615;
    let available = false;
    const detect = (): HeadroomHealth => ({
      status: available ? "available" : "missing",
      configured: true,
      available,
      mode: "proxy",
      port: 8787,
      executable: "headroom",
      proxy_url: "http://127.0.0.1:8787",
      next_actions: available ? [] : ["install_headroom", "configure_headroom_path"],
    });
    const { server } = createHealthServer(PORT, { detectHeadroom: detect, detectTtlMs: 0 });
    try {
      const first = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
      expect(first.headroom.available).toBe(false);

      // Simulate the operator installing Headroom after the daemon started.
      // With detectTtlMs: 0 the next request re-detects immediately.
      available = true;

      const second = await (await fetch(`http://127.0.0.1:${PORT}/health`)).json();
      expect(second.headroom.available).toBe(true);
      expect(second.headroom.status).toBe("available");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe("detectHeadroomHealth", () => {
  it("marks Headroom disabled by default while preserving local proxy defaults", () => {
    const health = detectHeadroomHealth({ PATH: "" });

    expect(health).toMatchObject({
      status: "disabled",
      configured: false,
      available: false,
      mode: "proxy",
      port: 8799,
      executable: "headroom",
      proxy_url: "http://127.0.0.1:8799",
      next_actions: ["enable_headroom", "install_headroom"],
    });
  });

  it("suggests enabling Headroom when the executable is available but not configured", () => {
    const health = detectHeadroomHealth({
      PATH: "",
      PHNEAKNGAR_HEADROOM_PATH: process.execPath,
    });

    expect(health).toMatchObject({
      status: "disabled",
      configured: false,
      available: true,
      next_actions: ["enable_headroom"],
    });
  });

  it("reports missing when Headroom is explicitly enabled but unavailable", () => {
    const health = detectHeadroomHealth({
      PATH: "",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
    });

    expect(health).toMatchObject({
      status: "missing",
      configured: true,
      available: false,
      next_actions: ["install_headroom", "configure_headroom_path"],
    });
  });

  it("reports no next actions when Headroom is configured and executable", () => {
    const health = detectHeadroomHealth({
      PATH: "",
      PHNEAKNGAR_HEADROOM_ENABLED: "1",
      PHNEAKNGAR_HEADROOM_PATH: process.execPath,
    });

    expect(health).toMatchObject({
      status: "available",
      configured: true,
      available: true,
      next_actions: [],
    });
  });
});
