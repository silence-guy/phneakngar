import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as sharedMock from "@/test/shared-mock";

// ---------------------------------------------------------------------------
// Cross-route body-validation tests for chhlat endpoints.
// Uses real Zod schemas (parseBody is NOT mocked) so we can assert that
// invalid payloads are rejected before hitting any DB logic.
// ---------------------------------------------------------------------------

const chhlatAuth = { env: {}, userId: "u1", email: "u@t.com", authType: "machine" as const, workspaceId: "w1", machineTokenHostname: "d1" };

function baseMocks() {
  return {
    "@opennextjs/cloudflare": () => ({
      getCloudflareContext: vi.fn(() => ({ env: { DB: {} } })),
    }),
    "@/lib/middleware/auth": () => ({
      withAuth: vi.fn((handler: any) => async (req: any, ctx?: any) => {
        const params =
          ctx?.params instanceof Promise ? await ctx.params : ctx?.params;
        return handler(req, { ...chhlatAuth, params });
      }),
    }),
    "@/lib/middleware/helpers": () => {
      const { NextResponse } = require("next/server");
      return {
        writeJSON: (data: unknown, status = 200) => NextResponse.json(data, { status }),
        writeError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
        formatTimestamp: (d: Date | string | null) => d instanceof Date ? d.toISOString() : d || "",
        parseBody: async (req: Request, schema: { parse: (d: unknown) => unknown }) => {
          try {
            const data = await req.json();
            return [schema.parse(data), null];
          } catch {
            return [null, NextResponse.json({ error: "invalid request body" }, { status: 400 })];
          }
        },
      };
    },
    "@/lib/logger": () => ({
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }),
  };
}

function applyBase() {
  const m = baseMocks();
  vi.doMock("@opennextjs/cloudflare", m["@opennextjs/cloudflare"]);
  vi.doMock("@/lib/db", () => ({
    getDb: vi.fn(() => ({})),
    withD1Retry: vi.fn((fn: () => Promise<any>) => fn()),
  }));
  vi.doMock("@/lib/middleware/auth", m["@/lib/middleware/auth"]);
  vi.doMock("@/lib/middleware/helpers", m["@/lib/middleware/helpers"]);
  vi.doMock("@/lib/logger", m["@/lib/logger"]);
}

