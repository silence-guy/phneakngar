import { describe, it, expect, vi } from "vitest";
import * as artifactQueries from "../../src/db/queries/artifact";

function createMockDb(rows: any[]) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.from = vi.fn(() => chain);
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(rows));
  chain.insert = vi.fn(() => chain);
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(rows));
  return chain;
}

describe("artifact query module exports", () => {
  it("exports createArtifact", () => {
    expect(typeof artifactQueries.createArtifact).toBe("function");
  });

  it("exports listArtifactsByConversation", () => {
    expect(typeof artifactQueries.listArtifactsByConversation).toBe("function");
  });

  it("exports getArtifact", () => {
    expect(typeof artifactQueries.getArtifact).toBe("function");
  });

  it("exports getArtifactForOwner", () => {
    expect(typeof artifactQueries.getArtifactForOwner).toBe("function");
  });

  it("exports artifactToResponse", () => {
    expect(typeof artifactQueries.artifactToResponse).toBe("function");
  });
});

describe("artifactToResponse", () => {
  it("maps DB row to API response shape", () => {
    const row = {
      id: "art_123",
      conversationId: "conv_456",
      agentId: "ag_789",
      workspaceId: "ws_001",
      taskId: "task_1",
      filename: "report.pdf",
      contentType: "application/pdf",
      size: 2048,
      r2Key: "uploads/report.pdf",
      thumbnailR2Key: null,
      source: "upload",
      createdAt: "2026-01-15T10:00:00.000Z",
    };

    const result = artifactQueries.artifactToResponse(row as any);

    expect(result).toEqual({
      id: "art_123",
      conversation_id: "conv_456",
      agent_id: "ag_789",
      task_id: "task_1",
      filename: "report.pdf",
      content_type: "application/pdf",
      size: 2048,
      source: "upload",
      has_thumbnail: false,
      created_at: "2026-01-15T10:00:00.000Z",
    });
  });

  it("returns has_thumbnail true when thumbnailR2Key is set", () => {
    const row = {
      id: "art_123",
      conversationId: "conv_456",
      agentId: "ag_789",
      workspaceId: "ws_001",
      taskId: null,
      filename: "photo.png",
      contentType: "image/png",
      size: 50000,
      r2Key: "uploads/photo.png",
      thumbnailR2Key: "uploads/photo_thumb.jpg",
      source: "agent",
      createdAt: "2026-01-15T10:00:00.000Z",
    };

    const result = artifactQueries.artifactToResponse(row as any);
    expect(result.has_thumbnail).toBe(true);
    expect(result.task_id).toBeNull();
  });

  it("excludes internal fields like r2Key and workspaceId", () => {
    const row = {
      id: "art_1",
      conversationId: "conv_1",
      agentId: "ag_1",
      workspaceId: "ws_1",
      taskId: null,
      filename: "file.txt",
      contentType: "text/plain",
      size: 100,
      r2Key: "secret/key",
      thumbnailR2Key: null,
      source: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const result = artifactQueries.artifactToResponse(row as any);

    expect(result).not.toHaveProperty("r2Key");
    expect(result).not.toHaveProperty("workspace_id");
    expect(result).not.toHaveProperty("workspaceId");
    expect(result).not.toHaveProperty("thumbnailR2Key");
  });

  it("handles null source", () => {
    const row = {
      id: "art_1",
      conversationId: "conv_1",
      agentId: "ag_1",
      workspaceId: "ws_1",
      taskId: null,
      filename: "file.txt",
      contentType: "text/plain",
      size: 0,
      r2Key: "key",
      thumbnailR2Key: null,
      source: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const result = artifactQueries.artifactToResponse(row as any);
    expect(result.source).toBeNull();
  });
});

describe("createArtifactIfAbsent / listArtifactsByTask exports", () => {
  it("exports createArtifactIfAbsent", () => {
    expect(typeof artifactQueries.createArtifactIfAbsent).toBe("function");
  });

  it("exports listArtifactsByTask", () => {
    expect(typeof artifactQueries.listArtifactsByTask).toBe("function");
  });

  it("createArtifactIfAbsent returns created=true on insert", async () => {
    const row = {
      id: "art_dlv_t1_delivery",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "ws_1",
      taskId: "t1",
      filename: "delivery.md",
      contentType: "text/markdown",
      size: 3,
      r2Key: "k",
      thumbnailR2Key: null,
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    const mockDb = createMockDb([row]);
    mockDb.onConflictDoNothing = vi.fn(() => mockDb);
    mockDb.returning = vi.fn(() => Promise.resolve([row]));

    const result = await artifactQueries.createArtifactIfAbsent(mockDb, {
      id: row.id,
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "ws_1",
      taskId: "t1",
      filename: "delivery.md",
      contentType: "text/markdown",
      size: 3,
      r2Key: "k",
      source: "delivery",
    });

    expect(result.created).toBe(true);
    expect(result.artifact.id).toBe(row.id);
    expect(result.artifact.taskId).toBe("t1");
    expect(result.artifact.workspaceId).toBe("ws_1");
    expect(result.artifact.source).toBe("delivery");
  });

  it("createArtifactIfAbsent returns existing workspace-scoped row on PK conflict", async () => {
    const existing = {
      id: "art_dlv_t1_delivery",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "ws_1",
      taskId: "t1",
      filename: "delivery.md",
      contentType: "text/markdown",
      size: 3,
      r2Key: "k",
      thumbnailR2Key: null,
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    const mockDb = createMockDb([]);
    mockDb.onConflictDoNothing = vi.fn(() => mockDb);
    mockDb.returning = vi.fn(() => Promise.resolve([]));
    // getArtifact awaits where()
    mockDb.where = vi.fn(() => Promise.resolve([existing]));

    const result = await artifactQueries.createArtifactIfAbsent(mockDb, {
      id: existing.id,
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "ws_1",
      taskId: "t1",
      filename: "delivery.md",
      contentType: "text/markdown",
      size: 3,
      r2Key: "k",
      source: "delivery",
    });

    expect(result.created).toBe(false);
    expect(result.artifact).toBe(existing);
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("createArtifactIfAbsent throws when conflict cannot be resolved in workspace", async () => {
    const mockDb = createMockDb([]);
    mockDb.onConflictDoNothing = vi.fn(() => mockDb);
    mockDb.returning = vi.fn(() => Promise.resolve([]));
    mockDb.where = vi.fn(() => Promise.resolve([]));

    await expect(
      artifactQueries.createArtifactIfAbsent(mockDb, {
        id: "art_foreign",
        conversationId: "c1",
        agentId: "a1",
        workspaceId: "ws_1",
        taskId: "t1",
        filename: "delivery.md",
        contentType: "text/markdown",
        size: 1,
        r2Key: "k",
        source: "delivery",
      }),
    ).rejects.toThrow(/idempotency conflict/);
  });

  it("createArtifact persists optional taskId for delivery linkage", async () => {
    const row = {
      id: "art_1",
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "ws_1",
      taskId: "task_linked",
      filename: "digest.md",
      contentType: "text/markdown",
      size: 1,
      r2Key: "k",
      thumbnailR2Key: null,
      source: "delivery",
      createdAt: "2026-07-16T00:00:00.000Z",
    };
    const mockDb = createMockDb([row]);
    mockDb.returning = vi.fn(() => Promise.resolve([row]));

    const created = await artifactQueries.createArtifact(mockDb, {
      conversationId: "c1",
      agentId: "a1",
      workspaceId: "ws_1",
      taskId: "task_linked",
      filename: "digest.md",
      contentType: "text/markdown",
      size: 1,
      r2Key: "k",
      source: "delivery",
    });

    expect(created.taskId).toBe("task_linked");
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "ws_1",
        taskId: "task_linked",
        source: "delivery",
      }),
    );
  });

  it("listArtifactsByTask scopes by workspaceId and taskId", async () => {
    const mockDb = createMockDb([]);
    mockDb.where = vi.fn(() => mockDb);
    mockDb.orderBy = vi.fn(() => Promise.resolve([]));

    await artifactQueries.listArtifactsByTask(mockDb, "ws_1", "task_1");

    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });

  it("listArtifactsByTask applies optional source filter and limit", async () => {
    const rows = [
      {
        id: "art_dlv_t1_delivery",
        workspaceId: "ws_1",
        taskId: "task_1",
        source: "delivery",
      },
    ];
    const mockDb = createMockDb(rows);
    mockDb.where = vi.fn(() => mockDb);
    mockDb.orderBy = vi.fn(() => mockDb);
    mockDb.limit = vi.fn(() => Promise.resolve(rows));

    const result = await artifactQueries.listArtifactsByTask(mockDb, "ws_1", "task_1", {
      source: "delivery",
      limit: 5,
    });

    expect(result).toEqual(rows);
    expect(mockDb.limit).toHaveBeenCalledWith(5);
  });
});

describe("getArtifact", () => {
  it("returns null when no artifact found", async () => {
    const mockDb = createMockDb([]);
    mockDb.limit = vi.fn(() => Promise.resolve([]));
    mockDb.where = vi.fn(() => Promise.resolve([]));
    const result = await artifactQueries.getArtifact(mockDb, "art_missing", "ws_1");
    expect(result).toBeNull();
  });
});

describe("getArtifactForOwner", () => {
  it("joins the conversation and returns its owner-scoped artifact", async () => {
    const row = { id: "art_1", conversationId: "conv_1", workspaceId: "ws_1" };
    const mockDb = createMockDb([]);
    mockDb.where = vi.fn(() => Promise.resolve([{ artifact: row }]));

    const result = await artifactQueries.getArtifactForOwner(
      mockDb,
      "art_1",
      "ws_1",
      "user_1",
    );

    expect(result).toBe(row);
    expect(mockDb.innerJoin).toHaveBeenCalledOnce();
  });

  it("returns null when the conversation owner does not match", async () => {
    const mockDb = createMockDb([]);
    mockDb.where = vi.fn(() => Promise.resolve([]));

    const result = await artifactQueries.getArtifactForOwner(
      mockDb,
      "art_1",
      "ws_1",
      "other-user",
    );

    expect(result).toBeNull();
  });
});
