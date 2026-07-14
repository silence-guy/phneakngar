import { describe, it, expect, vi, afterEach } from "vitest";
import { fromApiTask } from "./types.js";
import type { TaskApi } from "@phneakngar/shared";
import { PollResponseSchema } from "@phneakngar/shared";
import {
  ChhlatClient,
  ChhlatHttpError,
  isTaskAlreadyTerminalError,
} from "./client.js";

// ---------------------------------------------------------------------------
// Schema-level validation tests
// ---------------------------------------------------------------------------

describe("PollResponseSchema validation", () => {
  it("parses valid response with tasks", () => {
    const raw = {
      tasks: [{
        id: "t1",
        agent_id: "a1",
        runtime_id: "r1",
        conversation_id: "c1",
        workspace_id: "w1",
        prompt: "do it",
        status: "dispatched",
        priority: 1,
        dispatched_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        result: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        type: "user_dm_message",
        agent: { instructions: "help", name: "bot", runtime_config: {} },
      }],
    };

    const parsed = PollResponseSchema.parse(raw);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.tasks[0].id).toBe("t1");
    expect(parsed.tasks[0].agent?.name).toBe("bot");
  });

  it("parses response with pending_rescan", () => {
    const parsed = PollResponseSchema.parse({ tasks: [], pending_rescan: true });
    expect(parsed.pending_rescan).toBe(true);
  });

  it("parses response without pending_rescan (optional)", () => {
    const parsed = PollResponseSchema.parse({ tasks: [] });
    expect(parsed.pending_rescan).toBeUndefined();
  });

  it("parses empty tasks array", () => {
    const parsed = PollResponseSchema.parse({ tasks: [] });
    expect(parsed.tasks).toEqual([]);
  });

  it("throws ZodError when tasks contains invalid items", () => {
    const raw = { tasks: [{ id: "t1" }] }; // missing required fields
    expect(() => PollResponseSchema.parse(raw)).toThrow();
  });

  it("parses task with email_handle in agent data", () => {
    const raw = {
      tasks: [{
        id: "t1",
        agent_id: "a1",
        runtime_id: "r1",
        conversation_id: "c1",
        workspace_id: "w1",
        prompt: "do it",
        status: "dispatched",
        priority: 1,
        dispatched_at: "2024-01-01T00:00:00Z",
        started_at: null,
        completed_at: null,
        result: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        type: "user_dm_message",
        agent: { instructions: "help", name: "bot", runtime_config: {}, email_handle: "myagent" },
      }],
    };

    const parsed = PollResponseSchema.parse(raw);
    expect(parsed.tasks[0].agent?.email_handle).toBe("myagent");
  });

  it("parses task with null email_handle", () => {
    const raw = {
      tasks: [{
        id: "t1",
        agent_id: "a1",
        runtime_id: "r1",
        conversation_id: "c1",
        workspace_id: "w1",
        prompt: "do it",
        status: "dispatched",
        priority: 1,
        dispatched_at: null,
        started_at: null,
        completed_at: null,
        result: null,
        error: null,
        created_at: "2024-01-01T00:00:00Z",
        type: "user_dm_message",
        agent: { instructions: "help", name: "bot", runtime_config: {}, email_handle: null },
      }],
    };

    const parsed = PollResponseSchema.parse(raw);
    expect(parsed.tasks[0].agent?.email_handle).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ChhlatClient.poll() integration tests with mocked fetch
// ---------------------------------------------------------------------------

function validPollResponse() {
  return {
    tasks: [{
      id: "t1",
      agent_id: "a1",
      runtime_id: "r1",
      conversation_id: "c1",
      workspace_id: "w1",
      prompt: "do it",
      status: "dispatched",
      priority: 1,
      dispatched_at: "2024-01-01T00:00:00Z",
      started_at: null,
      completed_at: null,
      result: null,
      error: null,
      created_at: "2024-01-01T00:00:00Z",
      type: "user_dm_message",
    }],
  };
}

describe("ChhlatClient.poll() with mocked fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends correct POST body with chhlat_id to /api/chhlat/tasks/poll", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tasks: [] }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await client.poll("tok", "d1", 3);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/chhlat/tasks/poll",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chhlat_id: "d1", max_tasks: 3 }),
      }),
    );
  });

  it("passes token in Authorization header per-call", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tasks: [] }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await client.poll("my_token_123", "d1", 1);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my_token_123",
        }),
      }),
    );
  });

  it("returns tasks and evicted: false on valid response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(validPollResponse()),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.poll("tok", "d1", 1);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe("t1");
    expect(result.evicted).toBe(false);
  });

  it("returns empty tasks and evicted: false when no tasks", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tasks: [] }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.poll("tok", "d1", 1);
    expect(result.tasks).toEqual([]);
    expect(result.evicted).toBe(false);
  });

  it("returns pending_rescan when present in response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tasks: [], pending_rescan: true }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.poll("tok", "d1", 1);
    expect(result.tasks).toEqual([]);
    expect(result.pending_rescan).toBe(true);
  });

  it("returns undefined pending_rescan when absent", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tasks: [] }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.poll("tok", "d1", 1);
    expect(result.pending_rescan).toBeUndefined();
  });

  it("returns evicted: true when server signals eviction", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ tasks: [], evicted: true }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.poll("tok", "d1", 1);
    expect(result.tasks).toEqual([]);
    expect(result.evicted).toBe(true);
  });

  it("throws ZodError when API returns wrong shape", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ unexpected: "data" }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await expect(client.poll("tok", "d1", 1)).rejects.toThrow();
  });
});