function postReq(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function postRaw(url: string, raw: string) {
  return new NextRequest(url, {
    method: "POST",
    body: raw,
    headers: { "Content-Type": "application/json" },
  });
}

describe("chhlat route body validation", () => {
  beforeEach(() => vi.clearAllMocks());

  // -----------------------------------------------------------------------
  // POST /chhlat/register
  // -----------------------------------------------------------------------

  describe("POST /chhlat/register", () => {
    async function loadRegister() {
      vi.resetModules();
      applyBase();

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          member: {
            getMemberByUserAndWorkspace: vi.fn().mockResolvedValue({ id: "m1" }),
          },
          machine: {
            getMachineByChhlat: vi.fn().mockResolvedValue(null),
            upsertMachine: vi.fn().mockResolvedValue({ chhlatId: "d1", workspaceId: "w1" }),
          },
          runtime: {
            upsertAgentRuntime: vi.fn().mockResolvedValue({ id: "rt1", workspaceId: "w1" }),
          },
        },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        runtimeToResponse: (r: any) => r,
      }));

      return (await import("./register/route")).POST;
    }

    it("returns 400 when workspace_id is empty", async () => {
      const POST = await loadRegister();
      const res = await POST(
        postReq("http://localhost/api/chhlat/register", {
          workspace_id: "",
          chhlat_id: "d1",
          runtimes: [{ type: "claude" }],
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when runtimes is empty array", async () => {
      const POST = await loadRegister();
      const res = await POST(
        postReq("http://localhost/api/chhlat/register", {
          workspace_id: "w1",
          chhlat_id: "d1",
          runtimes: [],
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 on malformed JSON", async () => {
      const POST = await loadRegister();
      const res = await POST(
        postRaw("http://localhost/api/chhlat/register", "not json{{{")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("invalid request body");
    });

    it("stores deviceInfo correctly", async () => {
      const POST = await loadRegister();
      const upsertMock = vi.fn().mockResolvedValue({
        id: "rt1",
        workspaceId: "w1",
        deviceInfo: "MacBook Pro",
      });

      // Re-mock with a trackable upsert
      vi.resetModules();
      applyBase();
      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          member: {
            getMemberByUserAndWorkspace: vi.fn().mockResolvedValue({ id: "m1" }),
          },
          machine: {
            getMachineByChhlat: vi.fn().mockResolvedValue(null),
            upsertMachine: vi.fn().mockResolvedValue({ chhlatId: "d1", workspaceId: "w1" }),
          },
          runtime: {
            upsertAgentRuntime: upsertMock,
          },
        },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        runtimeToResponse: (r: any) => r,
      }));

      const POST2 = (await import("./register/route")).POST;
      await POST2(
        postReq("http://localhost/api/chhlat/register", {
          workspace_id: "w1",
          chhlat_id: "d1",
          device_name: "MacBook Pro",
          runtimes: [{ type: "claude" }],
        })
      );

      expect(upsertMock).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ deviceInfo: "MacBook Pro" })
      );
    });

    it("stores version in metadata", async () => {
      vi.resetModules();
      applyBase();

      const upsertMock = vi.fn().mockResolvedValue({
        id: "rt1",
        workspaceId: "w1",
      });

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          member: {
            getMemberByUserAndWorkspace: vi.fn().mockResolvedValue({ id: "m1" }),
          },
          machine: {
            getMachineByChhlat: vi.fn().mockResolvedValue(null),
            upsertMachine: vi.fn().mockResolvedValue({ chhlatId: "d1", workspaceId: "w1" }),
          },
          runtime: {
            upsertAgentRuntime: upsertMock,
          },
        },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        runtimeToResponse: (r: any) => r,
      }));

      const POST = (await import("./register/route")).POST;
      await POST(
        postReq("http://localhost/api/chhlat/register", {
          workspace_id: "w1",
          chhlat_id: "d1",
          cli_version: "0.5.1",
          runtimes: [{ type: "claude", version: "3.5" }],
        })
      );

      expect(upsertMock).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          metadata: expect.objectContaining({ version: "3.5", cli_version: "0.5.1" }),
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // POST /chhlat/tasks/poll
  // -----------------------------------------------------------------------

  describe("POST /chhlat/tasks/poll", () => {
    async function loadPoll() {
      vi.resetModules();
      applyBase();

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          runtime: {
            getRuntimeIdsByChhlat: vi.fn().mockResolvedValue(["r1"]),
          },
          machine: {
            getMachineByChhlat: vi.fn().mockResolvedValue(null),
            updateMachineLastSeen: vi.fn().mockResolvedValue(undefined),
          },
          agent: {
            getAgent: vi.fn().mockResolvedValue(null),
          },
        },
        };
      });
      vi.doMock("@/lib/services/task", () => ({
        TaskService: vi.fn().mockImplementation(() => ({
          claimTasksForRuntimes: vi.fn().mockResolvedValue([]),
        })),
      }));
      vi.doMock("@/lib/services/sweep", () => ({
        sweepStaleState: vi.fn().mockResolvedValue(undefined),
      }));
      vi.doMock("@/lib/services/calendar", () => ({
        promoteDueCalendarEventsForWorkspace: vi.fn().mockResolvedValue(0),
      }));
      vi.doMock("@/lib/broadcast", () => ({
        broadcastToUser: vi.fn().mockResolvedValue(undefined),
      }));

      return (await import("./tasks/poll/route")).POST;
    }

    it("returns 400 when chhlat_id is missing", async () => {
      const POST = await loadPoll();
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/poll", {})
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when chhlat_id is empty string", async () => {
      const POST = await loadPoll();
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/poll", { chhlat_id: "" })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when max_tasks is 0", async () => {
      const POST = await loadPoll();
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/poll", { chhlat_id: "d1", max_tasks: 0 })
      );
      expect(res.status).toBe(400);
    });

    it("rejects old-format body with runtime_ids", async () => {
      const POST = await loadPoll();
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/poll", { runtime_ids: ["r1"] })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 on malformed JSON", async () => {
      const POST = await loadPoll();
      const res = await POST(
        postRaw("http://localhost/api/chhlat/tasks/poll", "not json{{{")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("invalid request body");
    });
  });

  // -----------------------------------------------------------------------
  // POST /chhlat/deregister
  // -----------------------------------------------------------------------

  describe("POST /chhlat/deregister", () => {
    async function loadDeregister() {
      vi.resetModules();
      applyBase();

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          machine: {
            getMachineByChhlat: vi.fn().mockResolvedValue(null),
            setMachineLastSeenNull: vi.fn().mockResolvedValue(undefined),
          },
        },
        };
      });
      vi.doMock("@/lib/broadcast", () => ({
        broadcastToUser: vi.fn().mockResolvedValue(undefined),
      }));

      return (await import("./deregister/route")).POST;
    }

    it("returns 400 when chhlat_id is missing", async () => {
      const POST = await loadDeregister();
      const res = await POST(
        postReq("http://localhost/api/chhlat/deregister", {})
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when chhlat_id is empty", async () => {
      const POST = await loadDeregister();
      const res = await POST(
        postReq("http://localhost/api/chhlat/deregister", {
          chhlat_id: "",
        })
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 on malformed JSON", async () => {
      const POST = await loadDeregister();
      const res = await POST(
        postRaw("http://localhost/api/chhlat/deregister", "{{bad")
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("invalid request body");
    });
  });

  // -----------------------------------------------------------------------
  // POST /chhlat/tasks/:taskId/complete
  // -----------------------------------------------------------------------

  describe("POST /chhlat/tasks/:taskId/complete", () => {
    async function loadComplete() {
      vi.resetModules();
      applyBase();

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        };
      });
      vi.doMock("@/lib/services/task", () => ({
        TaskService: vi.fn().mockImplementation(() => ({
          completeTask: vi.fn().mockResolvedValue({
            id: "t1",
            agentId: "a1",
            runtimeId: "rt1",
            workspaceId: "w1",
            conversationId: "c1",
            prompt: "p",
            status: "completed",
            priority: 0,
            dispatchedAt: null,
            startedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
          }),
        })),
      }));
      vi.doMock("@/lib/api/responses", () => ({
        taskToResponse: (t: any) => ({ id: t.id, status: t.status }),
      }));

      return (await import("./tasks/[taskId]/complete/route")).POST;
    }

    it("returns 400 on malformed JSON", async () => {
      const POST = await loadComplete();
      const res = await POST(
        postRaw("http://localhost/api/chhlat/tasks/t1/complete", "{bad}"),
        { params: Promise.resolve({ taskId: "t1" }) }
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("invalid request body");
    });
  });

  // -----------------------------------------------------------------------
  // POST /chhlat/tasks/:taskId/fail
  // -----------------------------------------------------------------------

  describe("POST /chhlat/tasks/:taskId/fail", () => {
    async function loadFail() {
      vi.resetModules();
      applyBase();

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        };
      });
      vi.doMock("@/lib/services/task", () => ({
        TaskService: vi.fn().mockImplementation(() => ({
          failTask: vi.fn().mockResolvedValue({
            id: "t1",
            agentId: "a1",
            runtimeId: "rt1",
            workspaceId: "w1",
            conversationId: "c1",
            prompt: "p",
            status: "failed",
            priority: 0,
            dispatchedAt: null,
            startedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
          }),
        })),
      }));
      vi.doMock("@/lib/api/responses", () => ({
        taskToResponse: (t: any) => ({ id: t.id, status: t.status }),
      }));

      return (await import("./tasks/[taskId]/fail/route")).POST;
    }

    it("returns 400 on malformed JSON", async () => {
      const POST = await loadFail();
      const res = await POST(
        postRaw("http://localhost/api/chhlat/tasks/t1/fail", "nope"),
        { params: Promise.resolve({ taskId: "t1" }) }
      );
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.error).toBe("invalid request body");
    });
  });

  // -----------------------------------------------------------------------
  // POST /chhlat/tasks/:taskId/messages
  // -----------------------------------------------------------------------

  describe("POST /chhlat/tasks/:taskId/messages", () => {
    async function loadMessages() {
      vi.resetModules();
      applyBase();

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          task: {
            getTask: vi.fn().mockResolvedValue({ id: "t1", workspaceId: "w1", runtimeId: "rt1", conversationId: "c1" }),
          },
          runtime: {
            getAgentRuntimeForWorkspace: vi.fn().mockResolvedValue({ id: "rt1" }),
          },
          taskMessage: {
            TaskMessageConflictError: actual.queries.taskMessage.TaskMessageConflictError,
            taskMessagePayloadFingerprint: actual.queries.taskMessage.taskMessagePayloadFingerprint,
            createTaskMessage: vi.fn().mockImplementation((_db, data) => Promise.resolve({
              message: { id: `m${data.seq}`, ...data },
              created: true,
            })),
          },
          conversation: {
            getConversation: vi.fn().mockResolvedValue({ id: "c1", userId: "u1" }),
          },
        },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        taskMessageToResponse: (m: any) => m,
      }));
      vi.doMock("@/lib/broadcast", () => ({
        broadcastToUser: vi.fn().mockResolvedValue(undefined),
      }));

      return (await import("./tasks/[taskId]/messages/route")).POST;
    }

    it("returns 400 when message item missing seq/type", async () => {
      const POST = await loadMessages();
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/t1/messages", {
          messages: [{ content: "hello" }],
        }),
        { params: Promise.resolve({ taskId: "t1" }) }
      );

      expect(res.status).toBe(400);
    });

    it("broadcasts task.messages via WebSocket after writing to DB", async () => {
      vi.resetModules();
      applyBase();

      const createMock = vi.fn().mockImplementation((_db, data) => Promise.resolve({
        message: { id: `m${data.seq}`, ...data },
        created: true,
      }));
      const broadcastMock = vi.fn().mockResolvedValue(undefined);

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>("@phneakngar/shared");
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
        queries: {
          task: {
            getTask: vi.fn().mockResolvedValue({ id: "t1", workspaceId: "w1", runtimeId: "rt1", conversationId: "c1" }),
          },
          runtime: {
            getAgentRuntimeForWorkspace: vi.fn().mockResolvedValue({ id: "rt1" }),
          },
          taskMessage: {
            TaskMessageConflictError: actual.queries.taskMessage.TaskMessageConflictError,
            taskMessagePayloadFingerprint: actual.queries.taskMessage.taskMessagePayloadFingerprint,
            createTaskMessage: createMock,
          },
          conversation: {
            getConversation: vi.fn().mockResolvedValue({ id: "c1", userId: "owner-u2" }),
          },
        },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        taskMessageToResponse: (m: any) => m,
      }));
      vi.doMock("@/lib/broadcast", () => ({
        broadcastToUser: broadcastMock,
      }));

      const POST = (await import("./tasks/[taskId]/messages/route")).POST;
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/t1/messages", {
          messages: [
            { seq: 1, type: "text", content: "hello" },
            { seq: 2, type: "tool-use", tool: "Read", content: "" },
          ],
        }),
        { params: Promise.resolve({ taskId: "t1" }) }
      );

      expect(res.status).toBe(200);
      expect(broadcastMock).toHaveBeenCalledWith(
        "owner-u2",
        expect.objectContaining({
          type: "task.messages",
          taskId: "t1",
          messages: [
            expect.objectContaining({ seq: 1, type: "text", content: "hello" }),
          ],
        })
      );
    });

    it("does not broadcast when messages array is empty", async () => {
      vi.resetModules();
      applyBase();

      const broadcastMock = vi.fn().mockResolvedValue(undefined);

      vi.doMock("@phneakngar/shared", async () => {
        const real = await import("@phneakngar/shared");
        return {
          ...real,
          createDb: vi.fn(() => ({})),
          queries: {
            task: {
              getTask: vi.fn().mockResolvedValue({ id: "t1", workspaceId: "w1", runtimeId: "rt1", conversationId: "c1" }),
            },
            runtime: {
              getAgentRuntimeForWorkspace: vi.fn().mockResolvedValue({ id: "rt1" }),
            },
            taskMessage: {
              TaskMessageConflictError: real.queries.taskMessage.TaskMessageConflictError,
              taskMessagePayloadFingerprint: real.queries.taskMessage.taskMessagePayloadFingerprint,
              createTaskMessage: vi.fn().mockResolvedValue(undefined),
            },
            conversation: {
              getConversation: vi.fn().mockResolvedValue({ id: "c1", userId: "owner-u2" }),
            },
          },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        taskMessageToResponse: (m: any) => m,
      }));
      vi.doMock("@/lib/broadcast", () => ({
        broadcastToUser: broadcastMock,
      }));

      const POST = (await import("./tasks/[taskId]/messages/route")).POST;
      const res = await POST(
        postReq("http://localhost/api/chhlat/tasks/t1/messages", {
          messages: [],
        }),
        { params: Promise.resolve({ taskId: "t1" }) }
      );

      expect(res.status).toBe(200);
      expect(broadcastMock).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /chhlat/approvals
  // -----------------------------------------------------------------------

  describe("POST /chhlat/approvals", () => {
    async function loadApprovals() {
      vi.resetModules();
      applyBase();

      const createApproval = vi.fn().mockResolvedValue({
        id: "ap_1",
        kind: "tool_action",
        status: "pending",
        title: "Tool: Bash",
        summary: "high_stakes:shell",
        payload: {},
        workspaceId: "w1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      vi.doMock("@phneakngar/shared", async () => {
        const actual = await vi.importActual<typeof import("@phneakngar/shared")>(
          "@phneakngar/shared",
        );
        return {
          ...actual,
          createDb: vi.fn(() => ({})),
          queries: {
            machine: {
              getMachineByChhlat: vi.fn().mockResolvedValue(null),
            },
            agent: {
              getAgent: vi.fn().mockResolvedValue({ id: "a1", workspaceId: "w1" }),
            },
            approval: {
              createApproval,
            },
          },
        };
      });
      vi.doMock("@/lib/api/responses", () => ({
        approvalToResponse: (row: any) => ({
          id: row.id,
          kind: row.kind,
          status: row.status,
          title: row.title,
        }),
      }));
      vi.doMock("@/lib/cache", () => ({
        invalidate: vi.fn().mockResolvedValue(undefined),
        cacheKeys: { overviewAttention: (ws: string) => `ov_att:${ws}` },
      }));

      const POST = (await import("./approvals/route")).POST;
      return { POST, createApproval };
    }

    it("rejects invalid body", async () => {
      const { POST } = await loadApprovals();
      const res = await POST(postRaw("http://localhost/api/chhlat/approvals", "{"), {});
      expect(res.status).toBe(400);
    });

    it("creates approval for valid machine body", async () => {
      const { POST, createApproval } = await loadApprovals();
      const res = await POST(
        postReq("http://localhost/api/chhlat/approvals", {
          chhlat_id: "d1",
          tool_name: "Bash",
          tool_class: "shell",
          request_id: "req_1",
        }),
        {},
      );
      expect(res.status).toBe(201);
      expect(createApproval).toHaveBeenCalled();
      const body = await res.json();
      expect(body.approval.id).toBe("ap_1");
    });
  });
});
