import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreateIfAbsent = vi.fn();
const mockArtifactToResponse = vi.fn((row: any) => ({
  id: row.id,
  conversation_id: row.conversationId,
  agent_id: row.agentId,
  task_id: row.taskId ?? null,
  filename: row.filename,
  content_type: row.contentType,
  size: row.size,
  source: row.source,
  has_thumbnail: false,
  created_at: row.createdAt ?? "2026-07-16T00:00:00.000Z",
}));
const mockBroadcast = vi.fn().mockResolvedValue(undefined);

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      artifact: {
        createArtifactIfAbsent: (...a: unknown[]) => mockCreateIfAbsent(...a),
        artifactToResponse: (row: any) => mockArtifactToResponse(row),
      },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/broadcast", () => ({
  broadcastToUser: (...a: unknown[]) => mockBroadcast(...a),
}));

import {
  createTaskDeliveryArtifact,
  maybeCreateTaskDeliveryArtifact,
} from "./delivery-artifact";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTaskDeliveryArtifact", () => {
  it("returns null when bucket missing", async () => {
    const result = await createTaskDeliveryArtifact({} as any, null, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t1",
      result: { output: "hello digest" },
    });
    expect(result).toBeNull();
    expect(mockCreateIfAbsent).not.toHaveBeenCalled();
  });

  it("returns null when result has no text content", async () => {
    const bucket = { put: vi.fn() };
    const result = await createTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t1",
      result: { session_id: "s1" },
    });
    expect(result).toBeNull();
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("creates delivery artifact linked to task and writes R2", async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    const row = {
      id: "art_dlv_t1_delivery",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "w1",
      taskId: "t1",
      filename: "delivery.md",
      contentType: "text/markdown; charset=utf-8",
      size: 12,
      r2Key: "artifacts/w1/a1/c1/art_dlv_t1_delivery/delivery.md",
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    mockCreateIfAbsent.mockResolvedValue({ artifact: row, created: true });

    const result = await createTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t1",
      result: { output: "hello digest" },
      ownerUserId: "u1",
    });

    expect(result?.created).toBe(true);
    expect(result?.artifact.task_id).toBe("t1");
    expect(result?.artifact.source).toBe("delivery");
    expect(bucket.put).toHaveBeenCalledOnce();
    expect(mockCreateIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "art_dlv_t1_delivery",
        taskId: "t1",
        workspaceId: "w1",
        conversationId: "c1",
        source: "delivery",
      }),
    );
    expect(mockBroadcast).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ type: "artifact.uploaded", conversationId: "c1" }),
    );
  });

  it("is idempotent when row already exists", async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    const row = {
      id: "art_dlv_t1_digest",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "w1",
      taskId: "t1",
      filename: "digest.md",
      contentType: "text/markdown; charset=utf-8",
      size: 5,
      r2Key: "k",
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    mockCreateIfAbsent.mockResolvedValue({ artifact: row, created: false });

    const result = await createTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t1",
      result: { digest: "brief" },
      ownerUserId: "u1",
    });

    expect(result?.created).toBe(false);
    expect(result?.artifact.task_id).toBe("t1");
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it("honors forced kind and still links task + workspace", async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    const row = {
      id: "art_dlv_t9_report",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "w1",
      taskId: "t9",
      filename: "report.md",
      contentType: "text/markdown; charset=utf-8",
      size: 4,
      r2Key: "artifacts/w1/a1/c1/art_dlv_t9_report/report.md",
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    mockCreateIfAbsent.mockResolvedValue({ artifact: row, created: true });

    const result = await createTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t9",
      result: { output: "body" },
      kind: "report",
    });

    expect(result?.artifact.id).toBe("art_dlv_t9_report");
    expect(mockCreateIfAbsent).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        id: "art_dlv_t9_report",
        taskId: "t9",
        workspaceId: "w1",
        filename: "report.md",
        source: "delivery",
      }),
    );
    expect(bucket.put).toHaveBeenCalledWith(
      "artifacts/w1/a1/c1/art_dlv_t9_report/report.md",
      "body",
      expect.objectContaining({
        httpMetadata: { contentType: "text/markdown; charset=utf-8" },
      }),
    );
    expect(mockBroadcast).not.toHaveBeenCalled();
  });

  it("productizes JSON-stringified complete-task body (stored task.result)", async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    const row = {
      id: "art_dlv_t2_delivery",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "w1",
      taskId: "t2",
      filename: "delivery.md",
      contentType: "text/markdown; charset=utf-8",
      size: 4,
      r2Key: "k",
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    mockCreateIfAbsent.mockResolvedValue({ artifact: row, created: true });

    const result = await createTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t2",
      result: JSON.stringify({ output: "done", session_id: "s" }),
    });

    expect(result?.created).toBe(true);
    expect(bucket.put).toHaveBeenCalledWith(expect.any(String), "done", expect.any(Object));
  });
});

describe("maybeCreateTaskDeliveryArtifact", () => {
  it("swallows errors and returns null", async () => {
    const bucket = { put: vi.fn().mockRejectedValue(new Error("r2 down")) };
    const result = await maybeCreateTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t1",
      result: { output: "x" },
    });
    expect(result).toBeNull();
  });

  it("returns create result on success", async () => {
    const bucket = { put: vi.fn().mockResolvedValue(undefined) };
    const row = {
      id: "art_dlv_t1_delivery",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "w1",
      taskId: "t1",
      filename: "delivery.md",
      contentType: "text/markdown; charset=utf-8",
      size: 1,
      r2Key: "k",
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    mockCreateIfAbsent.mockResolvedValue({ artifact: row, created: true });

    const result = await maybeCreateTaskDeliveryArtifact({} as any, bucket, {
      workspaceId: "w1",
      agentId: "a1",
      conversationId: "c1",
      taskId: "t1",
      result: { output: "x" },
    });
    expect(result?.artifact.task_id).toBe("t1");
    expect(result?.artifact.source).toBe("delivery");
  });
});
