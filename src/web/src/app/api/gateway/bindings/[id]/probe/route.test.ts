import { describe, it, expect, vi } from "vitest";
import { probeProvider } from "./route";

describe("probeProvider", () => {
  it("fails without token", async () => {
    const r = await probeProvider("telegram", "");
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing token");
  });

  it("probes telegram getMe", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { username: "bot" } }),
    }));
    const r = await probeProvider(
      "telegram",
      "tok",
      fetchMock as unknown as typeof fetch,
    );
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("probes slack auth.test", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, team: "T" }),
    }));
    const r = await probeProvider(
      "slack",
      "xoxb-1",
      fetchMock as unknown as typeof fetch,
    );
    expect(r.ok).toBe(true);
  });

  it("rejects unsupported provider", async () => {
    const r = await probeProvider("discord", "tok");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not implemented/);
  });
});
