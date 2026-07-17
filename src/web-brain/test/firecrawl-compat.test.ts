import { describe, it, expect, afterAll } from "vitest";
import {
  startFirecrawlCompatServer,
  firecrawlJobStore,
} from "../src/firecrawl-compat.js";
import type { Server } from "node:http";

describe("firecrawl-compat", () => {
  let server: Server;
  let base: string;

  it("starts and answers health + map", async () => {
    const s = await startFirecrawlCompatServer({ host: "127.0.0.1", port: 0 });
    server = s.server;
    base = s.url;

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    const hj = (await health.json()) as { ok: boolean };
    expect(hj.ok).toBe(true);

    const mapRes = await fetch(`${base}/v1/map`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://example.com", limit: 3 }),
    });
    expect(mapRes.status).toBe(200);
    const mj = (await mapRes.json()) as { success: boolean; links?: string[] };
    expect(mj.success).toBe(true);
    expect(Array.isArray(mj.links)).toBe(true);
  }, 30_000);

  afterAll(() => {
    server?.close();
    void firecrawlJobStore;
  });
});
