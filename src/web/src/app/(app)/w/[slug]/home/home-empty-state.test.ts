import { describe, expect, it } from "vitest";
import {
  emptyStateAutoMintsToken,
  resolveHomeEmptyPresentation,
} from "./home-empty-state";

describe("resolveHomeEmptyPresentation", () => {
  it("returns null when agents already exist", () => {
    expect(
      resolveHomeEmptyPresentation({
        memberRole: "member",
        agentCount: 2,
        onlineRuntimeCount: 0,
      }),
    ).toBeNull();
  });

  it("owner + 0 agents + 0 online → required connect + get started (auto token)", () => {
    const p = resolveHomeEmptyPresentation({
      memberRole: "owner",
      agentCount: 0,
      onlineRuntimeCount: 0,
    })!;
    expect(p.showOwnerConnectRequired).toBe(true);
    expect(p.showOwnerGetStarted).toBe(true);
    expect(p.showMemberWaitingForTeamComputer).toBe(false);
    expect(p.showMemberOptionalConnect).toBe(false);
    expect(emptyStateAutoMintsToken(p)).toBe(true);
  });

  it("owner + 0 agents + online → get started only (no connect card)", () => {
    const p = resolveHomeEmptyPresentation({
      memberRole: "owner",
      agentCount: 0,
      onlineRuntimeCount: 1,
    })!;
    expect(p.showOwnerConnectRequired).toBe(false);
    expect(p.showOwnerGetStarted).toBe(true);
    expect(emptyStateAutoMintsToken(p)).toBe(false);
  });

  it("member + 0 agents + 0 online → waiting + optional connect, never auto token", () => {
    const p = resolveHomeEmptyPresentation({
      memberRole: "member",
      agentCount: 0,
      onlineRuntimeCount: 0,
    })!;
    expect(p.showMemberWaitingForTeamComputer).toBe(true);
    expect(p.showMemberOptionalConnect).toBe(true);
    expect(p.showOwnerConnectRequired).toBe(false);
    expect(p.showOwnerGetStarted).toBe(false);
    expect(emptyStateAutoMintsToken(p)).toBe(false);
  });

  it("member + 0 agents + online → waiting for agents only", () => {
    const p = resolveHomeEmptyPresentation({
      memberRole: "member",
      agentCount: 0,
      onlineRuntimeCount: 2,
    })!;
    expect(p.showMemberWaitingForAgents).toBe(true);
    expect(p.showMemberWaitingForTeamComputer).toBe(false);
    expect(p.showMemberOptionalConnect).toBe(false);
    expect(p.showOwnerConnectRequired).toBe(false);
    expect(emptyStateAutoMintsToken(p)).toBe(false);
  });
});
