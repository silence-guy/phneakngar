import { describe, expect, it } from "vitest";
import {
  isAgentDmParticipant,
  isDmConversationType,
  isMultiPartyDm,
  mergeDmMemberships,
  MULTI_PARTY_DM_SUPPORTED,
  resolveDmParticipants,
  resolveDmParticipantsFromMembership,
} from "./dm-membership";

describe("dm-membership", () => {
  it("treats user_dm_message and default as DM types", () => {
    expect(isDmConversationType("user_dm_message")).toBe(true);
    expect(isDmConversationType("dm")).toBe(true);
    expect(isDmConversationType(null)).toBe(true);
    expect(isDmConversationType("channel")).toBe(false);
  });

  it("documents multi-party DM as supported via conversation_member", () => {
    expect(MULTI_PARTY_DM_SUPPORTED).toBe(true);
  });

  it("resolves agent + user as durable DM participants without memberships", () => {
    const parts = resolveDmParticipants({
      id: "c1",
      agentId: "ag_1",
      userId: "u_1",
      type: "user_dm_message",
    });
    expect(parts).toEqual([
      {
        key: "agent:ag_1",
        memberType: "agent",
        memberId: "ag_1",
        role: "agent",
      },
      {
        key: "user:u_1",
        memberType: "user",
        memberId: "u_1",
        role: "user",
      },
    ]);
  });

  it("accepts snake_case conversation fields", () => {
    const parts = resolveDmParticipants({
      id: "c2",
      agent_id: "ag_2",
      user_id: "u_2",
      type: "user_dm_message",
    });
    expect(parts.map((p) => p.memberId)).toEqual(["ag_2", "u_2"]);
  });

  it("returns empty for non-DM conversation types", () => {
    expect(
      resolveDmParticipants({
        id: "c3",
        agentId: "ag_1",
        userId: "u_1",
        type: "email_notification",
      }),
    ).toEqual([]);
  });

  it("resolveDmParticipants merges memberships when provided", () => {
    const conv = {
      id: "c5",
      agentId: "ag_1",
      userId: "u_1",
      type: "user_dm_message",
    };
    const parts = resolveDmParticipants(conv, [
      { memberType: "agent", memberId: "ag_1" }, // duplicate primary
      { member_type: "agent", member_id: "ag_2" },
      { memberType: "user", memberId: "u_2" },
    ]);
    expect(parts.map((p) => p.key)).toEqual([
      "agent:ag_1",
      "user:u_1",
      "agent:ag_2",
      "user:u_2",
    ]);
  });

  it("falls back to conversation agent+user when memberships omitted", () => {
    const parts = resolveDmParticipants({
      id: "c6",
      agentId: "ag_1",
      userId: "u_1",
      type: "user_dm_message",
    });
    expect(parts.map((p) => p.key)).toEqual(["agent:ag_1", "user:u_1"]);
  });

  it("mergeDmMemberships dedupes and filters invalid rows", () => {
    expect(
      mergeDmMemberships([
        { memberType: "agent", memberId: "ag_1" },
        { member_type: "agent", member_id: "ag_1" },
        { memberType: "bot", memberId: "x" },
        { memberType: "user", memberId: "  " },
        { memberType: "user", memberId: "u_2" },
      ]),
    ).toEqual([
      { memberType: "agent", memberId: "ag_1" },
      { memberType: "user", memberId: "u_2" },
    ]);
  });

  it("resolveDmParticipantsFromMembership matches resolveDmParticipants with memberships", () => {
    const conv = {
      id: "c5",
      agentId: "ag_1",
      userId: "u_1",
      type: "user_dm_message",
    };
    const memberships = [
      { memberType: "agent", memberId: "ag_1" },
      { member_type: "agent", member_id: "ag_2" },
      { memberType: "user", memberId: "u_2" },
    ];
    expect(resolveDmParticipantsFromMembership(conv, memberships)).toEqual(
      resolveDmParticipants(conv, memberships),
    );
    expect(isMultiPartyDm(conv, [{ memberType: "agent", memberId: "ag_2" }])).toBe(true);
    expect(isMultiPartyDm(conv, [])).toBe(false);
  });

  it("isAgentDmParticipant matches primary or membership agent", () => {
    const conv = {
      id: "c4",
      agentId: "ag_1",
      userId: "u_1",
      type: "user_dm_message",
    };
    expect(isAgentDmParticipant(conv, "ag_1")).toBe(true);
    expect(isAgentDmParticipant(conv, "ag_other")).toBe(false);
    expect(
      isAgentDmParticipant(conv, "ag_other", [
        { memberType: "agent", memberId: "ag_other" },
      ]),
    ).toBe(true);
  });
});
