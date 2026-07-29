import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByKey = vi.fn();
const mockCreateMapping = vi.fn();
const mockCreateConversation = vi.fn();
const mockCreateMessage = vi.fn();
const mockGetAgent = vi.fn();
const mockGetMember = vi.fn();
const mockEnqueueTask = vi.fn();
const mockFindActiveBinding = vi.fn();
const mockClaimDedupe = vi.fn();
const mockIsPeerAllowed = vi.fn();

vi.mock("@phneakngar/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@phneakngar/shared")>();
  return {
    ...actual,
    queries: {
      conversationMap: {
        findByKey: (...a: unknown[]) => mockFindByKey(...a),
        createMapping: (...a: unknown[]) => mockCreateMapping(...a),
      },
      conversation: {
        createConversation: (...a: unknown[]) => mockCreateConversation(...a),
      },
      message: {
        createMessage: (...a: unknown[]) => mockCreateMessage(...a),
      },
      agent: {
        getAgent: (...a: unknown[]) => mockGetAgent(...a),
      },
      member: {
        getMemberByUserAndWorkspace: (...a: unknown[]) => mockGetMember(...a),
      },
      gatewayBinding: {
        findActiveGatewayBinding: (...a: unknown[]) => mockFindActiveBinding(...a),
        claimIngressDedupe: (...a: unknown[]) => mockClaimDedupe(...a),
        isPeerAllowed: (...a: unknown[]) => mockIsPeerAllowed(...a),
      },
    },
  };
});

vi.mock("@/lib/services/task", () => ({
  TaskService: function () {
    return { enqueueTask: mockEnqueueTask };
  },
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  GATEWAY_PROVIDERS,
  isGatewayProvider,
  parseGatewayTeamMap,
  resolveGatewayMapping,
  gatewayMapKey,
  extractTeamId,
  extractText,
  extractChannelId,
  buildGatewayConversationMapKey,
  ingressGatewayMessage,
} from "./gateway-ingress";

describe("GATEWAY_PROVIDERS", () => {
  it("lists Phase 4 providers in lockstep with webhook routes", () => {
    expect([...GATEWAY_PROVIDERS]).toEqual([
      "slack",
      "discord",
      "telegram",
      "lark",
      "teams",
    ]);
  });

  it("type-guards known providers only", () => {
    expect(isGatewayProvider("slack")).toBe(true);
    expect(isGatewayProvider("lark")).toBe(true);
    expect(isGatewayProvider("teams")).toBe(true);
    expect(isGatewayProvider("irc")).toBe(false);
    expect(isGatewayProvider(null)).toBe(false);
    expect(isGatewayProvider(1)).toBe(false);
  });
});

describe("parseGatewayTeamMap", () => {
  it("parses valid JSON mappings", () => {
    const map = parseGatewayTeamMap(
      JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
        "discord:G1": { workspace_id: "ws2", agent_id: "ag2", user_id: "u2" },
      }),
    );
    expect(map["slack:T1"]).toEqual({ workspaceId: "ws1", agentId: "ag1", userId: "u1" });
    expect(map["discord:G1"]).toEqual({ workspaceId: "ws2", agentId: "ag2", userId: "u2" });
  });

  it("returns empty object for invalid input", () => {
    expect(parseGatewayTeamMap(undefined)).toEqual({});
    expect(parseGatewayTeamMap("not-json")).toEqual({});
    expect(parseGatewayTeamMap("[]")).toEqual({});
  });
});

