import { describe, expect, it } from "vitest";
import {
  FIRST_MISSION_STORAGE_PREFIX,
  firstMissionStorageKey,
  resolveFirstMissionHref,
  shouldShowFirstMission,
  FIRST_MISSION_STEPS,
} from "./first-mission";

describe("first-mission helpers", () => {
  it("builds stable storage keys", () => {
    expect(firstMissionStorageKey("ws_1")).toBe(
      `${FIRST_MISSION_STORAGE_PREFIX}ws_1`,
    );
  });

  it("hides when dismissed or missing agents/computer", () => {
    expect(
      shouldShowFirstMission({
        agentCount: 1,
        onlineRuntimeCount: 1,
        dismissed: true,
      }),
    ).toBe(false);
    expect(
      shouldShowFirstMission({
        agentCount: 0,
        onlineRuntimeCount: 1,
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowFirstMission({
        agentCount: 2,
        onlineRuntimeCount: 0,
        dismissed: false,
      }),
    ).toBe(false);
  });

  it("shows when ready", () => {
    expect(
      shouldShowFirstMission({
        agentCount: 1,
        onlineRuntimeCount: 1,
        dismissed: false,
      }),
    ).toBe(true);
  });

  it("resolves hrefs", () => {
    const approvals = FIRST_MISSION_STEPS.find((s) => s.id === "approvals")!;
    expect(resolveFirstMissionHref(approvals, "acme", "ag_1")).toBe(
      "/w/acme/approvals",
    );
    const agent = FIRST_MISSION_STEPS.find((s) => s.id === "send_message")!;
    expect(resolveFirstMissionHref(agent, "acme", "ag_1")).toBe(
      "/w/acme/agents/ag_1",
    );
    expect(resolveFirstMissionHref(agent, "acme", null)).toBe("/w/acme/home");
  });
});
