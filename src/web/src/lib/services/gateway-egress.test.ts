import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  shouldAttemptGatewayLiveEgress,
  gatewayEgressDedupeKey,
  deliverTaskResultToGatewayLive,
} from "./gateway-egress";

const mockHasDedupe = vi.fn();
const mockCreateActivity = vi.fn();
const mockGetBinding = vi.fn();

vi.mock("@phneakngar/shared", async () => {
  const actual = await vi.importActual<typeof import("@phneakngar/shared")>(
    "@phneakngar/shared",
  );
  return {
    ...actual,
    queries: {
      ...actual.queries,
      activityEvent: {
        hasActivityDedupe: (...a: unknown[]) => mockHasDedupe(...a),
        createActivityEvent: (...a: unknown[]) => mockCreateActivity(...a),
      },
      gatewayBinding: {
        getGatewayBinding: (...a: unknown[]) => mockGetBinding(...a),
      },
    },
  };
});

describe("shouldAttemptGatewayLiveEgress", () => {
  it("skips non-gateway tasks", () => {
    expect(shouldAttemptGatewayLiveEgress({}).attempt).toBe(false);
    expect(shouldAttemptGatewayLiveEgress({ gateway: false }).reason).toBe(
      "not_gateway_task",
    );
  });

  it("skips preview mode", () => {
    const r = shouldAttemptGatewayLiveEgress({
      gateway: true,
      provider: "telegram",
      team_id: "T1",
      channel_id: "C1",
      outbound_mode: "preview",
    });
    expect(r.attempt).toBe(false);
    expect(r.reason).toBe("preview_mode");
  });

  it("allows live telegram", () => {
    const r = shouldAttemptGatewayLiveEgress({
      gateway: true,
      provider: "telegram",
      team_id: "T1",
      channel_id: "C1",
      outbound_mode: "live",
      binding_id: "gb1",
    });
    expect(r.attempt).toBe(true);
    expect(r.provider).toBe("telegram");
  });

  it("skips discord live (no client)", () => {
    const r = shouldAttemptGatewayLiveEgress({
      gateway: true,
      provider: "discord",
      team_id: "G1",
      channel_id: "C1",
      outbound_mode: "live",
    });
    expect(r.attempt).toBe(false);
    expect(r.reason).toBe("provider_not_live");
  });
});

describe("deliverTaskResultToGatewayLive", () => {
  beforeEach(() => {
    mockHasDedupe.mockReset();
    mockCreateActivity.mockReset();
    mockGetBinding.mockReset();
    mockHasDedupe.mockResolvedValue(false);
    mockCreateActivity.mockResolvedValue({ created: true, row: { id: "ae1" } });
  });

  it("skips when preview", async () => {
    const result = await deliverTaskResultToGatewayLive({} as any, {
      id: "t1",
      agentId: "a1",
      workspaceId: "w1",
      conversationId: "c1",
      context: {
        gateway: true,
        provider: "slack",
        team_id: "T1",
        channel_id: "C1",
        outbound_mode: "preview",
      },
      result: { output: "hi" },
    });
    expect(result).toEqual({ ok: true, skipped: "preview_mode" });
    expect(mockGetBinding).not.toHaveBeenCalled();
  });

  it("skips when missing token", async () => {
    mockGetBinding.mockResolvedValue({
      id: "gb1",
      outboundMode: "live",
      secretRef: null,
    });
    const result = await deliverTaskResultToGatewayLive({} as any, {
      id: "t1",
      agentId: "a1",
      workspaceId: "w1",
      conversationId: "c1",
      context: {
        gateway: true,
        provider: "telegram",
        team_id: "T1",
        channel_id: "C1",
        outbound_mode: "live",
        binding_id: "gb1",
      },
      result: { output: "hi" },
    });
    expect(result).toEqual({ ok: true, skipped: "missing_token" });
  });

  it("sends live telegram with inject token", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    }));
    const result = await deliverTaskResultToGatewayLive(
      {} as any,
      {
        id: "t1",
        agentId: "a1",
        workspaceId: "w1",
        conversationId: "c1",
        context: {
          gateway: true,
          provider: "telegram",
          team_id: "T1",
          channel_id: "C1",
          outbound_mode: "live",
          binding_id: "gb1",
        },
        result: { output: "hello world" },
      },
      { token: "bot-token", fetch: fetchMock as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBe("telegram");
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockCreateActivity).toHaveBeenCalled();
  });

  it("is idempotent when dedupe exists", async () => {
    mockHasDedupe.mockResolvedValue(true);
    const fetchMock = vi.fn();
    const result = await deliverTaskResultToGatewayLive(
      {} as any,
      {
        id: "t1",
        agentId: "a1",
        workspaceId: "w1",
        conversationId: "c1",
        context: {
          gateway: true,
          provider: "slack",
          team_id: "T1",
          channel_id: "C1",
          outbound_mode: "live",
          binding_id: "gb1",
        },
        result: { output: "hi" },
      },
      { token: "x", fetch: fetchMock as unknown as typeof fetch },
    );
    expect(result).toEqual({ ok: true, skipped: "already_sent" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("gatewayEgressDedupeKey", () => {
  it("is stable per task", () => {
    expect(gatewayEgressDedupeKey("t9")).toBe("gateway-egress:t9");
  });
});