describe("extract helpers", () => {
  it("extracts slack team/text/channel from event payload", () => {
    const body = {
      team_id: "T1",
      event: { type: "message", text: "hi", channel: "C9", team: "T1" },
    };
    expect(extractTeamId("slack", body)).toBe("T1");
    expect(extractText("slack", body)).toBe("hi");
    expect(extractChannelId("slack", body)).toBe("C9");
  });

  it("ignores an x-team-id header and routes on the signed body instead", () => {
    // Honouring a caller-supplied header would let anyone redirect ingress into another
    // tenant's workspace, so only signature-covered body fields are trusted.
    const headers = new Headers({ "X-Team-Id": "T-header" });
    expect(
      (extractTeamId as (p: string, b: unknown, h?: Headers) => string | null)(
        "slack",
        { team_id: "T-body" },
        headers,
      ),
    ).toBe("T-body");
  });

  it("extracts discord and telegram fields", () => {
    expect(extractTeamId("discord", { guild_id: "G1", content: "yo", channel_id: "C1" })).toBe("G1");
    expect(extractText("discord", { content: "yo" })).toBe("yo");
    expect(
      extractTeamId("telegram", { message: { chat: { id: 42 }, text: "ping" } }),
    ).toBe("42");
    expect(extractText("telegram", { message: { chat: { id: 42 }, text: "ping" } })).toBe("ping");
  });

  it("extracts lark team/text/channel", () => {
    const body = {
      tenant_key: "tenant_1",
      event: {
        message: {
          chat_id: "oc_chat",
          content: JSON.stringify({ text: "lark hi" }),
        },
      },
    };
    expect(extractTeamId("lark", body)).toBe("tenant_1");
    expect(extractText("lark", body)).toBe("lark hi");
    expect(extractChannelId("lark", body)).toBe("oc_chat");
  });

  it("ignores x-lark-tenant-key header; tenant must come from the signed body", () => {
    const headers = new Headers({ "x-lark-tenant-key": "tenant-from-header" });
    expect(
      (extractTeamId as (p: string, b: unknown, h?: Headers) => string | null)(
        "lark",
        { event: { message: { chat_id: "oc" } } },
        headers,
      ),
    ).toBeNull();
    // Body-carried tenant_key still resolves.
    expect(extractTeamId("lark", { tenant_key: "tenant_1" })).toBe("tenant_1");
  });

  it("extracts teams team/text/channel", () => {
    const body = {
      tenant_id: "tenant-guid",
      text: "teams hi",
      conversation: { id: "19:chan@thread.tacv2" },
      channelData: { tenant: { id: "tenant-guid" } },
    };
    expect(extractTeamId("teams", body)).toBe("tenant-guid");
    expect(extractText("teams", body)).toBe("teams hi");
    expect(extractChannelId("teams", body)).toBe("19:chan@thread.tacv2");
  });

  it("extracts teams text from body field when text missing", () => {
    expect(
      extractText("teams", {
        tenant_id: "t",
        body: "body-text",
        conversation: { id: "c" },
      }),
    ).toBe("body-text");
    expect(
      extractText("teams", {
        tenant_id: "t",
        body: { content: "nested body" },
        conversation: { id: "c" },
      }),
    ).toBe("nested body");
  });

  it("builds conversation map keys", () => {
    expect(buildGatewayConversationMapKey("slack", "T1", "C1")).toBe("gateway:slack:T1:C1");
    expect(buildGatewayConversationMapKey("slack", "T1", null)).toBe("gateway:slack:T1:default");
    expect(buildGatewayConversationMapKey("lark", "tenant_1", "oc_1")).toBe(
      "gateway:lark:tenant_1:oc_1",
    );
    expect(buildGatewayConversationMapKey("teams", "tenant-guid", "19:c")).toBe(
      "gateway:teams:tenant-guid:19:c",
    );
  });

  it("maps lark and teams provider keys", () => {
    const map = parseGatewayTeamMap(
      JSON.stringify({
        "lark:tenant_1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
        "teams:tenant-guid": { workspaceId: "ws2", agentId: "ag2", userId: "u2" },
      }),
    );
    expect(gatewayMapKey("lark", "tenant_1")).toBe("lark:tenant_1");
    expect(gatewayMapKey("teams", "tenant-guid")).toBe("teams:tenant-guid");
    expect(resolveGatewayMapping(map, "lark", "tenant_1")).toEqual({
      workspaceId: "ws1",
      agentId: "ag1",
      userId: "u1",
    });
    expect(resolveGatewayMapping(map, "teams", "tenant-guid")).toEqual({
      workspaceId: "ws2",
      agentId: "ag2",
      userId: "u2",
    });
  });
});

