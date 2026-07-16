import { describe, expect, it } from "vitest";
import { conversationMembersToDisplayRows } from "./conversation-members-display";
import {
  agentsAvailableToAdd,
  countAgentMembers,
  resolveChannelMembers,
} from "./channel-members-display";

describe("conversationMembersToDisplayRows", () => {
  it("maps conversation_id into channel_id for shared display helpers", () => {
    const rows = conversationMembersToDisplayRows([
      {
        id: "cvm_1",
        workspace_id: "w1",
        conversation_id: "conv_1",
        member_type: "agent",
        member_id: "a1",
        created_at: "2026-07-16T00:00:00.000Z",
      },
      {
        id: "cvm_2",
        workspace_id: "w1",
        conversation_id: "conv_1",
        member_type: "user",
        member_id: "u1",
      },
    ]);

    expect(rows).toEqual([
      {
        id: "cvm_1",
        workspace_id: "w1",
        channel_id: "conv_1",
        member_type: "agent",
        member_id: "a1",
        created_at: "2026-07-16T00:00:00.000Z",
      },
      {
        id: "cvm_2",
        workspace_id: "w1",
        channel_id: "conv_1",
        member_type: "user",
        member_id: "u1",
        created_at: undefined,
      },
    ]);

    const resolved = resolveChannelMembers(rows, {
      agents: { a1: "Scout" },
      users: { u1: "Beacon" },
    });
    expect(resolved.map((r) => r.displayName)).toEqual(["Scout", "Beacon"]);
    expect(countAgentMembers(rows)).toBe(1);
    expect(
      agentsAvailableToAdd(
        [
          { id: "a1", name: "Scout" },
          { id: "a2", name: "Mira" },
        ],
        rows,
      ),
    ).toEqual([{ id: "a2", name: "Mira" }]);
  });
});
