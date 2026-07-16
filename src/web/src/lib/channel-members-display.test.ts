import { describe, it, expect } from "vitest";
import {
  resolveChannelMemberRow,
  resolveChannelMembers,
  agentsAvailableToAdd,
  countAgentMembers,
  type ChannelMemberRow,
} from "./channel-members-display";

const agentRow = (id: string, memberId: string): ChannelMemberRow => ({
  id,
  workspace_id: "w1",
  channel_id: "ch1",
  member_type: "agent",
  member_id: memberId,
  created_at: "2026-07-16T00:00:00.000Z",
});

const userRow = (id: string, memberId: string): ChannelMemberRow => ({
  id,
  workspace_id: "w1",
  channel_id: "ch1",
  member_type: "user",
  member_id: memberId,
  created_at: "2026-07-16T00:00:00.000Z",
});

describe("resolveChannelMemberRow", () => {
  it("resolves agent name from directory", () => {
    const row = resolveChannelMemberRow(agentRow("m1", "a1"), {
      agents: { a1: "Scout" },
    });
    expect(row).toEqual(
      expect.objectContaining({
        key: "agent:a1",
        memberType: "agent",
        displayName: "Scout",
        subtitle: "agent",
      }),
    );
  });

  it("falls back when agent name missing", () => {
    const row = resolveChannelMemberRow(agentRow("m1", "agent_abcdef12"));
    expect(row?.displayName).toMatch(/^Agent /);
    expect(row?.memberType).toBe("agent");
  });

  it("prefers user name then email", () => {
    expect(
      resolveChannelMemberRow(userRow("m1", "u1"), {
        users: { u1: "Beacon" },
        userEmails: { u1: "b@x.com" },
      })?.displayName,
    ).toBe("Beacon");
    expect(
      resolveChannelMemberRow(userRow("m1", "u1"), {
        userEmails: { u1: "b@x.com" },
      })?.displayName,
    ).toBe("b@x.com");
  });

  it("drops unknown member_type", () => {
    expect(
      resolveChannelMemberRow({
        id: "m1",
        workspace_id: "w1",
        channel_id: "ch1",
        member_type: "bot",
        member_id: "x",
      }),
    ).toBeNull();
  });
});

describe("resolveChannelMembers", () => {
  it("orders agents before users and sorts by name", () => {
    const rows = [
      userRow("m1", "u2"),
      agentRow("m2", "a2"),
      userRow("m3", "u1"),
      agentRow("m4", "a1"),
    ];
    const resolved = resolveChannelMembers(rows, {
      agents: { a1: "Zebra", a2: "Alpha" },
      users: { u1: "Ann", u2: "Bob" },
    });
    expect(resolved.map((r) => r.displayName)).toEqual([
      "Alpha",
      "Zebra",
      "Ann",
      "Bob",
    ]);
    expect(resolved[0]?.memberType).toBe("agent");
    expect(resolved[2]?.memberType).toBe("user");
  });

  it("de-dupes by type+id", () => {
    const rows = [agentRow("m1", "a1"), agentRow("m2", "a1")];
    const resolved = resolveChannelMembers(rows, { agents: { a1: "Scout" } });
    expect(resolved).toHaveLength(1);
  });

  it("returns empty for empty input", () => {
    expect(resolveChannelMembers([])).toEqual([]);
  });
});

describe("agentsAvailableToAdd", () => {
  it("excludes agents already members", () => {
    const available = agentsAvailableToAdd(
      [
        { id: "a1", name: "Scout" },
        { id: "a2", name: "Writer" },
      ],
      [agentRow("m1", "a1")],
    );
    expect(available.map((a) => a.id)).toEqual(["a2"]);
  });

  it("prefers current agent id first", () => {
    const available = agentsAvailableToAdd(
      [
        { id: "a1", name: "Alpha" },
        { id: "a2", name: "Beta" },
      ],
      [],
      { preferAgentId: "a2" },
    );
    expect(available[0]?.id).toBe("a2");
  });

  it("returns empty when all agents are members", () => {
    expect(
      agentsAvailableToAdd(
        [{ id: "a1", name: "Scout" }],
        [agentRow("m1", "a1")],
      ),
    ).toEqual([]);
  });
});

describe("countAgentMembers", () => {
  it("counts only agent memberships", () => {
    expect(
      countAgentMembers([
        agentRow("m1", "a1"),
        userRow("m2", "u1"),
        agentRow("m3", "a2"),
      ]),
    ).toBe(2);
    expect(countAgentMembers([])).toBe(0);
  });
});