describe("ingressGatewayMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByKey.mockResolvedValue(null);
    mockCreateConversation.mockResolvedValue({ id: "conv1" });
    mockCreateMapping.mockResolvedValue("conv1");
    mockCreateMessage.mockResolvedValue({ id: "msg1" });
    mockGetAgent.mockResolvedValue({ id: "ag1", runtimeId: "rt1", ownerId: "u1" });
    mockGetMember.mockResolvedValue({ id: "m1", userId: "u1" });
    mockEnqueueTask.mockResolvedValue({ id: "task1" });
    mockFindActiveBinding.mockResolvedValue(null);
    mockClaimDedupe.mockResolvedValue({ claimed: true, row: { id: "dedupe1" } });
    mockIsPeerAllowed.mockResolvedValue(true);
  });

  it("rejects unknown team mapping with 404", async () => {
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { team_id: "T-unknown", text: "hello" },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result).toEqual({ ok: false, status: 404, error: "unknown workspace mapping" });
    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it("rejects when mapped agent missing", async () => {
    mockGetAgent.mockResolvedValue(null);
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { team_id: "T1", text: "hello" },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "mapped agent not found in workspace",
    });
    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it("rejects when mapped user is not a member", async () => {
    mockGetMember.mockResolvedValue(null);
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { team_id: "T1", text: "hello" },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result).toEqual({
      ok: false,
      status: 404,
      error: "mapped user not a workspace member",
    });
  });

  it("rejects missing team_id / text", async () => {
    const noTeam = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { text: "hello" },
      teamMapRaw: "{}",
    });
    expect(noTeam.status).toBe(400);

    const noText = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { team_id: "T1" },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(noText.status).toBe(400);
  });

  it("creates conversation + message + task when mapped", async () => {
    const teamMapRaw = JSON.stringify({
      "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
    });
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { team_id: "T1", channel_id: "C1", text: "ship it" },
      teamMapRaw,
    });

    expect(result).toEqual({
      ok: true,
      conversationId: "conv1",
      messageId: "msg1",
      createdConversation: true,
      taskId: "task1",
      bindingId: null,
      outboundMode: null,
    });
    expect(mockCreateConversation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        workspaceId: "ws1",
        agentId: "ag1",
        userId: "u1",
        channel: "slack",
      }),
    );
    expect(mockCreateMapping).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        key: "gateway:slack:T1:C1",
        workspaceId: "ws1",
        conversationId: "conv1",
      }),
    );
    expect(mockCreateMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        conversationId: "conv1",
        role: "user",
        content: "ship it",
      }),
    );
    expect(mockEnqueueTask).toHaveBeenCalledWith(
      "ag1",
      "conv1",
      "ws1",
      "ship it",
      "user_dm_message",
      expect.objectContaining({ contextKey: "conv1" }),
    );
  });

  it("reuses existing mapped conversation", async () => {
    mockFindByKey.mockResolvedValue("existing-conv");
    const result = await ingressGatewayMessage({} as never, {
      provider: "discord",
      body: { guild_id: "G1", channel_id: "C2", content: "again" },
      teamMapRaw: JSON.stringify({
        "discord:G1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conversationId).toBe("existing-conv");
      expect(result.createdConversation).toBe(false);
      expect(result.taskId).toBe("task1");
    }
    expect(mockCreateConversation).not.toHaveBeenCalled();
    expect(mockCreateMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ conversationId: "existing-conv", content: "again" }),
    );
  });

  it("creates conversation for lark tenant mapping", async () => {
    const result = await ingressGatewayMessage({} as never, {
      provider: "lark",
      body: {
        tenant_key: "tenant_1",
        event: {
          message: {
            chat_id: "oc_1",
            content: JSON.stringify({ text: "lark ship" }),
          },
        },
      },
      teamMapRaw: JSON.stringify({
        "lark:tenant_1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.conversationId).toBe("conv1");
      expect(result.taskId).toBe("task1");
    }
    expect(mockCreateMapping).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ key: "gateway:lark:tenant_1:oc_1" }),
    );
    expect(mockCreateMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ content: "lark ship" }),
    );
  });

  it("creates conversation for teams tenant mapping", async () => {
    const result = await ingressGatewayMessage({} as never, {
      provider: "teams",
      body: {
        tenant_id: "tenant-guid",
        text: "teams ship",
        conversation: { id: "19:c@thread.tacv2" },
      },
      teamMapRaw: JSON.stringify({
        "teams:tenant-guid": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.createdConversation).toBe(true);
      expect(result.taskId).toBe("task1");
    }
    expect(mockCreateConversation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ channel: "teams" }),
    );
    expect(mockCreateMapping).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ key: "gateway:teams:tenant-guid:19:c@thread.tacv2" }),
    );
  });

  it("prefers D1 gateway_binding over env team map", async () => {
    mockFindActiveBinding.mockResolvedValue({
      id: "gb1",
      workspaceId: "ws-db",
      agentId: "ag-db",
      userId: "u-db",
      dmPolicy: "open",
      outboundMode: "preview",
    });
    mockGetAgent.mockResolvedValue({ id: "ag-db", runtimeId: "rt1" });
    mockGetMember.mockResolvedValue({ id: "m1", userId: "u-db" });

    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: { team_id: "T1", text: "from binding", channel_id: "C1" },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws-env", agentId: "ag-env", userId: "u-env" },
      }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bindingId).toBe("gb1");
      expect(result.outboundMode).toBe("preview");
    }
    expect(mockGetAgent).toHaveBeenCalledWith({}, "ag-db", "ws-db");
    expect(mockCreateConversation).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ workspaceId: "ws-db", agentId: "ag-db", userId: "u-db" }),
    );
  });

  it("ignores bot-authored messages", async () => {
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: {
        team_id: "T1",
        event: { bot_id: "B1", text: "bot says", channel: "C1" },
      },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result).toMatchObject({ ok: true, ignored: "bot_loop" });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it("returns duplicate when ingress dedupe already claimed", async () => {
    mockClaimDedupe.mockResolvedValue({
      claimed: false,
      row: { conversationId: "conv-old", messageId: "msg-old" },
    });
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: {
        team_id: "T1",
        event: { text: "hi", channel: "C1", ts: "123.456", user: "U1" },
      },
      teamMapRaw: JSON.stringify({
        "slack:T1": { workspaceId: "ws1", agentId: "ag1", userId: "u1" },
      }),
    });
    expect(result).toMatchObject({
      ok: true,
      ignored: "duplicate",
      conversationId: "conv-old",
      messageId: "msg-old",
    });
    expect(mockCreateMessage).not.toHaveBeenCalled();
  });

  it("enforces allowlist dm_policy on binding", async () => {
    mockFindActiveBinding.mockResolvedValue({
      id: "gb1",
      workspaceId: "ws1",
      agentId: "ag1",
      userId: "u1",
      dmPolicy: "allowlist",
      outboundMode: "preview",
    });
    mockIsPeerAllowed.mockResolvedValue(false);
    const result = await ingressGatewayMessage({} as never, {
      provider: "slack",
      body: {
        team_id: "T1",
        event: { text: "hi", channel: "C1", user: "U-stranger" },
      },
    });
    expect(result).toEqual({ ok: false, status: 403, error: "peer not allowlisted" });
  });
});

describe("resolveGatewayMapping", () => {
  it("returns null for missing key", () => {
    expect(resolveGatewayMapping({}, "slack", "T1")).toBeNull();
  });
});