describe("ChhlatClient.wsTicket() with mocked fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fetches a chhlat WebSocket ticket over authenticated HTTP", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ticket: "ticket-1", workspaceId: "workspace-1", expiresAt: "2026-07-14T00:00:00.000Z", wsPort: 8789 }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.wsTicket("al_machine", "host-1");

    expect(result).toEqual({ ticket: "ticket-1", workspaceId: "workspace-1", expiresAt: "2026-07-14T00:00:00.000Z", wsPort: 8789 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/ws/token?chhlat_id=host-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer al_machine" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ChhlatClient.register() tests
// ---------------------------------------------------------------------------

describe("ChhlatClient.register() with mocked fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns parsed RegisterResponse on valid response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ runtimes: [{ id: "rt1" }] }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const resp = await client.register("tok", {
      workspace_id: "w1",
      chhlat_id: "d1",
      device_name: "mac",
      cli_version: "1.0",
      workspaces_root: "/home/.phneakngar/workspaces",
      runtimes: [{ type: "claude", version: "1.0" }],
    });
    expect(resp.runtimes[0].id).toBe("rt1");
  });

  it("passes token in Authorization header", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ runtimes: [{ id: "rt1" }] }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await client.register("my_ws_token", {
      workspace_id: "w1",
      chhlat_id: "d1",
      device_name: "mac",
      cli_version: "1.0",
      workspaces_root: "/home/.phneakngar/workspaces",
      runtimes: [{ type: "claude", version: "1.0" }],
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my_ws_token",
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ChhlatClient.deregister() tests
// ---------------------------------------------------------------------------

describe("ChhlatClient.deregister() with mocked fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends chhlat_id in body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await client.deregister("tok", "d1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/chhlat/deregister",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chhlat_id: "d1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ChhlatClient fetch retry tests
// ---------------------------------------------------------------------------

describe("ChhlatClient retries on TypeError (network failure)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("retries up to 3 times on TypeError then succeeds", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ tasks: [] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const result = await client.poll("tok", "d1", 1);

    expect(result.tasks).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws TypeError after exhausting all retries", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await expect(client.poll("tok", "d1", 1)).rejects.toThrow(TypeError);

    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it("does not retry on non-TypeError errors (e.g. HTTP errors)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await expect(client.completeTask("tok", "t1", { output: "done" })).rejects.toThrow("HTTP 500");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("preserves HTTP status and machine-readable server error code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "task is already in a terminal state",
      code: "TASK_ALREADY_TERMINAL",
    }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const error = await client.completeTask("secret-token", "t1", { output: "done" })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ChhlatHttpError);
    expect(error).toMatchObject({
      status: 409,
      code: "TASK_ALREADY_TERMINAL",
      message: "HTTP 409: task is already in a terminal state",
    });
    expect(isTaskAlreadyTerminalError(error)).toBe(true);
    expect(error.message).not.toContain("secret-token");
  });

  it("preserves plain-text HTTP errors without classifying them as terminal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("Forbidden", { status: 403 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const error = await client.completeTask("secret-token", "t1", { output: "done" })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ChhlatHttpError);
    expect(error).toMatchObject({ status: 403, code: undefined, message: "HTTP 403: Forbidden" });
    expect(isTaskAlreadyTerminalError(error)).toBe(false);
  });

  it("retries downloadArtifact on TypeError", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    const buf = await client.downloadArtifact("tok", "art1", "ws1");

    expect(buf.byteLength).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// ChhlatClient.heartbeat() tests
// ---------------------------------------------------------------------------

describe("ChhlatClient.heartbeat() with mocked fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends chhlat_id in body to /api/chhlat/heartbeat", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await client.heartbeat("tok", "d1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/chhlat/heartbeat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chhlat_id: "d1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// ChhlatClient.sweep() tests
// ---------------------------------------------------------------------------

describe("ChhlatClient.sweep() with mocked fetch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends chhlat_id in body to /api/chhlat/sweep", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    }) as unknown as typeof fetch;

    const client = new ChhlatClient("http://localhost:8080");
    await client.sweep("tok", "d1");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:8080/api/chhlat/sweep",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ chhlat_id: "d1" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ChhlatClient removed methods
// ---------------------------------------------------------------------------

describe("ChhlatClient removed methods", () => {
  it("does not have claimTask method", () => {
    const client = new ChhlatClient("http://localhost:8080");
    expect((client as any).claimTask).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// fromApiTask tests (unchanged)
// ---------------------------------------------------------------------------

function validApiTask(): TaskApi {
  return {
    id: "t1",
    agent_id: "a1",
    runtime_id: "r1",
    conversation_id: "c1",
    workspace_id: "w1",
    prompt: "do it",
    status: "dispatched",
    priority: 1,
    dispatched_at: "2024-01-01T00:00:00Z",
    started_at: null,
    completed_at: null,
    result: null,
    error: null,
    created_at: "2024-01-01T00:00:00Z",
    type: "user_dm_message",
    agent: { instructions: "help", name: "bot", runtime_config: {}, email_addresses: [], colleagues: [] },
  };
}

describe("fromApiTask", () => {
  it("correctly maps snake_case API response to camelCase Task", () => {
    const task = fromApiTask(validApiTask());
    expect(task.id).toBe("t1");
    expect(task.agentId).toBe("a1");
    expect(task.runtimeId).toBe("r1");
    expect(task.conversationId).toBe("c1");
    expect(task.workspaceId).toBe("w1");
    expect(task.prompt).toBe("do it");
    expect(task.status).toBe("dispatched");
    expect(task.priority).toBe(1);
    expect(task.type).toBe("user_dm_message");
    expect(task.agent?.name).toBe("bot");
    expect(task.agent?.instructions).toBe("help");
    expect(task.createdAt).toBe("2024-01-01T00:00:00Z");
  });

  it("handles missing repos field (defaults to undefined)", () => {
    const task = fromApiTask(validApiTask());
    expect(task.repos).toBeUndefined();
  });

  it("handles missing agent.id field (optional in API)", () => {
    const api = validApiTask();
    const task = fromApiTask(api);
    expect(task.agent?.id).toBeUndefined();
    expect(task.agent?.name).toBe("bot");
  });

  it("maps email_handle to emailHandle", () => {
    const api = validApiTask();
    api.agent = { instructions: "help", name: "bot", runtime_config: {}, email_handle: "myagent", email_addresses: [], colleagues: [] };
    const task = fromApiTask(api);
    expect(task.agent?.emailHandle).toBe("myagent");
  });

  it("maps null email_handle to undefined", () => {
    const api = validApiTask();
    api.agent = { instructions: "help", name: "bot", runtime_config: {}, email_handle: null, email_addresses: [], colleagues: [] };
    const task = fromApiTask(api);
    expect(task.agent?.emailHandle).toBeUndefined();
  });

  it("maps missing email_handle to undefined", () => {
    const api = validApiTask();
    // No email_handle field at all
    const task = fromApiTask(api);
    expect(task.agent?.emailHandle).toBeUndefined();
  });
});
