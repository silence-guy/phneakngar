import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { callbackWeb, type MeetingRunnerInput } from "./meeting-runner.js";

const input: MeetingRunnerInput = {
  meetingId: "meeting-1",
  meetingUrl: "https://meet.google.com/test",
  participants: [],
  workspaceId: "workspace-1",
  callbackUrl: "https://app.example",
  authToken: "secret-token",
};

describe("meeting callback reporting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("retries retryable non-2xx responses and succeeds", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = callbackWeb(input, "completed", "transcript");
    await vi.runAllTimersAsync();
    await result;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "https://app.example/api/meeting/callback",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer secret-token" }),
      }),
    );
  });

  it("retries transport failures with a bounded attempt count", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const result = callbackWeb(input, "failed", undefined, "meeting failed");
    const rejection = expect(result).rejects.toThrow("fetch failed");
    await vi.runAllTimersAsync();
    await rejection;

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not retry non-retryable 4xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(callbackWeb(input, "completed", "transcript"))
      .rejects.toThrow("callback returned HTTP 403");

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
